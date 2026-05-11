const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 3002;

const dbConfig = {
  host: process.env.MYSQL_HOST || "mysql",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "bmw_user",
  password: process.env.MYSQL_PASSWORD || "change_me",
  database: process.env.MYSQL_DATABASE || "bmw_app",
  charset: "utf8mb4",
};

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveMinioPublicBaseUrl() {
  // Auto-detect GitHub Codespace first (takes precedence)
  if (process.env.CODESPACE_NAME) {
    return `https://${process.env.CODESPACE_NAME}-9000.app.github.dev`;
  }

  if (process.env.MINIO_PUBLIC_URL) {
    return trimTrailingSlash(process.env.MINIO_PUBLIC_URL);
  }

  const protocol = process.env.MINIO_PUBLIC_PROTOCOL || "http";
  const host = process.env.MINIO_PUBLIC_HOST || "localhost";
  const port = process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || 9000;

  return `${protocol}://${host}${port ? `:${port}` : ""}`;
}

const minioBase = `${resolveMinioPublicBaseUrl()}/${process.env.MINIO_BUCKET || "configurator-images"}`;

function normalizeSlugPart(value) {
  return String(value || "")
    .replace(/ÃŸ/g, "ss")
    .replace(/Ã¼/g, "ue")
    .replace(/Ã¶/g, "oe")
    .replace(/Ã¤/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/^bmw\s+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function productSlug(product) {
  return `${normalizeSlugPart(product.name)}${normalizeSlugPart(product.color)}`;
}

function mapProduct(product) {
  let sizes = product.sizes
    ? product.sizes.split(",").map((size) => size.trim()).filter(Boolean)
    : [];

  if (String(product.name || "").toLowerCase().includes("hülle")) {
    sizes = [
      ...sizes,
      "Samsung Galaxy S25",
      "Samsung Galaxy S24",
      "Google Pixel 9 Pro",
      "Google Pixel 8",
    ];
  }

  return {
    ...product,
    price: parseFloat(product.price),
    sizes,
    slug: productSlug(product),
    imageUrl: `${minioBase}/${product.minioObject}`,
  };
}

async function getProducts() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query("SELECT * FROM merch_shop ORDER BY id");
    return rows.map(mapProduct);
  } finally {
    await conn.end();
  }
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/products", async (_req, res) => {
  try {
    res.json(await getProducts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/products/:productId", async (req, res) => {
  try {
    const productId = String(req.params.productId || "").toLowerCase();
    const products = await getProducts();
    const product = products.find((candidate) =>
      String(candidate.id) === productId || candidate.slug === productId
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
