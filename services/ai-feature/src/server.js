const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const {
  buildRecommendationResponse,
  coerceRecommendationPayload,
  recommendationSchema,
} = require("./recommendation");

const app = express();
const port = process.env.PORT || 3004;

app.use(express.json());

const CONFIGURATOR_URL = process.env.CONFIGURATOR_URL || "http://car-configurator:3001";
const MERCH_URL        = process.env.MERCH_URL        || "http://merch-shop:3002";
const GEMINI_MODEL     = process.env.GEMINI_MODEL     || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/recommend", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "replace_me") {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    // Fetch context from other services
    const [modelsRes, productsRes] = await Promise.all([
      fetch(`${CONFIGURATOR_URL}/models`),
      fetch(`${MERCH_URL}/products`),
    ]);
    const models   = await modelsRes.json();
    const products = await productsRes.json();

    const modelList   = models.map((m) => `- ${m.code} (${m.name} ${m.packageName}, ab ${m.basePrice} €)`).join("\n");
    const productList = products.map((p) => `- ID ${p.id}: ${p.name} ${p.color || ""} (${p.price} €)`).join("\n");

    const systemPrompt = `Du bist ein BMW-Einkaufsassistent. Empfehle passende Produkte basierend auf der Anfrage des Nutzers.

Verfügbare Automodelle (Farben: Black, Blue, White):
${modelList}

Verfügbare Merchandise-Produkte:
${productList}

Antworte im folgenden JSON-Format (kein Markdown, nur reines JSON):
{
  "text": "Deine Empfehlung als kurzer Text",
  "carRecommendation": { "model": "3 oder X5", "color": "Black, Blue oder White" } oder null,
  "merchIds": [Liste von Produkt-IDs als Zahlen] oder []
}`;

    const ai = new GoogleGenAI({ apiKey });
    const recommendation = await generateRecommendation(ai, systemPrompt, prompt, [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]);
    res.json(buildRecommendationResponse(recommendation));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`ai-feature listening on port ${port}`));

async function generateRecommendation(ai, systemPrompt, userPrompt, models) {
  let lastError;

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: recommendationSchema,
        },
      });

      const text = response.text;
      const parsed = JSON.parse(text);
      return coerceRecommendationPayload(parsed);
    } catch (err) {
      lastError = err;
      console.warn(`Gemini request failed for model ${modelName}: ${err.message}`);
    }
  }

  throw lastError;
}
