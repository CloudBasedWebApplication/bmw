const express = require("express");
const { listDestinations } = require("./destinations");

const app = express();
const port = process.env.PORT || 3007;

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "route-service",
    timestamp: new Date().toISOString(),
  });
});

app.get("/destinations", async (_req, res) => {
  try {
    const destinations = await listDestinations();
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`route-service listening on port ${port}`));
}

module.exports = app;
