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
const MERCH = process.env.MERCH_URL || "http://merch-shop:3002";

app.set("view engine", "ejs");
app.set("views", VIEWS_ROOT);
app.disable("view cache");
app.use("/static", express.static(path.join(WEB_ROOT, "public")));
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

app.get("/car-configurator", (req, res) => {
  renderPage(res, "car-configurator", {
    title: "BMW Konfigurator",
    activePage: "configurator",
    navVariant: "solid",
    initialSelection: getConfiguratorInitialSelection(req),
  });
});

app.get("/car-configurator/:model/:color/:interior/:wheels", (req, res) => {
  renderPage(res, "car-configurator", {
    title: "BMW Konfigurator",
    activePage: "configurator",
    navVariant: "solid",
    initialSelection: getConfiguratorInitialSelection(req),
  });
});

app.get("/merch-shop", async (_req, res) => {
  try {
    const response = await fetch(`${MERCH}/products`);
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

app.listen(port, () => console.log(`web-app listening on port ${port}`));
