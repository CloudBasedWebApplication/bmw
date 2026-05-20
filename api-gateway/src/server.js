const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// Service base URLs (container-internal)
const CONFIGURATOR = process.env.CONFIGURATOR_URL || "http://car-configurator:3001";
const MERCH = process.env.MERCH_URL || "http://merch-shop:3002";
const CART = process.env.CART_URL || "http://shopping-cart:3005";
const AI = process.env.AI_URL || "http://ai-feature:3004";
const ROUTE = process.env.ROUTE_URL || "http://route-service:3007";

app.use((req, res, next) => {
  if (!req.cookies.sessionId) {
    req.cookies.sessionId = crypto.randomUUID();
    res.cookie("sessionId", req.cookies.sessionId, { httpOnly: true });
  }
  next();
});

// ── API proxy routes ─────────────────────────────────────────────────────────

async function proxyJson(res, request) {
  try {
    const upstream = await request();
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

async function proxyBinary(res, request) {
  try {
    const upstream = await request();
    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      res.setHeader("cache-control", cacheControl);
    }

    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

function normalizeAssetPathFromRequest(req, publicPrefix) {
  const rawPath = String(req.originalUrl || "").split("?")[0];

  if (!rawPath.startsWith(`${publicPrefix}/`)) {
    return null;
  }

  const rawSegments = rawPath.slice(publicPrefix.length + 1).split("/");
  const encodedSegments = [];

  for (const rawSegment of rawSegments) {
    if (!rawSegment || rawSegment === "." || rawSegment === "..") {
      return null;
    }

    let decodedSegment;
    try {
      decodedSegment = decodeURIComponent(rawSegment);
    } catch (_err) {
      return null;
    }

    if (
      !decodedSegment ||
      decodedSegment === "." ||
      decodedSegment === ".." ||
      decodedSegment.includes("/") ||
      decodedSegment.includes("\\")
    ) {
      return null;
    }

    encodedSegments.push(encodeURIComponent(decodedSegment));
  }

  return encodedSegments.join("/");
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/destinations", (_req, res) => {
  proxyJson(res, () => fetch(`${ROUTE}/destinations`));
});

app.get("/api/configurator/models", (_req, res) => {
  proxyJson(res, () => fetch(`${CONFIGURATOR}/models`));
});

app.get(/^\/api\/configurator\/assets\/.+$/, (req, res) => {
  const assetPath = normalizeAssetPathFromRequest(req, "/api/configurator/assets");

  if (!assetPath) {
    return res.status(400).json({ error: "invalid asset key" });
  }

  proxyBinary(res, () => fetch(`${CONFIGURATOR}/assets/${assetPath}`));
});

app.get("/api/configurator/options/colors", (req, res) => {
  const search = new URLSearchParams();

  if (req.query.modelId != null) {
    search.set("modelId", String(req.query.modelId));
  }

  const query = search.toString();
  proxyJson(res, () => fetch(`${CONFIGURATOR}/options/colors${query ? `?${query}` : ""}`));
});

app.get("/api/configurator/options/wheels", (req, res) => {
  const search = new URLSearchParams();

  if (req.query.modelId != null) {
    search.set("modelId", String(req.query.modelId));
  }

  const query = search.toString();
  proxyJson(res, () => fetch(`${CONFIGURATOR}/options/wheels${query ? `?${query}` : ""}`));
});

app.get("/api/configurator/options/interiors", (req, res) => {
  const search = new URLSearchParams();

  if (req.query.modelId != null) {
    search.set("modelId", String(req.query.modelId));
  }

  const query = search.toString();
  proxyJson(res, () => fetch(`${CONFIGURATOR}/options/interiors${query ? `?${query}` : ""}`));
});

app.get("/api/configurator/configurations", (_req, res) => {
  proxyJson(res, () => fetch(`${CONFIGURATOR}/configurations`));
});

app.get("/api/configurator/configurations/:id", (req, res) => {
  proxyJson(res, () => fetch(`${CONFIGURATOR}/configurations/${encodeURIComponent(req.params.id)}`));
});

app.get("/api/configurator/configure", (req, res) => {
  const search = new URLSearchParams();

  if (req.query.model != null) {
    search.set("model", String(req.query.model));
  }

  if (req.query.color != null) {
    search.set("color", String(req.query.color));
  }

  const query = search.toString();
  proxyJson(res, () => fetch(`${CONFIGURATOR}/configure${query ? `?${query}` : ""}`));
});

app.post("/api/configurator/configuration/calculate", (req, res) => {
  proxyJson(res, () =>
    fetch(`${CONFIGURATOR}/configuration/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
  );
});

app.get("/api/cart", (req, res) => {
  proxyJson(res, () => fetch(`${CART}/cart/${req.cookies.sessionId}`));
});

app.post("/api/cart/items", (req, res) => {
  proxyJson(res, () =>
    fetch(`${CART}/cart/${req.cookies.sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
  );
});

app.patch("/api/cart/items/:itemId", (req, res) => {
  proxyJson(res, () =>
    fetch(`${CART}/cart/${req.cookies.sessionId}/items/${encodeURIComponent(req.params.itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
  );
});

app.delete("/api/cart", (req, res) => {
  proxyJson(res, () => fetch(`${CART}/cart/${req.cookies.sessionId}`, { method: "DELETE" }));
});

app.delete("/api/cart/items/:itemId", (req, res) => {
  proxyJson(res, () =>
    fetch(`${CART}/cart/${req.cookies.sessionId}/items/${encodeURIComponent(req.params.itemId)}`, {
      method: "DELETE",
    })
  );
});

app.get("/api/merch/products", (_req, res) => {
  proxyJson(res, () => fetch(`${MERCH}/products`));
});

app.get(/^\/api\/merch\/assets\/.+$/, (req, res) => {
  const assetPath = normalizeAssetPathFromRequest(req, "/api/merch/assets");

  if (!assetPath) {
    return res.status(400).json({ error: "invalid asset key" });
  }

  proxyBinary(res, () => fetch(`${MERCH}/assets/${assetPath}`));
});

app.get("/api/merch/products/:productId", (req, res) => {
  proxyJson(res, () => fetch(`${MERCH}/products/${encodeURIComponent(req.params.productId)}`));
});

app.post("/api/ai/recommend", (req, res) => {
  proxyJson(res, () =>
    fetch(`${AI}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
  );
});

if (require.main === module) {
  app.listen(port, () => console.log(`API gateway listening on port ${port}`));
}

module.exports = app;
