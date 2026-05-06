const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");
const expressLayouts = require("express-ejs-layouts");

const app = express();
const port = process.env.PORT || 3000;

function resolveRepoRoot() {
  const candidates = [
    process.env.REPO_ROOT,
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, ".."),
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

app.set("view engine", "ejs");
app.set("views", path.join(REPO_ROOT, "web", "views"));
app.use(expressLayouts);
app.set("layout", false); // opt-in per route via locals.layout
app.disable("view cache");
app.use(express.json());
app.use(cookieParser());

// Shared frontend assets (CI styles, fonts, images) served by the gateway
app.use("/static", express.static(path.join(REPO_ROOT, "web", "public")));

// Service base URLs (container-internal)
const CONFIGURATOR = process.env.CONFIGURATOR_URL || "http://car-configurator:3001";
const MERCH        = process.env.MERCH_URL        || "http://merch-shop:3002";
const CART         = process.env.CART_URL         || "http://shopping-cart:3005";
const AI           = process.env.AI_URL           || "http://ai-feature:3004";

// Ensure every request has a session cookie for cart tracking
app.use((req, res, next) => {
  if (!req.cookies.sessionId) {
    res.cookie("sessionId", crypto.randomUUID(), { httpOnly: true });
  }
  next();
});

const serviceCatalog = [
  { path: "/",                  name: "Home" },
  { path: "/car-configurator",  name: "Car Configurator" },
  { path: "/merch-shop",        name: "Merch Shop" },
  { path: "/ai-feature",        name: "AI Feature" },
  { path: "/shopping-cart",     name: "Shopping Cart" },
];

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

// ── Page routes ──────────────────────────────────────────────────────────────

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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    routes: serviceCatalog.map(({ path: routePath, name }) => ({ path: routePath, name })),
  });
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

// ── API proxy routes ─────────────────────────────────────────────────────────

const DESTINATIONS = [
  {
    id: "bmw-welt",
    name: "BMW Welt München",
    address: "Am Olympiapark 1, 80809 München",
    destination: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
    label: "BMW Welt München",
    value: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
  },
];

app.get("/api/destinations", (_req, res) => {
  res.json(DESTINATIONS);
});

app.get("/api/configurator/models", async (_req, res) => {
  try {
    const r = await fetch(`${CONFIGURATOR}/models`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/options/colors", async (req, res) => {
  const modelId = req.query.modelId;
  const search = new URLSearchParams();

  if (modelId != null) {
    search.set("modelId", String(modelId));
  }

  try {
    const query = search.toString();
    const r = await fetch(`${CONFIGURATOR}/options/colors${query ? `?${query}` : ""}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/options/wheels", async (req, res) => {
  const modelId = req.query.modelId;
  const search = new URLSearchParams();

  if (modelId != null) {
    search.set("modelId", String(modelId));
  }

  try {
    const query = search.toString();
    const r = await fetch(`${CONFIGURATOR}/options/wheels${query ? `?${query}` : ""}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/options/interiors", async (req, res) => {
  const modelId = req.query.modelId;
  const search = new URLSearchParams();

  if (modelId != null) {
    search.set("modelId", String(modelId));
  }

  try {
    const query = search.toString();
    const r = await fetch(`${CONFIGURATOR}/options/interiors${query ? `?${query}` : ""}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/configurations", async (_req, res) => {
  try {
    const r = await fetch(`${CONFIGURATOR}/configurations`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/configurations/:id", async (req, res) => {
  try {
    const r = await fetch(`${CONFIGURATOR}/configurations/${encodeURIComponent(req.params.id)}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/configurator/configure", async (req, res) => {
  const { model, color } = req.query;
  try {
    const r = await fetch(`${CONFIGURATOR}/configure?model=${encodeURIComponent(model)}&color=${encodeURIComponent(color)}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/configurator/configuration/calculate", async (req, res) => {
  try {
    const r = await fetch(`${CONFIGURATOR}/configuration/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/cart", async (req, res) => {
  const sessionId = req.cookies.sessionId;
  try {
    const r = await fetch(`${CART}/cart/${sessionId}`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/cart/items", async (req, res) => {
  const sessionId = req.cookies.sessionId;
  try {
    const r = await fetch(`${CART}/cart/${sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch("/api/cart/items/:itemId", async (req, res) => {
  const sessionId = req.cookies.sessionId;
  try {
    const r = await fetch(`${CART}/cart/${sessionId}/items/${req.params.itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/cart", async (req, res) => {
  const sessionId = req.cookies.sessionId;
  try {
    const r = await fetch(`${CART}/cart/${sessionId}`, { method: "DELETE" });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/cart/items/:itemId", async (req, res) => {
  const sessionId = req.cookies.sessionId;
  try {
    const r = await fetch(`${CART}/cart/${sessionId}/items/${req.params.itemId}`, {
      method: "DELETE",
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/merch/products", async (_req, res) => {
  try {
    const r = await fetch(`${MERCH}/products`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/ai/recommend", async (req, res) => {
  try {
    const r = await fetch(`${AI}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`API gateway listening on port ${port}`));
