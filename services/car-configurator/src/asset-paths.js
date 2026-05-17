const CONFIGURATOR_ASSET_PUBLIC_BASE = "/api/configurator/assets";

function normalizeConfiguratorAssetKey(value) {
  const objectKey = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = objectKey.split("/");

  if (
    !objectKey ||
    objectKey.includes("\0") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !objectKey.startsWith("configurator/")
  ) {
    return null;
  }

  return objectKey;
}

function buildConfiguratorAssetUrl(imageKey) {
  const objectKey = normalizeConfiguratorAssetKey(imageKey);
  return objectKey ? `${CONFIGURATOR_ASSET_PUBLIC_BASE}/${objectKey}` : null;
}

function encodeObjectKey(objectKey) {
  return objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

module.exports = {
  buildConfiguratorAssetUrl,
  encodeObjectKey,
  normalizeConfiguratorAssetKey,
};
