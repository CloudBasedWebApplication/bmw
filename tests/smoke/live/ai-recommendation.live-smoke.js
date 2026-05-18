const assert = require("node:assert/strict");

const AI_RECOMMEND_URL = process.env.AI_RECOMMEND_URL || "http://localhost:3004/recommend";
const CONFIGURATOR_URL = process.env.CONFIGURATOR_URL || "http://localhost:3001";
const MERCH_URL = process.env.MERCH_URL || "http://localhost:3002";

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.text();

  assert.equal(
    response.ok,
    true,
    `${url} returned ${response.status}: ${body}`
  );

  return body ? JSON.parse(body) : null;
}

async function run() {
  const recommendation = await fetchJson(AI_RECOMMEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: [
        "Ich bin Softwareentwickler, fahre oft in der Stadt,",
        "mag ein sportliches aber alltagstaugliches Auto und dezentes BMW Merchandise.",
      ].join(" "),
    }),
  });

  assert.equal(typeof recommendation.text, "string");
  assert.ok(recommendation.text.trim(), "recommendation text should be present");
  assert.equal(typeof recommendation.carLink, "string");
  assert.ok(recommendation.carLink.startsWith("/car-configurator?"));
  assert.ok(Array.isArray(recommendation.merchLinks));
  assert.ok(recommendation.merchLinks.length > 0, "at least one merch recommendation is expected");

  const carParams = new URLSearchParams(recommendation.carLink.split("?")[1]);
  const modelCode = carParams.get("model");
  const colorName = carParams.get("color");
  const wheelsName = carParams.get("wheels");
  const interiorName = carParams.get("interior");

  assert.ok(modelCode, "carLink should include model");
  assert.ok(colorName, "carLink should include color");

  const models = await fetchJson(`${CONFIGURATOR_URL}/models`);
  const selectedModel = models.find((model) => model.code === modelCode);
  assert.ok(selectedModel, `recommended model ${modelCode} should exist in configurator models`);

  const [colors, wheels, interiors, products] = await Promise.all([
    fetchJson(`${CONFIGURATOR_URL}/options/colors?modelId=${selectedModel.id}`),
    fetchJson(`${CONFIGURATOR_URL}/options/wheels?modelId=${selectedModel.id}`),
    fetchJson(`${CONFIGURATOR_URL}/options/interiors?modelId=${selectedModel.id}`),
    fetchJson(`${MERCH_URL}/products`),
  ]);

  assert.ok(
    colors.some((color) => color.name === colorName),
    `recommended color ${colorName} should exist for model ${modelCode}`
  );

  if (wheelsName) {
    assert.ok(
      wheels.some((wheel) => wheel.name === wheelsName),
      `recommended wheels ${wheelsName} should exist for model ${modelCode}`
    );
  }

  if (interiorName) {
    assert.ok(
      interiors.some((interior) => interior.name === interiorName),
      `recommended interior ${interiorName} should exist for model ${modelCode}`
    );
  }

  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const item of recommendation.merchLinks) {
    assert.equal(typeof item.id, "number");
    assert.ok(productsById.has(item.id), `recommended merch product ${item.id} should exist`);
    assert.equal(item.url, `/merch-shop/${item.id}`);
    assert.ok(item.title, `recommended merch product ${item.id} should include title`);
  }

  console.log("live recommendation smoke test passed");
  console.log(JSON.stringify({
    carLink: recommendation.carLink,
    merchLinks: recommendation.merchLinks.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
    })),
  }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
