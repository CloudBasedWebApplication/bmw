const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.disable("view cache");
app.use(express.json());
app.use(cookieParser());

// Static assets for road-to-supercar (e.g. BMW CI fonts)
app.use(
  "/road-to-supercar/static",
  express.static(path.join(__dirname, "..", "services", "road-to-supercar", "public"))
);

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
  {
    path: "/car-configurator",
    name: "Car Configurator",
    description: "Fahrzeugkonfigurationen mit Variantenlogik, Bildausgabe und MinIO-Anbindung.",
    views: "../services/car-configurator/views",
    accent: "primary",
  },
  {
    path: "/merch-shop",
    name: "Merch Shop",
    description: "BMW Merchandise aus MySQL inklusive Produktdaten und Bildreferenzen.",
    views: "../services/merch-shop/views",
    accent: "primary",
  },
  {
    path: "/ai-feature",
    name: "AI Feature",
    description: "Empfehlungen und Shopping-Unterstuetzung als eigener Microservice.",
    views: "../services/ai-feature/views",
    accent: "light",
  },
  {
    path: "/road-to-supercar",
    name: "Road To Supercar",
    description: "Showroom- und Erlebnisansicht fuer die BMW-Plattform.",
    views: "../services/road-to-supercar/views",
    accent: "light",
  },
  {
    path: "/shopping-cart",
    name: "Shopping Cart",
    description: "Warenkorb fuer Merchandise und Fahrzeug-Snapshots.",
    views: "../services/shopping-cart/views",
    accent: "primary",
  },
];

function renderServiceView(res, viewsDirectory, locals = {}) {
  const viewsPath = path.join(__dirname, viewsDirectory);
  res.render(path.join(viewsPath, "index"), locals, (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
  });
}

// ── Page routes ──────────────────────────────────────────────────────────────

app.get(["/", "/index.html"], (_req, res) => {
  res.render("index", {
    title: "BMW API Gateway",
    headline: "BMW API Gateway",
    message: "Die Startseite buendelt alle Services, Infrastrukturinfos und die wichtigsten Einstiege an einem Ort.",
    services: serviceCatalog,
    infrastructure: [
      { label: "MinIO", value: `localhost:${process.env.MINIO_PORT || 9000}/${process.env.MINIO_BUCKET || "configurator-images"}` },
      { label: "Gateway Port", value: String(port) },
    ],
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    routes: serviceCatalog.map(({ path: routePath, name }) => ({ path: routePath, name })),
  });
});

app.get("/car-configurator", (_req, res) => {
  renderServiceView(res, "../services/car-configurator/views");
});

app.get("/merch-shop", async (_req, res) => {
  try {
    const response = await fetch(`${MERCH}/products`);
    const products = await response.json();
    renderServiceView(res, "../services/merch-shop/views", { products });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/road-to-supercar", (_req, res) => {
  renderServiceView(res, "../services/road-to-supercar/views", {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

// Remaining service views load their data client-side
for (const route of serviceCatalog.filter(({ path: p }) => !["/car-configurator", "/merch-shop", "/road-to-supercar"].includes(p))) {
  app.get(route.path, (_req, res) => renderServiceView(res, route.views));
}

// ── API proxy routes ─────────────────────────────────────────────────────────

const DESTINATIONS = [
  { label: "BMW Welt München",          value: "BMW Welt München,Germany" },
  { label: "BMW Werk Leipzig",          value: "BMW Group Werk Leipzig,Germany" },
  { label: "BMW Museum München",        value: "BMW Museum München,Germany" },
  { label: "BMW Niederlassung Berlin",  value: "BMW Niederlassung Berlin,Germany" },
  { label: "BMW Niederlassung Hamburg", value: "BMW Niederlassung Hamburg,Germany" },
  { label: "BMW Niederlassung Frankfurt", value: "BMW Niederlassung Frankfurt,Germany" },
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
