const express = require("express");
const redis = require("./redisClient");

const router = express.Router();
const CART_TTL = 60 * 60 * 24; // 24 hours

async function getCart(sessionId) {
  const raw = await redis.get(`cart:${sessionId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveCart(sessionId, items) {
  await redis.set(`cart:${sessionId}`, JSON.stringify(items), { EX: CART_TTL });
}

// GET /cart/:sessionId
router.get("/:sessionId", async (req, res) => {
  try {
    const items = await getCart(req.params.sessionId);
    const total = items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
    res.json({ items, total: parseFloat(total.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /cart/:sessionId/items
router.post("/:sessionId/items", async (req, res) => {
  try {
    const { type, name, price, imageUrl, quantity = 1, details = {} } = req.body;
    if (!type || !name || price == null) {
      return res.status(400).json({ error: "type, name and price are required" });
    }
    const items = await getCart(req.params.sessionId);

    // Merge into existing item if same type+name already in cart
    const existing = items.find(i => i.type === type && i.name === name);
    if (existing) {
      existing.quantity += parseInt(quantity);
      await saveCart(req.params.sessionId, items);
      return res.status(200).json(existing);
    }

    const item = {
      id: crypto.randomUUID(),
      type,
      name,
      price: parseFloat(price),
      imageUrl: imageUrl || null,
      quantity: parseInt(quantity),
      details,
      addedAt: new Date().toISOString(),
    };
    items.push(item);
    await saveCart(req.params.sessionId, items);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /cart/:sessionId/items/:itemId  — update quantity (0 removes the item)
router.patch("/:sessionId/items/:itemId", async (req, res) => {
  try {
    const qty = parseInt(req.body.quantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: "quantity must be a non-negative integer" });
    }
    const items = await getCart(req.params.sessionId);
    const updated = qty === 0
      ? items.filter(i => i.id !== req.params.itemId)
      : items.map(i => i.id === req.params.itemId ? { ...i, quantity: qty } : i);
    await saveCart(req.params.sessionId, updated);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /cart/:sessionId  — clear entire cart
router.delete("/:sessionId", async (req, res) => {
  try {
    await redis.del(`cart:${req.params.sessionId}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /cart/:sessionId/items/:itemId
router.delete("/:sessionId/items/:itemId", async (req, res) => {
  try {
    const items = await getCart(req.params.sessionId);
    const filtered = items.filter((i) => i.id !== req.params.itemId);
    await saveCart(req.params.sessionId, filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
