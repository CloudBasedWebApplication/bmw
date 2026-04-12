const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 8080;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.disable("view cache");

const dbConfig = {
  host: process.env.MYSQL_HOST || "mysql",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "bmw_user",
  password: process.env.MYSQL_PASSWORD || "change_me",
  database: process.env.MYSQL_DATABASE || "bmw_app",
};

app.get(["/", "/index.html"], (req, res) => {
  res.render("index", {
    title: "BMW Microservice Platform",
    headline: "BMW Microservice Platform",
    message: "Diese Startseite wird ueber Node.js mit einer EJS-Datei gerendert."
  });
});

app.get("/merch-shop", async (_req, res) => {
  const viewsPath = path.join(__dirname, "../services/merch-shop/views");
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [products] = await conn.query("SELECT * FROM merch_shop ORDER BY id");
    await conn.end();
    res.render(path.join(viewsPath, "index"), { products }, (err, html) => {
      if (err) return res.status(500).send(err.message);
      res.send(html);
    });
  } catch (err) {
    res.status(500).send("Datenbankfehler: " + err.message);
  }
});

const serviceRoutes = [
  { path: "/ai-feature",       views: "../services/ai-feature/views" },
  { path: "/car-configurator", views: "../services/car-configurator/views" },
  { path: "/road-to-supercar", views: "../services/road-to-supercar/views" },
  { path: "/shopping-cart",    views: "../services/shopping-cart/views" },
];

for (const route of serviceRoutes) {
  const viewsPath = path.join(__dirname, route.views);
  app.get(route.path, (_req, res) => {
    res.render(path.join(viewsPath, "index"), (err, html) => {
      if (err) return res.status(500).send(err.message);
      res.send(html);
    });
  });
}

app.listen(port, () => {
  console.log(`API gateway listening on port ${port}`);
});
