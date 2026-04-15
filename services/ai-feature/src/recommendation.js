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
          description: "Recommended car model code",
        },
        color: {
          type: Type.STRING,
          description: "Recommended car color",
        },
      },
      required: ["model", "color"],
    },
    merchIds: {
      type: Type.ARRAY,
      items: {
        type: Type.INTEGER,
      },
    },
  },
  required: ["text", "carRecommendation", "merchIds"],
};

function coerceRecommendationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response is not a JSON object");
  }

  const { text, carRecommendation, merchIds } = payload;

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

  if (!Array.isArray(merchIds) || merchIds.some((id) => !Number.isInteger(id))) {
    throw new Error("Gemini merchIds is invalid");
  }

  return {
    text: text.trim(),
    carRecommendation: carRecommendation ?? null,
    merchIds,
  };
}

function buildRecommendationResponse(recommendation) {
  const response = {
    text: recommendation.text,
    carLink: null,
    merchLinks: [],
  };

  if (recommendation.carRecommendation?.model && recommendation.carRecommendation?.color) {
    const { model, color } = recommendation.carRecommendation;
    response.carLink = `/car-configurator?model=${encodeURIComponent(model)}&color=${encodeURIComponent(color)}`;
  }

  if (Array.isArray(recommendation.merchIds)) {
    response.merchLinks = recommendation.merchIds.map((id) => ({ id, url: `/merch-shop?product=${id}` }));
  }

  return response;
}

module.exports = {
  buildRecommendationResponse,
  coerceRecommendationPayload,
  recommendationSchema,
};
