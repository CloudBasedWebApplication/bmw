const assert = require("node:assert/strict");
const test = require("node:test");

const apiBase = process.env.CONFIGURATOR_TEST_API_BASE || "http://127.0.0.1:3000/api/configurator";

test("calculated preview image URLs are absolute site paths", async () => {
  const response = await fetch(`${apiBase}/configuration/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: 2,
      colorId: 4,
      interiorId: 13,
      wheelsId: 2,
    }),
  });

  assert.equal(response.status, 200);

  const payload = await response.json();

  assert.match(payload.previewImages.front, /^\/minio\/configurator-images\/configurator\/6_front\.jpg$/);
});
