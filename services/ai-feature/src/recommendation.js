const { Type } = require("@google/genai");

const recommendationSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "Deine Empfehlung als kurzer Text",
    },
    carRecommendation: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        model: {
          type: Type.STRING,
          description: "Recommended car model code, exactly as listed",
        },
        color: {
          type: Type.STRING,
          description: "Recommended color name, exactly as listed",
        },
        wheels: {
          type: Type.STRING,
          nullable: true,
          description: "Recommended wheels name exactly as listed, or null if no wheels available",
        },
        interior: {
          type: Type.STRING,
          nullable: true,
          description: "Recommended interior name exactly as listed, or null if no interiors available",
        },
      },
      required: ["model", "color"],
    },
    merchItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.INTEGER,
            description: "Merch product id",
          },
          reason: {
            type: Type.STRING,
            description: "Short recommendation reason in German",
          },
        },
        required: ["id"],
      },
    },
  },
  required: ["text", "carRecommendation", "merchItems"],
};

function coerceRecommendationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response is not a JSON object");
  }

  const { text, carRecommendation, merchItems } = payload;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini response text is missing");
  }

  if (carRecommendation !== null && carRecommendation !== undefined) {
    if (typeof carRecommendation !== "object") {
      throw new Error("Gemini carRecommendation is invalid");
    }

    const { model, color } = carRecommendation;
    if (typeof model !== "string" || typeof color !== "string") {
      throw new Error("Gemini carRecommendation is incomplete");
    }
  }

  const normalizeOptionalString = (v) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  if (!Array.isArray(merchItems)) {
    throw new Error("Gemini merchItems is invalid");
  }

  const normalizedMerchItems = [];
  const seenIds = new Set();

  for (const item of merchItems) {
    if (!item || typeof item !== "object" || !Number.isInteger(item.id)) {
      throw new Error("Gemini merchItems is invalid");
    }

    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    normalizedMerchItems.push({
      id: item.id,
      reason: typeof item.reason === "string" ? item.reason.trim() : "",
    });
  }

  const normalizedCar = carRecommendation
    ? {
        model:    carRecommendation.model.trim(),
        color:    carRecommendation.color.trim(),
        wheels:   normalizeOptionalString(carRecommendation.wheels),
        interior: normalizeOptionalString(carRecommendation.interior),
      }
    : null;

  return {
    text: text.trim(),
    carRecommendation: normalizedCar,
    merchItems: normalizedMerchItems,
  };
}

function buildRecommendationResponse(recommendation, products = []) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const response = {
    text: recommendation.text,
    carLink: null,
    merchLinks: [],
  };

  if (recommendation.carRecommendation?.model && recommendation.carRecommendation?.color) {
    const { model, color, wheels, interior } = recommendation.carRecommendation;
    const params = new URLSearchParams({ model, color });
    if (wheels)   params.set("wheels", wheels);
    if (interior) params.set("interior", interior);
    response.carLink = `/car-configurator?${params.toString()}`;
  }

  if (Array.isArray(recommendation.merchItems)) {
    response.merchLinks = recommendation.merchItems.map((item) => {
      const product = productById.get(item.id);
      const title = product ? product.name : `Produkt #${item.id}`;
      const subtitle = product?.color || "";
      const imageUrl = product?.imageUrl || "";
      const reason = item.reason || "Empfohlen auf Basis Ihrer Anfrage";

      return {
        id: item.id,
        title,
        subtitle,
        imageUrl,
        price: product?.price ?? null,
        reason,
        url: `/merch-shop?product=${item.id}`,
      };
    });
  }

  if (recommendation.carRecommendation?.model) {
    response.carModel    = recommendation.carRecommendation.model;
    response.carColor    = recommendation.carRecommendation.color;
    response.carWheels   = recommendation.carRecommendation.wheels   ?? null;
    response.carInterior = recommendation.carRecommendation.interior ?? null;
  }

  return response;
}

module.exports = {
  buildRecommendationResponse,
  coerceRecommendationPayload,
  recommendationSchema,
};
