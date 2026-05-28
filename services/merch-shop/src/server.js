const express = require("express");
const mysql = require("mysql2/promise");
const {
  buildMerchAssetUrl,
  encodeObjectKey,
  normalizeMerchAssetKey,
} = require("./asset-paths");

const app = express();
const port = process.env.PORT || 3002;

function requiredEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
  return process.env[name];
}

const dbConfig = {
  host: requiredEnv("MYSQL_HOST"),
  port: process.env.MYSQL_PORT || 3306,
  user: requiredEnv("MYSQL_USER"),
  password: requiredEnv("MYSQL_PASSWORD"),
  database: "bmw_merch_shop",
  charset: "utf8mb4",
};

const MINIO_BUCKET = process.env.MINIO_BUCKET || "configurator-images";
const MINIO_BASE = `http://${process.env.MINIO_ENDPOINT || "minio"}:${process.env.MINIO_PORT || 9000}`;

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
    imageUrl: buildMerchAssetUrl(p.minioObject),
  }));
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get(/^\/assets\/(.+)$/, async (req, res) => {
  const objectKey = normalizeMerchAssetKey(req.params[0]);

  if (!objectKey) {
    return res.status(400).json({ error: "invalid asset key" });
  }

  try {
    const upstream = await fetch(`${MINIO_BASE}/${encodeURIComponent(MINIO_BUCKET)}/${encodeObjectKey(objectKey)}`);
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
});

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
