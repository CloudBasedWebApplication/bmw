const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildConfiguratorAssetUrl,
  normalizeConfiguratorAssetKey,
} = require("../src/asset-paths");

test("configurator image URLs are owned API asset paths", () => {
  assert.equal(
    buildConfiguratorAssetUrl("configurator/6_front.jpg"),
    "/api/configurator/assets/configurator/6_front.jpg"
  );
});

test("configurator asset keys reject empty and traversal paths", () => {
  assert.equal(normalizeConfiguratorAssetKey("configurator/6_front.jpg"), "configurator/6_front.jpg");
  assert.equal(normalizeConfiguratorAssetKey(""), null);
  assert.equal(normalizeConfiguratorAssetKey("../configurator/6_front.jpg"), null);
  assert.equal(normalizeConfiguratorAssetKey("configurator/../6_front.jpg"), null);
  assert.equal(normalizeConfiguratorAssetKey("merch-shop/cap.avif"), null);
});
