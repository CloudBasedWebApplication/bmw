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

async function startFrontend(backendUrl) {
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
