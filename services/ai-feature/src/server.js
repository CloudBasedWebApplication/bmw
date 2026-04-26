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
    // Fetch all available options from services in parallel
    const [modelsRes, productsRes, colorsRes, wheelsRes, interiorsRes] = await Promise.all([
      fetch(`${CONFIGURATOR_URL}/models`),
      fetch(`${MERCH_URL}/products`),
      fetch(`${CONFIGURATOR_URL}/options/colors`),
      fetch(`${CONFIGURATOR_URL}/options/wheels`),
      fetch(`${CONFIGURATOR_URL}/options/interiors`),
    ]);
    const models    = await modelsRes.json();
    const products  = await productsRes.json();
    const colors    = colorsRes.ok    ? await colorsRes.json()    : [];
    const wheels    = wheelsRes.ok    ? await wheelsRes.json()    : [];
    const interiors = interiorsRes.ok ? await interiorsRes.json() : [];

    const formatPrice = (price) => price > 0 ? ` (+${price} €)` : "";

    const modelList    = models.map((m) => `- ${m.code} (${m.name} ${m.packageName}, ab ${m.basePrice} €)`).join("\n");
    const colorList    = colors.map((c) => `- ${c.name}${formatPrice(c.price)}`).join("\n");
    const wheelsList   = wheels.map((w) => `- ${w.name}${formatPrice(w.price)}`).join("\n");
    const interiorList = interiors.map((i) => `- ${i.name}${formatPrice(i.price)}`).join("\n");
    const productList  = products.map((p) => `- ID ${p.id}: ${p.name} ${p.color || ""} (${p.price} €)`).join("\n");

    const optionalSections = [
      colorList    ? `Verfügbare Lackierungen:\n${colorList}`         : null,
      wheelsList   ? `Verfügbare Felgen:\n${wheelsList}`              : null,
      interiorList ? `Verfügbare Innenausstattungen:\n${interiorList}` : null,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `Du bist ein persönlicher BMW-Berater. Der Nutzer beschreibt dir im Freitext wer er ist — Beruf, Alltag, Hobbys, Stil, Lebensumstände. Deine Aufgabe:

1. Analysiere die Persönlichkeit und den Lifestyle des Nutzers aus seinem Text.
2. Wähle GENAU EINE vollständige Fahrzeugkonfiguration aus den unten gelisteten verfügbaren Optionen. Nutze ausschließlich Werte, die exakt in der jeweiligen Liste stehen — erfinde nichts.
3. Wähle 1-3 passende Merchandise-Produkte, die zum beschriebenen Lifestyle passen.

Regeln für das "text"-Feld:
- 2-4 Sätze, direkte Ansprache ("Zu deinem ...", "Für deinen Alltag ...").
- Begründe persönlich WARUM diese Konfiguration zu genau diesem Nutzer passt. Beziehe dich konkret auf Details, die der Nutzer genannt hat.
- Kein Marketing-Sprech, keine Aufzählung von Features — sondern persönliches Matching.

Verfügbare Automodelle:
${modelList}

${optionalSections}

Verfügbare Merchandise-Produkte:
${productList}`;

    const ai = new GoogleGenAI({ apiKey });
    const recommendation = await generateRecommendation(ai, systemPrompt, prompt, [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]);
    res.json(buildRecommendationResponse(recommendation, products));
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
