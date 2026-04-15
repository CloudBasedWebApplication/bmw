const assert = require("node:assert/strict");

const {
  buildRecommendationResponse,
  coerceRecommendationPayload,
} = require("../src/recommendation");

function run() {
  const payload = coerceRecommendationPayload({
    text: "Empfehlung für ein sportliches Modell und ein Merch-Produkt.",
    carRecommendation: { model: "3", color: "Black" },
    merchItems: [
      { id: 7, reason: "Passt zu Ihrem urbanen Setup" },
      { id: 12, reason: "Passt zu Ihrem urbanen Setup" },
      { id: 7, reason: "Duplicate should be removed" },
    ],
  });

  assert.deepEqual(payload, {
    text: "Empfehlung für ein sportliches Modell und ein Merch-Produkt.",
    carRecommendation: { model: "3", color: "Black" },
    merchItems: [
      { id: 7, reason: "Passt zu Ihrem urbanen Setup" },
      { id: 12, reason: "Passt zu Ihrem urbanen Setup" },
    ],
  });

  const response = buildRecommendationResponse({
    text: "Empfehlung",
    carRecommendation: { model: "X5", color: "Blue" },
    merchItems: [{ id: 5, reason: "Passt zum sportlichen Look" }],
  }, [
    { id: 5, name: "BMW Sweatshirt", color: "Schwarz", imageUrl: "https://example.com/sweatshirt.jpg" },
  ]);

  assert.deepEqual(response, {
    text: "Empfehlung",
    carLink: "/car-configurator?model=X5&color=Blue",
    merchLinks: [{
      id: 5,
      title: "BMW Sweatshirt",
      subtitle: "Schwarz",
      imageUrl: "https://example.com/sweatshirt.jpg",
      reason: "Passt zum sportlichen Look",
      url: "/merch-shop?product=5",
    }],
  });

  assert.throws(() => {
    coerceRecommendationPayload({
      text: "Empfehlung",
      carRecommendation: null,
      merchItems: ["oops"],
    });
  }, /merchItems is invalid/);

  console.log("recommendation smoke test passed");
}

run();
