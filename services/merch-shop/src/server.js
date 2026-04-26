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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/products", async (_req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query("SELECT * FROM merch_shop ORDER BY id");
    await conn.end();
    const products = rows.map((p) => ({
      ...p,
      price: parseFloat(p.price),
      imageUrl: `${minioBase}/${p.minioObject}`,
    }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`merch-shop listening on port ${port}`));
