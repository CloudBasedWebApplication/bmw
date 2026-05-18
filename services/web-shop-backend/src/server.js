const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const express = require("express");

const app = express();
const port = process.env.PORT || 3006;

function resolveRepoRoot() {
  const candidates = [
    process.env.REPO_ROOT,
    path.resolve(__dirname, "..", "..", ".."),
    path.resolve(process.cwd(), "..", ".."),
    path.resolve(process.cwd(), ".."),
    process.cwd(),
  ].filter(Boolean);

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "web", "views"))
  );
}

const REPO_ROOT = resolveRepoRoot();

if (!REPO_ROOT) {
  throw new Error("Could not locate shared web/views directory");
}

const WEB_ROOT = path.join(REPO_ROOT, "web");
const VIEWS_ROOT = path.join(WEB_ROOT, "views");
const API_GATEWAY = process.env.API_GATEWAY_URL || "http://api-gateway:3000";

app.set("view engine", "ejs");
app.set("views", VIEWS_ROOT);
app.disable("view cache");
app.use("/api", express.json());

function renderPage(res, view, locals = {}) {
  ejs.renderFile(path.join(VIEWS_ROOT, `${view}.ejs`), locals, {}, (viewErr, body) => {
    if (viewErr) {
      return res.status(500).send(viewErr.message);
    }

    res.render(path.join("layouts", "main"), { ...locals, body }, (layoutErr, html) => {
      if (layoutErr) {
        return res.status(500).send(layoutErr.message);
      }

      return res.send(html);
    });
  });
}

function getConfiguratorInitialSelection(req) {
  const routeSelection = req.params.model
    ? {
        model: req.params.model,
        color: req.params.color || null,
        interior: req.params.interior || null,
        wheels: req.params.wheels || null,
      }
    : null;

  const legacyQuerySelection = req.query.model || req.query.color || req.query.interior || req.query.wheels
    ? {
        model: req.query.model || null,
        color: req.query.color || null,
        interior: req.query.interior || null,
        wheels: req.query.wheels || null,
      }
    : null;

  return routeSelection || legacyQuerySelection || null;
}

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function forwardSetCookieHeaders(upstream, res) {
  const cookies = readSetCookieHeaders(upstream.headers);
  if (cookies.length > 0) {
    res.setHeader("set-cookie", cookies);
  }
}

function normalizeAssetApiPathFromRequest(req) {
  const rawUrl = String(req.originalUrl || "");
  const [rawPath, rawQuery] = rawUrl.split("?", 2);
  const supportedPrefixes = [
    "/api/configurator/assets",
    "/api/merch/assets",
  ];
  const publicPrefix = supportedPrefixes.find((prefix) => rawPath.startsWith(`${prefix}/`));

  if (!publicPrefix) {
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

  return `${publicPrefix}/${encodedSegments.join("/")}${rawQuery ? `?${rawQuery}` : ""}`;
}

function isAssetApiPath(req) {
  return /^\/api\/(?:configurator|merch)\/assets(?:\/|$)/.test(
    String(req.originalUrl || "").split("?")[0]
  );
}

function buildApiGatewayUrl(req) {
  const assetPath = normalizeAssetApiPathFromRequest(req);

  if (assetPath) {
    return new URL(assetPath, API_GATEWAY);
  }

  if (isAssetApiPath(req)) {
    return null;
  }

  return new URL(req.originalUrl, API_GATEWAY);
}

async function forwardToApiGateway(req, res) {
  try {
    const upstreamUrl = buildApiGatewayUrl(req);

    if (!upstreamUrl) {
      return res.status(400).json({ error: "invalid asset key" });
    }

    const headers = {};

    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie;
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      headers["content-type"] = "application/json";
    }

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body || {}),
    });

    res.status(upstream.status);
    forwardSetCookieHeaders(upstream, res);

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

app.all(/^\/api(?:\/.*)?$/, forwardToApiGateway);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "web-shop-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get(["/", "/index.html"], (_req, res) => {
  renderPage(res, "home", {
    title: "Bayerische Motoren Werke AG | Home",
    activePage: "home",
    navVariant: "transparent",
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

app.get("/home", (_req, res) => {
  res.redirect(301, "/");
});

app.get("/road-to-supercar", (_req, res) => {
  res.redirect(301, "/");
});

function renderConfigurator(req, res) {
  renderPage(res, "car-configurator", {
    title: "BMW Konfigurator",
    activePage: "configurator",
    navVariant: "solid",
    initialSelection: getConfiguratorInitialSelection(req),
  });
}

app.get("/car-configurator", renderConfigurator);
app.get("/car-configurator/:model/:color/:interior/:wheels", renderConfigurator);

app.get("/merch-shop", async (_req, res) => {
  try {
    const response = await fetch(new URL("/api/merch/products", API_GATEWAY));
    const products = await response.json();
    renderPage(res, "merch-shop", {
      title: "BMW Merch Shop",
      activePage: "merch",
      navVariant: "solid",
      products,
    });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/merch-shop/:productId", async (req, res) => {
  try {
    const [productResponse, productsResponse] = await Promise.all([
      fetch(new URL(`/api/merch/products/${encodeURIComponent(req.params.productId)}`, API_GATEWAY)),
      fetch(new URL("/api/merch/products", API_GATEWAY)),
    ]);

    if (productResponse.status === 404) {
      return renderPage(res, "merch-product", {
        title: "Produkt nicht gefunden",
        activePage: "merch",
        navVariant: "solid",
        product: null,
        products: [],
      });
    }

    if (!productResponse.ok) {
      const body = await productResponse.json().catch(() => ({}));
      return res.status(productResponse.status).send(body.error || "merch-shop service unavailable");
    }

    const product = await productResponse.json();
    const products = productsResponse.ok ? await productsResponse.json() : [];

    renderPage(res, "merch-product", {
      title: `${product.name} | BMW Merch Shop`,
      activePage: "merch",
      navVariant: "solid",
      product,
      products,
    });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/ai-feature", (_req, res) => {
  renderPage(res, "ai-feature", {
    title: "BMW KI Beratung",
    activePage: "ai",
    navVariant: "solid",
  });
});

app.get("/shopping-cart", (_req, res) => {
  renderPage(res, "shopping-cart", {
    title: "BMW Warenkorb",
    activePage: "cart",
    navVariant: "solid",
  });
});

app.get("/impressum", (_req, res) => {
  renderPage(res, "impressum", {
    title: "BMW Impressum",
    activePage: null,
    navVariant: "solid",
  });
});

app.listen(port, () => console.log(`web-shop-backend listening on port ${port}`));
