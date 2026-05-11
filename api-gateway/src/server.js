const path = require("path");
const fs = require("fs");
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

app.get("/merch-shop/:productId", async (req, res) => {
  try {
    const [productResponse, productsResponse] = await Promise.all([
      fetch(`${MERCH}/products/${encodeURIComponent(req.params.productId)}`),
      fetch(`${MERCH}/products`),
    ]);

    if (productResponse.status === 404) {
      return res.status(404).render("merch-product", {
        layout: "layouts/main",
        title: "Produkt nicht gefunden",
        activePage: "merch",
        navVariant: "solid",
        product: null,
        products: [],
      });
    }

    const product = await productResponse.json();
    const products = productsResponse.ok ? await productsResponse.json() : [];

    if (!productResponse.ok) {
      return res.status(productResponse.status).send(product.error || "merch-shop service unavailable");
    }

    res.render("merch-product", {
      layout: "layouts/main",
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

async function proxyJson(res, request) {
  try {
    const upstream = await request();
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/destinations", (_req, res) => {
  res.json(DESTINATIONS);
});

app.get("/api/configurator/models", (_req, res) => {
  proxyJson(res, () => fetch(`${CONFIGURATOR}/models`));
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

app.listen(port, () => console.log(`API gateway listening on port ${port}`));
