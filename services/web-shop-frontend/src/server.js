const path = require("path");
const fs = require("fs");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = process.env.PORT || 3000;
const backendUrl = process.env.WEB_SHOP_BACKEND_URL || "http://web-shop-backend:3006";
const minioBaseUrl = `http://${process.env.MINIO_ENDPOINT || "minio"}:${process.env.MINIO_PORT || 9000}`;
const minioBucket = process.env.MINIO_BUCKET || "configurator-images";

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

function decodeMediaKey(rawKey) {
  let decoded = rawKey;

  for (let i = 0; i < 10; i += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) return decoded;
    decoded = next;
  }

  throw new Error("Too many encoded media path iterations");
}

function getHomeMediaKey(req) {
  const rawPath = req.originalUrl.split("?")[0];
  const prefix = "/media/home/";

  if (rawPath === "/media/home" || rawPath === prefix) return null;
  if (!rawPath.startsWith(prefix)) return undefined;

  try {
    const key = decodeMediaKey(rawPath.slice(prefix.length));

    if (!key) return null;
    if (key.includes("/") || key.includes("\\") || key.includes("..")) return null;
    if (!/\.mp4$/i.test(key)) return null;

    return key;
  } catch (_err) {
    return null;
  }
}

const homeMediaProxy = createProxyMiddleware({
  target: minioBaseUrl,
  changeOrigin: false,
  xfwd: true,
});

app.use("/media/home", (req, res, next) => {
  const key = getHomeMediaKey(req);

  if (key === undefined) {
    res.status(400).send("Invalid media path");
    return;
  }

  if (key === null) {
    res.status(400).send("Invalid homepage media path");
    return;
  }

  const query = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";

  req.url = `/${encodeURIComponent(minioBucket)}/home/${encodeURIComponent(key)}${query}`;
  homeMediaProxy(req, res, next);
});

app.use(
  createProxyMiddleware({
    target: backendUrl,
    changeOrigin: false,
    xfwd: true,
  })
);

app.listen(port, () => console.log(`web-shop-frontend listening on port ${port}`));
