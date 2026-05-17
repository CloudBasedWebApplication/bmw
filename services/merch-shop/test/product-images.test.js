const assert = require("node:assert/strict");
const test = require("node:test");

const apiBase = process.env.MERCH_TEST_API_BASE || "http://127.0.0.1:3006";

test("product image URLs are absolute site paths", async () => {
  const response = await fetch(`${apiBase}/merch-shop/bmw-poloshirt-weiss`);

  assert.equal(response.status, 200);

  const html = await response.text();

  assert.match(html, /<img src="\/minio\/configurator-images\/merch-shop\/BMW_Merchandise_weiss\.avif"/);
});
