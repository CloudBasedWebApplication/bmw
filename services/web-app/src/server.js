const path = require("path");
const express = require("express");

const app = express();
const port = process.env.PORT || 3006;

app.set("view engine", "ejs");
app.disable("view cache");

const API_GATEWAY = process.env.API_GATEWAY_URL || "http://api-gateway:3000";
const MERCH = process.env.MERCH_URL || "http://merch-shop:3002";

app.use("/home/static", express.static(path.join(__dirname, "..", "..", "home", "public")));
app.use("/road-to-supercar/static", express.static(path.join(__dirname, "..", "..", "home", "public")));
app.use("/api", express.json());

function renderServiceView(res, viewsDirectory, locals = {}) {
  const viewsPath = path.join(__dirname, "..", "..", viewsDirectory);
  res.render(path.join(viewsPath, "index"), locals, (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
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

async function forwardToApiGateway(req, res) {
  try {
    const upstreamUrl = new URL(req.originalUrl, API_GATEWAY);
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

    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    res.send(await upstream.text());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

app.all("/api/*", forwardToApiGateway);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "web-app",
    timestamp: new Date().toISOString(),
  });
});

app.get(["/", "/index.html"], (_req, res) => {
  renderServiceView(res, "home/views", {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

app.get("/home", (_req, res) => {
  res.redirect(301, "/");
});

app.get("/road-to-supercar", (_req, res) => {
  res.redirect(301, "/");
});

app.get("/car-configurator", (req, res) => {
  renderServiceView(res, "car-configurator/views", {
    initialSelection: getConfiguratorInitialSelection(req),
  });
});

app.get("/car-configurator/:model/:color/:interior/:wheels", (req, res) => {
  renderServiceView(res, "car-configurator/views", {
    initialSelection: getConfiguratorInitialSelection(req),
  });
});

app.get("/merch-shop", async (_req, res) => {
  try {
    const response = await fetch(`${MERCH}/products`);
    const products = await response.json();
    renderServiceView(res, "merch-shop/views", { products });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/ai-feature", (_req, res) => {
  renderServiceView(res, "ai-feature/views");
});

app.get("/shopping-cart", (_req, res) => {
  renderServiceView(res, "shopping-cart/views");
});

app.listen(port, () => console.log(`web-app listening on port ${port}`));
