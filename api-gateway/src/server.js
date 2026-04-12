const path = require("path");
const express = require("express");

const app = express();
const port = process.env.PORT || 8080;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.get(["/", "/index.html"], (req, res) => {
  res.render("index", {
    title: "BMW Microservice Platform",
    headline: "BMW Microservice Platform",
    message: "Diese Startseite wird ueber Node.js mit einer EJS-Datei gerendert."
  });
});

const serviceRoutes = [
  { path: "/ai-feature",       views: "../../services/ai-feature/views" },
  { path: "/car-configurator", views: "../../services/car-configurator/views" },
  { path: "/merch-shop",       views: "../../services/merch-shop/views" },
  { path: "/road-to-supercar", views: "../../services/road-to-supercar/views" },
  { path: "/shopping-cart",    views: "../../services/shopping-cart/views" },
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
