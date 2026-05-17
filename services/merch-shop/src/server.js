const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 3002;

const dbConfig = {
  host: process.env.MYSQL_HOST || "mysql",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "bmw_user",
  password: process.env.MYSQL_PASSWORD || "change_me",
  database: "bmw_merch_shop",
  charset: "utf8mb4",
};

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveMinioPublicBaseUrl() {
  if (process.env.MINIO_PUBLIC_URL) {
    return trimTrailingSlash(process.env.MINIO_PUBLIC_URL);
  }

  return "/minio";
}

const minioBase = `${resolveMinioPublicBaseUrl()}/${process.env.MINIO_BUCKET || "configurator-images"}`;

function createProductSlug(product) {
  return `${product.name || ""}-${product.color || ""}`
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "und")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProductKey(value) {
  return String(value || "")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function loadProducts() {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.query("SELECT * FROM merch_shop ORDER BY id");
  await conn.end();

  return rows.map((p) => ({
    ...p,
    price: parseFloat(p.price),
    slug: createProductSlug(p),
    imageUrl: `${minioBase}/${p.minioObject}`,
  }));
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/products", async (_req, res) => {
  try {
    const products = await loadProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/products/:productId", async (req, res) => {
  try {
    const requestedId = String(req.params.productId).toLowerCase();
    const requestedKey = normalizeProductKey(req.params.productId);
    const products = await loadProducts();
    const product = products.find((p) =>
      String(p.id) === requestedId ||
      String(p.slug).toLowerCase() === requestedId ||
      normalizeProductKey(p.slug) === requestedKey ||
      normalizeProductKey(p.slug).endsWith(requestedKey)
    );

    if (!product) {
      return res.status(404).json({ error: "product not found" });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`merch-shop listening on port ${port}`));
