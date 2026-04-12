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

const minioPublicUrl = `http://localhost:${process.env.MINIO_PORT || 9000}/${process.env.MINIO_BUCKET || "configurator-images"}`;

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
    accent: "dark",
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
    description: "Warenkorb fuer Merchandise und spaetere Fahrzeug-Snapshots.",
    views: "../services/shopping-cart/views",
    accent: "primary",
  },
];

function renderServiceView(res, viewsDirectory, locals = {}) {
  const viewsPath = path.join(__dirname, viewsDirectory);

  res.render(path.join(viewsPath, "index"), locals, (err, html) => {
    if (err) {
      return res.status(500).send(err.message);
    }

    return res.send(html);
  });
}

app.get(["/", "/index.html"], (req, res) => {
  res.render("index", {
    title: "BMW API Gateway",
    headline: "BMW API Gateway",
    message: "Die Startseite buendelt alle Services, Infrastrukturinfos und die wichtigsten Einstiege an einem Ort.",
    services: serviceCatalog,
    infrastructure: [
      { label: "MySQL", value: `${dbConfig.host}:${dbConfig.port}` },
      { label: "MinIO Bucket", value: minioPublicUrl },
      { label: "Gateway Port", value: String(port) },
    ],
  });
});

app.get("/merch-shop", async (_req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [products] = await conn.query("SELECT * FROM merch_shop ORDER BY id");
    await conn.end();

    renderServiceView(res, "../services/merch-shop/views", { products });
  } catch (err) {
    res.status(500).send("Datenbankfehler: " + err.message);
  }
});

app.get("/car-configurator", (_req, res) => {
  renderServiceView(res, "../services/car-configurator/views", {
    minioBaseUrl: minioPublicUrl,
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

for (const route of serviceCatalog.filter(({ path: routePath }) => !["/car-configurator", "/merch-shop"].includes(routePath))) {
  app.get(route.path, (_req, res) => {
    renderServiceView(res, route.views);
  });
}

app.listen(port, () => {
  console.log(`API gateway listening on port ${port}`);
});
