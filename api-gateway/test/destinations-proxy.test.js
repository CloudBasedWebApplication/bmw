const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }
  });
}

test("gateway proxies destinations to route service", async () => {
  const requests = [];
  const routeService = http.createServer((req, res) => {
    requests.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify([{ id: "bmw-welt", label: "BMW Welt München", value: "BMW Welt München" }]));
  });

  const routePort = await listen(routeService);
  process.env.ROUTE_URL = `http://127.0.0.1:${routePort}`;

  const app = require("../src/server");
  const gatewayServer = app.listen(0, "127.0.0.1");
  const gatewayPort = await new Promise((resolve) => {
    gatewayServer.once("listening", () => resolve(gatewayServer.address().port));
  });

  try {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/destinations`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(requests, ["/destinations"]);
    assert.deepEqual(body, [{ id: "bmw-welt", label: "BMW Welt München", value: "BMW Welt München" }]);
  } finally {
    delete process.env.ROUTE_URL;
    await closeServer(gatewayServer);
    await closeServer(routeService);
  }
});
