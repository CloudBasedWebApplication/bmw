const crypto = require("crypto");
const express = require("express");
const { createClient } = require("redis");
const { isDeepStrictEqual } = require("util");
 
// App setup and cart retention window.
const app = express();
const port = process.env.PORT || 3005;
const CART_TTL = 60 * 60 * 24;
 
// Redis connection used for per-session cart storage.
const redis = createClient({
    socket: {
        host: process.env.REDIS_HOST || "redis",
        port: parseInt(process.env.REDIS_PORT) || 6379,
    },
});
 
redis.on("error", (err) => console.error("Redis error:", err));
redis.connect().catch((err) => console.error("Redis connect error:", err));
 
// Express JSON parsing and a simple health endpoint.
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
 
// Return all items for one session plus the calculated cart total.
app.get("/cart/:sessionId", async (req, res) => {
    try {
        const raw = await redis.get(`cart:${req.params.sessionId}`);
        const items = raw ? JSON.parse(raw) : [];
        const total = items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
        res.json({ items, total: parseFloat(total.toFixed(2)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// Add a new item or merge it with an existing identical variant.
app.post("/cart/:sessionId/items", async (req, res) => {
    try {
        const { type, name, price, imageUrl, quantity = 1, details = {} } = req.body;
        const parsedPrice = Number(price);
        const parsedQuantity = Number(quantity);

        if (!type || !name || price == null) {
            return res.status(400).json({ error: "type, name and price are required" });
        }
        if (!Number.isFinite(parsedPrice)) {
            return res.status(400).json({ error: "price must be a valid number" });
        }
        if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ error: "quantity must be a positive integer" });
        }

        const raw = await redis.get(`cart:${req.params.sessionId}`);
        const items = raw ? JSON.parse(raw) : [];
        // Compare the incoming variant with stored items so identical ones merge.
        const existing = items.find((item) => (
            item.type === type
            && item.name === name
            && isDeepStrictEqual(item.details || {}, details)
        ));

        if (existing) {
            existing.quantity = Number(existing.quantity) + parsedQuantity;
            await redis.set(`cart:${req.params.sessionId}`, JSON.stringify(items), { EX: CART_TTL });
            return res.status(200).json(existing);
        }
 
        const item = {
            id: crypto.randomUUID(),
            type,
            name,
            price: parsedPrice,
            imageUrl: imageUrl || null,
            quantity: parsedQuantity,
            details,
            addedAt: new Date().toISOString(),
        };
 
        items.push(item);
        await redis.set(`cart:${req.params.sessionId}`, JSON.stringify(items), { EX: CART_TTL });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// Remove one specific item from the cart by item id.
app.delete("/cart/:sessionId/items/:itemId", async (req, res) => {
    try {
        const raw = await redis.get(`cart:${req.params.sessionId}`);
        const items = raw ? JSON.parse(raw) : [];
        const filtered = items.filter((item) => item.id !== req.params.itemId);
        await redis.set(`cart:${req.params.sessionId}`, JSON.stringify(filtered), { EX: CART_TTL });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// Update quantity for one item; quantity 0 deletes it.
app.patch("/cart/:sessionId/items/:itemId", async (req, res) => {
    try {
        const qty = Number(req.body.quantity);
 
        if (!Number.isInteger(qty) || qty < 0) {
            return res.status(400).json({ error: "quantity must be a non-negative integer" });
        }
 
        const raw = await redis.get(`cart:${req.params.sessionId}`);
        const items = raw ? JSON.parse(raw) : [];
        const updated = qty === 0
            ? items.filter((item) => item.id !== req.params.itemId)
            : items.map((item) => (item.id === req.params.itemId ? { ...item, quantity: qty } : item));
 
        await redis.set(`cart:${req.params.sessionId}`, JSON.stringify(updated), { EX: CART_TTL });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// Delete the entire cart for one session.
app.delete("/cart/:sessionId", async (req, res) => {
    try {
        await redis.del(`cart:${req.params.sessionId}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// Start the shopping-cart HTTP service.
app.listen(port, () => console.log(`shopping-cart listening on port ${port}`));
 
 