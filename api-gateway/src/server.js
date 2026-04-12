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

// ── Page routes ──────────────────────────────────────────────────────────────

app.get(["/", "/index.html"], (_req, res) => {
  res.render("index", {
    title: "BMW Microservice Platform",
    headline: "BMW Microservice Platform",
    message: "Diese Startseite wird ueber Node.js mit einer EJS-Datei gerendert.",
  });
});

app.get("/car-configurator", (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/car-configurator/views");
  res.render(path.join(viewsPath, "index"), (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
  });
});

app.get("/merch-shop", async (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/merch-shop/views");
  try {
    const response = await fetch(`${MERCH}/products`);
    const products = await response.json();
    res.render(path.join(viewsPath, "index"), { products }, (err, html) => {
      if (err) return res.status(500).send(err.message);
      res.send(html);
    });
  } catch (err) {
    res.status(502).send("merch-shop service unavailable: " + err.message);
  }
});

app.get("/shopping-cart", (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/shopping-cart/views");
  res.render(path.join(viewsPath, "index"), (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
  });
});

app.get("/ai-feature", (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/ai-feature/views");
  res.render(path.join(viewsPath, "index"), (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
  });
});

app.get("/road-to-supercar", (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/road-to-supercar/views");
  res.render(path.join(viewsPath, "index"), {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  }, (err, html) => {
    if (err) return res.status(500).send(err.message);
    res.send(html);
  });
});

// ── API proxy routes ─────────────────────────────────────────────────────────

app.get("/api/configurator/models", async (_req, res) => {
  try {
    const r = await fetch(`${CONFIGURATOR}/models`);
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
