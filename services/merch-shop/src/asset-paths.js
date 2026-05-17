const MERCH_ASSET_PUBLIC_BASE = "/api/merch/assets";

function normalizeMerchAssetKey(value) {
  const objectKey = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = objectKey.split("/");

  if (
    !objectKey ||
    objectKey.includes("\0") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !objectKey.startsWith("merch-shop/")
  ) {
    return null;
  }

  return objectKey;
}

function buildMerchAssetUrl(imageKey) {
  const objectKey = normalizeMerchAssetKey(imageKey);
  return objectKey ? `${MERCH_ASSET_PUBLIC_BASE}/${objectKey}` : null;
}

function encodeObjectKey(objectKey) {
  return objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

module.exports = {
  buildMerchAssetUrl,
  encodeObjectKey,
  normalizeMerchAssetKey,
};
