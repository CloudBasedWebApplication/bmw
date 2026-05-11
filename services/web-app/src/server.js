const path = require("path");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");

const app = express();
const port = process.env.PORT || 3006;

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, "..", "..", "..");
const API_GATEWAY = process.env.API_GATEWAY_URL || "http://api-gateway:3000";
const MERCH = process.env.MERCH_URL || "http://merch-shop:3002";

app.set("view engine", "ejs");
app.set("views", path.join(REPO_ROOT, "web", "views"));
app.use(expressLayouts);
app.set("layout", false);
app.disable("view cache");

app.use("/static", express.static(path.join(REPO_ROOT, "web", "public")));
app.use("/api", express.json());

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
  res.render("home", {
    layout: "layouts/main",
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
  res.render("car-configurator", {
    layout: "layouts/main",
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
    const response = await fetch(`${MERCH}/products`);
    const products = await response.json();
    res.render("merch-shop", {
      layout: "layouts/main",
      title: "BMW Merch Shop",
      activePage: "merch",
      navVariant: "solid",
      products,
    });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/ai-feature", (_req, res) => {
  res.render("ai-feature", {
    layout: "layouts/main",
    title: "BMW KI Beratung",
    activePage: "ai",
    navVariant: "solid",
  });
});

app.get("/shopping-cart", (_req, res) => {
  res.render("shopping-cart", {
    layout: "layouts/main",
    title: "BMW Warenkorb",
    activePage: "cart",
    navVariant: "solid",
  });
});

app.listen(port, () => console.log(`web-app listening on port ${port}`));
