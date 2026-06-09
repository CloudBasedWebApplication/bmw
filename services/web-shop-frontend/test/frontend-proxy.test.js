const assert = require("node:assert/strict");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function requestPath(baseUrl, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const base = new URL(baseUrl);
    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port,
        path: requestPath,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          });
        });
      }
    );

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(250),
      });
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error("frontend did not become healthy");
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await once(child, "exit").catch(() => {});
}

async function startFrontend(backendUrl, extraEnv = {}) {
  const portProbe = http.createServer((_req, res) => res.end());
  const port = await listen(portProbe);
  await new Promise((resolve) => portProbe.close(resolve));
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      WEB_SHOP_BACKEND_URL: backendUrl,
      REPO_ROOT: path.resolve(process.cwd(), "..", ".."),
      ...extraEnv,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(baseUrl);
  } catch (err) {
    await stopChild(child);
    throw new Error(`${err.message}${stderr ? `\n${stderr}` : ""}`);
  }

  return {
    baseUrl,
    async stop() {
      await stopChild(child);
    },
  };
}

test("health identifies the web shop frontend", async () => {
  const backend = http.createServer((_req, res) => res.end("backend"));
  let frontend;

  try {
    const backendPort = await listen(backend);
    frontend = await startFrontend(`http://127.0.0.1:${backendPort}`);
    const response = await fetch(`${frontend.baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, service: "web-shop-frontend" });
  } finally {
    if (frontend) await frontend.stop();
    backend.close();
  }
});

test("streams homepage mp4 media from MinIO with range headers preserved", async () => {
  const minioRequests = [];
  const minio = http.createServer((req, res) => {
    minioRequests.push({
      method: req.method,
      url: req.url,
      range: req.headers.range,
    });
    res.statusCode = 206;
    res.setHeader("content-type", "video/mp4");
    res.setHeader("content-range", "bytes 0-3/12");
    res.setHeader("accept-ranges", "bytes");
    res.end("data");
  });
  const backendRequests = [];
  const backend = http.createServer((req, res) => {
    backendRequests.push(req.url);
    res.statusCode = 502;
    res.end("backend");
  });
  let frontend;

  try {
    const minioPort = await listen(minio);
    const backendPort = await listen(backend);
    frontend = await startFrontend(`http://127.0.0.1:${backendPort}`, {
      MINIO_ENDPOINT: "127.0.0.1",
      MINIO_PORT: String(minioPort),
      MINIO_BUCKET: "course-assets",
    });

    const response = await fetch(`${frontend.baseUrl}/media/home/bmw-m-stage-loop.mp4?x=1`, {
      headers: {
        range: "bytes=0-3",
      },
    });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.equal(response.headers.get("content-range"), "bytes 0-3/12");
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(await response.text(), "data");
    assert.deepEqual(minioRequests, [
      {
        method: "GET",
        url: "/course-assets/home/bmw-m-stage-loop.mp4?x=1",
        range: "bytes=0-3",
      },
    ]);
    assert.deepEqual(backendRequests, []);
  } finally {
    if (frontend) await frontend.stop();
    backend.close();
    minio.close();
  }
});

test("passes non-home media routes through to the backend catch-all", async () => {
  const backendRequests = [];
  const backend = http.createServer((req, res) => {
    backendRequests.push(req.url);
    res.setHeader("content-type", "text/plain");
    res.end("backend media");
  });
  let frontend;

  try {
    const backendPort = await listen(backend);
    frontend = await startFrontend(`http://127.0.0.1:${backendPort}`);

    const response = await fetch(`${frontend.baseUrl}/media/library?x=1`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "backend media");
    assert.deepEqual(backendRequests, ["/media/library?x=1"]);
  } finally {
    if (frontend) await frontend.stop();
    backend.close();
  }
});

test("rejects invalid homepage media requests before backend fallback", async () => {
  const minioRequests = [];
  const minio = http.createServer((req, res) => {
    minioRequests.push(req.url);
    res.end("minio");
  });
  const backendRequests = [];
  const backend = http.createServer((req, res) => {
    backendRequests.push(req.url);
    res.end("backend");
  });
  let frontend;

  try {
    const minioPort = await listen(minio);
    const backendPort = await listen(backend);
    frontend = await startFrontend(`http://127.0.0.1:${backendPort}`, {
      MINIO_ENDPOINT: "127.0.0.1",
      MINIO_PORT: String(minioPort),
      MINIO_BUCKET: "course-assets",
    });

    const invalidPaths = [
      "/media/home",
      "/media/home/",
      "/media/home/%zz.mp4",
      "/media/home/%252e%252e/secret.mp4",
      "/media/home/not-a-video.png",
    ];

    for (const path of invalidPaths) {
      const response = await requestPath(frontend.baseUrl, path);
      assert.equal(response.status, 400, path);
    }

    assert.deepEqual(minioRequests, []);
    assert.deepEqual(backendRequests, []);
  } finally {
    if (frontend) await frontend.stop();
    backend.close();
    minio.close();
  }
});

test("serves static assets locally and proxies dynamic requests to backend", async () => {
  const proxiedRequests = [];
  const backend = http.createServer((req, res) => {
    proxiedRequests.push({
      method: req.method,
      url: req.url,
      cookie: req.headers.cookie,
      contentType: req.headers["content-type"],
    });
    res.setHeader("content-type", "text/plain");
    res.setHeader("set-cookie", "sessionId=abc; Path=/; HttpOnly");
    res.end("proxied");
  });
  const backendPort = await listen(backend);
  const frontend = await startFrontend(`http://127.0.0.1:${backendPort}`);

  try {
    const staticResponse = await fetch(`${frontend.baseUrl}/static/ci/bmw-ci.css`);
    assert.equal(staticResponse.status, 200);
    assert.match(await staticResponse.text(), /:root/);

    const proxyResponse = await fetch(`${frontend.baseUrl}/merch-shop?x=1`, {
      method: "POST",
      headers: {
        cookie: "client=1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    });

    assert.equal(proxyResponse.status, 200);
    assert.equal(await proxyResponse.text(), "proxied");
    assert.equal(proxyResponse.headers.get("set-cookie"), "sessionId=abc; Path=/; HttpOnly");
    assert.deepEqual(proxiedRequests, [
      {
        method: "POST",
        url: "/merch-shop?x=1",
        cookie: "client=1",
        contentType: "application/json",
      },
    ]);
  } finally {
    await frontend.stop();
    backend.close();
  }
});
