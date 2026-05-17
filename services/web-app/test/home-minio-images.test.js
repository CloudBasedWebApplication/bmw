const assert = require("node:assert/strict");
const test = require("node:test");

const appBase = process.env.WEB_APP_TEST_BASE || "http://127.0.0.1:3006";

test("home page MinIO image URLs are absolute site paths", async () => {
  const response = await fetch(`${appBase}/`);

  assert.equal(response.status, 200);

  const html = await response.text();

  assert.doesNotMatch(html, /["']minio\/configurator-images\//);
  assert.match(html, /["']\/minio\/configurator-images\/home\/bmw_ai\.png/);
});
