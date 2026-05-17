const path = require("path");
const fs = require("fs");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = process.env.PORT || 3000;
const backendUrl = process.env.WEB_SHOP_BACKEND_URL || "http://web-shop-backend:3006";

function resolveRepoRoot() {
  const candidates = [
    process.env.REPO_ROOT,
    path.resolve(__dirname, "..", "..", ".."),
    path.resolve(process.cwd(), "..", ".."),
    path.resolve(process.cwd(), ".."),
    process.cwd(),
  ].filter(Boolean);

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "web", "public"))
  );
}

const REPO_ROOT = resolveRepoRoot();

if (!REPO_ROOT) {
  throw new Error("Could not locate shared web/public directory");
}

app.use("/static", express.static(path.join(REPO_ROOT, "web", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "web-shop-frontend" });
});

app.use(
  createProxyMiddleware({
    target: backendUrl,
    changeOrigin: false,
    xfwd: true,
  })
);

app.listen(port, () => console.log(`web-shop-frontend listening on port ${port}`));
