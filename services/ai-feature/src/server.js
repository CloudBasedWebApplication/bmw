const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3004;

app.use(express.json());

const CONFIGURATOR_URL = process.env.CONFIGURATOR_URL || "http://car-configurator:3001";
const MERCH_URL        = process.env.MERCH_URL        || "http://merch-shop:3002";

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${systemPrompt}\n\nNutzeranfrage: ${prompt}`);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```$/,"");
    const parsed = JSON.parse(raw);

    const response = { text: parsed.text, carLink: null, merchLinks: [] };

    if (parsed.carRecommendation?.model && parsed.carRecommendation?.color) {
      const { model: carModel, color } = parsed.carRecommendation;
      response.carLink = `/car-configurator?model=${encodeURIComponent(carModel)}&color=${encodeURIComponent(color)}`;
    }

    if (Array.isArray(parsed.merchIds)) {
      response.merchLinks = parsed.merchIds.map((id) => ({ id, url: `/merch-shop?product=${id}` }));
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`ai-feature listening on port ${port}`));
