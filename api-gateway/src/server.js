const path = require("path");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.get(["/", "/index.html"], (req, res) => {
  res.render("index", {
    title: "BMW Microservice Platform",
    headline: "BMW Microservice Platform",
    message: "Diese Startseite wird ueber Node.js mit einer EJS-Datei gerendert."
  });
});

app.listen(port, () => {
  console.log(`API gateway listening on port ${port}`);
});
