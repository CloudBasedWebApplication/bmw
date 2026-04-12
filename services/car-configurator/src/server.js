const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 3001;

const dbConfig = {
  host: process.env.MYSQL_HOST || "mysql",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "bmw_user",
  password: process.env.MYSQL_PASSWORD || "change_me",
  database: process.env.MYSQL_DATABASE || "bmw_app",
};

const minioBase = `http://${process.env.MINIO_PUBLIC_HOST || "localhost"}:${process.env.MINIO_PORT || 9000}/${process.env.MINIO_BUCKET || "configurator-images"}`;

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/models", async (_req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query("SELECT id, code, name, package_name AS packageName, base_price AS basePrice FROM car_models ORDER BY id");
    await conn.end();
    res.json(rows.map((m) => ({ ...m, basePrice: parseFloat(m.basePrice) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/configure", async (req, res) => {
  const { model, color } = req.query;
  if (!model || !color) {
    return res.status(400).json({ error: "model and color are required" });
  }
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query(
      `SELECT m.code, m.name, m.package_name AS packageName, m.base_price AS basePrice,
              c.color, c.image_key, c.image_key_back, c.image_key_wheels,
              c.price_modifier, c.advantages, c.disadvantages
       FROM car_combinations c
       JOIN car_models m ON c.model_id = m.id
       WHERE m.code = ? AND c.color = ?`,
      [model, color]
    );
    await conn.end();
    if (!rows.length) return res.status(404).json({ error: "Combination not found" });
    const r = rows[0];
    res.json({
      model: r.code,
      modelName: r.name,
      packageName: r.packageName,
      color: r.color,
      price: parseFloat(r.basePrice) + parseFloat(r.price_modifier),
      imageUrl:       `${minioBase}/${r.image_key}`,
      imageUrlBack:   r.image_key_back   ? `${minioBase}/${r.image_key_back}`   : null,
      imageUrlWheels: r.image_key_wheels ? `${minioBase}/${r.image_key_wheels}` : null,
      advantages:    r.advantages    ? r.advantages.split(",")    : [],
      disadvantages: r.disadvantages ? r.disadvantages.split(",") : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`car-configurator listening on port ${port}`));
