const assert = require("node:assert/strict");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const http = require("node:http");
const test = require("node:test");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function rawGet(baseUrl, path) {
  const url = new URL(baseUrl);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        method: "GET",
        path,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(250) });
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error("gateway did not become healthy");
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await once(child, "exit").catch(() => {});
}

function closeServer(server) {
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  server.close();
  return Promise.resolve();
}

async function startGateway(configuratorUrl, merchUrl) {
  const portProbe = http.createServer((_req, res) => res.end());
  const port = await listen(portProbe);
  await new Promise((resolve) => portProbe.close(resolve));

  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      CONFIGURATOR_URL: configuratorUrl,
      MERCH_URL: merchUrl,
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

test("gateway streams configurator asset responses without JSON parsing", async () => {
  const body = Buffer.from([0, 1, 2, 3, 255]);
  const requests = [];
  const configurator = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(206, {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=60",
    });
    res.end(body);
  });
  const merch = http.createServer((_req, res) => res.writeHead(404).end());
  const configuratorPort = await listen(configurator);
  const merchPort = await listen(merch);
  const gateway = await startGateway(`http://127.0.0.1:${configuratorPort}`, `http://127.0.0.1:${merchPort}`);

  try {
    const response = await fetch(`${gateway.baseUrl}/api/configurator/assets/configurator/6_front.jpg`, {
      signal: AbortSignal.timeout(2000),
    });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
    assert.deepEqual(requests, ["/assets/configurator/6_front.jpg"]);
  } finally {
    await gateway.stop();
    await closeServer(configurator);
    await closeServer(merch);
  }
});

test("gateway streams merch asset responses without JSON parsing", async () => {
  const body = Buffer.from("avif-bytes");
  const configurator = http.createServer((_req, res) => res.writeHead(404).end());
  const requests = [];
  const merch = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, {
      "content-type": "image/avif",
      "cache-control": "public, max-age=120",
    });
    res.end(body);
  });
  const configuratorPort = await listen(configurator);
  const merchPort = await listen(merch);
  const gateway = await startGateway(`http://127.0.0.1:${configuratorPort}`, `http://127.0.0.1:${merchPort}`);

  try {
    const response = await fetch(`${gateway.baseUrl}/api/merch/assets/merch-shop/BMW_Merchandise_weiss.avif`, {
      signal: AbortSignal.timeout(2000),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/avif");
    assert.equal(response.headers.get("cache-control"), "public, max-age=120");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
    assert.deepEqual(requests, ["/assets/merch-shop/BMW_Merchandise_weiss.avif"]);
  } finally {
    await gateway.stop();
    await closeServer(configurator);
    await closeServer(merch);
  }
});

test("gateway rejects encoded configurator asset traversal before upstream fetch", async () => {
  const requests = [];
  const configurator = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end("should not be fetched");
  });
  const merch = http.createServer((_req, res) => res.writeHead(404).end());
  const configuratorPort = await listen(configurator);
  const merchPort = await listen(merch);
  const gateway = await startGateway(`http://127.0.0.1:${configuratorPort}`, `http://127.0.0.1:${merchPort}`);

  try {
    const response = await rawGet(gateway.baseUrl, "/api/configurator/assets/configurator/sub/%2e%2e/6_front.jpg");

    assert.equal(response.status, 400);
    assert.deepEqual(requests, []);
  } finally {
    await gateway.stop();
    await closeServer(configurator);
    await closeServer(merch);
  }
});

test("gateway rejects encoded merch asset traversal before upstream fetch", async () => {
  const configurator = http.createServer((_req, res) => res.writeHead(404).end());
  const requests = [];
  const merch = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { "content-type": "image/avif" });
    res.end("should not be fetched");
  });
  const configuratorPort = await listen(configurator);
  const merchPort = await listen(merch);
  const gateway = await startGateway(`http://127.0.0.1:${configuratorPort}`, `http://127.0.0.1:${merchPort}`);

  try {
    const response = await rawGet(gateway.baseUrl, "/api/merch/assets/merch-shop/sub/%2e%2e/cap.avif");

    assert.equal(response.status, 400);
    assert.deepEqual(requests, []);
  } finally {
    await gateway.stop();
    await closeServer(configurator);
    await closeServer(merch);
  }
});
