const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildMerchAssetUrl,
  normalizeMerchAssetKey,
} = require("../src/asset-paths");

test("product image URLs are owned API asset paths", () => {
  assert.equal(
    buildMerchAssetUrl("merch-shop/BMW_Merchandise_weiss.avif"),
    "/api/merch/assets/merch-shop/BMW_Merchandise_weiss.avif"
  );
});

test("merch asset keys reject empty and traversal paths", () => {
  assert.equal(normalizeMerchAssetKey("merch-shop/BMW_Merchandise_weiss.avif"), "merch-shop/BMW_Merchandise_weiss.avif");
  assert.equal(normalizeMerchAssetKey(""), null);
  assert.equal(normalizeMerchAssetKey("../merch-shop/BMW_Merchandise_weiss.avif"), null);
  assert.equal(normalizeMerchAssetKey("merch-shop/../cap.avif"), null);
  assert.equal(normalizeMerchAssetKey("configurator/6_front.jpg"), null);
});
