const assert = require("node:assert/strict");

const {
  buildRecommendationResponse,
  coerceRecommendationPayload,
} = require("../src/recommendation");

function run() {
  const payload = coerceRecommendationPayload({
    text: "Empfehlung für ein sportliches Modell und ein Merch-Produkt.",
    carRecommendation: { model: "3", color: "Black" },
    merchIds: [7, 12],
  });

  assert.deepEqual(payload, {
    text: "Empfehlung für ein sportliches Modell und ein Merch-Produkt.",
    carRecommendation: { model: "3", color: "Black" },
    merchIds: [7, 12],
  });

  const response = buildRecommendationResponse({
    text: "Empfehlung",
    carRecommendation: { model: "X5", color: "Blue" },
    merchIds: [5],
  });

  assert.deepEqual(response, {
    text: "Empfehlung",
    carLink: "/car-configurator?model=X5&color=Blue",
    merchLinks: [{ id: 5, url: "/merch-shop?product=5" }],
  });

  assert.throws(() => {
    coerceRecommendationPayload({
      text: "Empfehlung",
      carRecommendation: null,
      merchIds: ["oops"],
    });
  }, /merchIds is invalid/);

  console.log("recommendation smoke test passed");
}

run();
