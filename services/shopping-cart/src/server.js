const express = require("express");
const cartRoutes = require("./cartRoutes");

const app = express();
const port = process.env.PORT || 3005;

app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/cart", cartRoutes);

app.listen(port, () => console.log(`shopping-cart listening on port ${port}`));
