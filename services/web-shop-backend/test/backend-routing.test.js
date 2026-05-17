const assert = require("node:assert/strict");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
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
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(250),
      });
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error("server did not become healthy");
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await once(child, "exit").catch(() => {});
}

async function startBackend(apiGatewayUrl) {
  const portProbe = http.createServer((_req, res) => res.end());
  const port = await listen(portProbe);
  await new Promise((resolve) => portProbe.close(resolve));
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      API_GATEWAY_URL: apiGatewayUrl,
      REPO_ROOT: path.resolve(process.cwd(), "..", ".."),
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

test("health identifies the web shop backend", async () => {
  const apiGateway = http.createServer((_req, res) => {
    res.writeHead(404).end();
  });
  let backend;

  try {
    const apiGatewayPort = await listen(apiGateway);
    backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);
    const response = await fetch(`${backend.baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.service, "web-shop-backend");
  } finally {
    if (backend) await backend.stop();
    apiGateway.close();
  }
});

test("merch listing SSR fetches products through the API gateway", async () => {
  const requests = [];
  const apiGateway = http.createServer((req, res) => {
    requests.push(req.url);

    if (req.url === "/api/merch/products") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify([
        {
          id: 1,
          slug: "bmw-cap",
          name: "BMW Cap",
          category: "accessories",
          price: 29.9,
          imageUrl: "/api/merch/assets/merch-shop/cap.avif",
          description: "Cap",
          color: "Black",
        },
      ]));
      return;
    }

    res.writeHead(404).end(JSON.stringify({ error: "not found" }));
  });
  const apiGatewayPort = await listen(apiGateway);
  const backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);

  try {
    const response = await fetch(`${backend.baseUrl}/merch-shop`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /BMW Cap/);
    assert.deepEqual(requests, ["/api/merch/products"]);
  } finally {
    await backend.stop();
    apiGateway.close();
  }
});

test("backend does not expose the legacy minio proxy", async () => {
  const apiGateway = http.createServer((_req, res) => {
    res.writeHead(404).end();
  });
  const apiGatewayPort = await listen(apiGateway);
  const backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);

  try {
    const response = await fetch(`${backend.baseUrl}/minio/configurator-images/home/bmw_ai.png`);

    assert.equal(response.status, 404);
  } finally {
    await backend.stop();
    apiGateway.close();
  }
});

test("api forwarding preserves multiple set-cookie headers from the gateway", async () => {
  const apiGateway = http.createServer((req, res) => {
    assert.equal(req.url, "/api/cart");
    res.setHeader("content-type", "application/json");
    res.setHeader("set-cookie", [
      "sessionId=abc; Path=/; HttpOnly",
      "cartHint=full; Path=/; SameSite=Lax",
    ]);
    res.end(JSON.stringify({ ok: true }));
  });
  const apiGatewayPort = await listen(apiGateway);
  const backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);

  try {
    const response = await fetch(`${backend.baseUrl}/api/cart`);
    const setCookie = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie").split(/,\s*(?=[^;]+=)/);

    assert.equal(response.status, 200);
    assert.deepEqual(setCookie, [
      "sessionId=abc; Path=/; HttpOnly",
      "cartHint=full; Path=/; SameSite=Lax",
    ]);
  } finally {
    await backend.stop();
    apiGateway.close();
  }
});

test("api forwarding preserves binary asset response metadata and body", async () => {
  const body = Buffer.from([0, 1, 2, 3, 255]);
  const apiGateway = http.createServer((req, res) => {
    assert.equal(req.url, "/api/merch/assets/merch-shop/cap.avif");
    res.writeHead(200, {
      "content-type": "image/avif",
      "cache-control": "public, max-age=120",
    });
    res.end(body);
  });
  const apiGatewayPort = await listen(apiGateway);
  const backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);

  try {
    const response = await fetch(`${backend.baseUrl}/api/merch/assets/merch-shop/cap.avif`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/avif");
    assert.equal(response.headers.get("cache-control"), "public, max-age=120");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
  } finally {
    await backend.stop();
    apiGateway.close();
  }
});

test("backend rejects encoded configurator asset traversal before gateway fetch", async () => {
  const requests = [];
  const apiGateway = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end("should not be fetched");
  });
  const apiGatewayPort = await listen(apiGateway);
  const backend = await startBackend(`http://127.0.0.1:${apiGatewayPort}`);

  try {
    const response = await rawGet(backend.baseUrl, "/api/configurator/assets/configurator/sub/%2e%2e/6_front.jpg");

    assert.equal(response.status, 400);
    assert.deepEqual(requests, []);
  } finally {
    await backend.stop();
    apiGateway.close();
  }
});
