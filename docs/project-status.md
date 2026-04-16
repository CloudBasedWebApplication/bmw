# Project Status

## 1. Document Metadata

**Last updated:** 2026-04-15

**Scope:** This document describes implementation reality — what is built, why choices were made, and what remains open. For target behavior see [PRD.md](./PRD.md). For responsibility design see [architecture.md](./architecture.md). For task ownership see [team-collaboration-breakdown.md](./team-collaboration-breakdown.md).

**Update this file when:**
- A capability is merged and working in the running stack → update the relevant module's *What Is Working*
- An issue is resolved → update the Issues table status and the module's *Confirmed Gaps*
- A new gap is identified → add a row to the Issues table and a note in the module's *Confirmed Gaps*
- A cross-service contract is agreed or changed → update section 5
- An architectural decision is made → add an entry to section 6

Update this document in the same PR that changes the code it describes.

---

## 2. Project Background

This is a course project for a cloud web application, built around an automotive platform. The core purpose is to demonstrate service decomposition, containerized local development, and integration with external infrastructure — database, object storage, cache, an AI API, and a map API. The product has five backend microservices, a unified web gateway, and three infrastructure services, all orchestrated locally with Docker Compose.

The current implementation has a complete working skeleton. All five service pages are reachable through the unified gateway, the main user journeys work end to end, and the infrastructure layer (MySQL, Redis, MinIO) is integrated. Several design choices were deliberately simplified: the shared MySQL database and the reduced configurator parameter depth are phase-scoped decisions that keep the implementation tractable without blocking the principal architecture demonstration. The AI service now returns structured recommendation links instead of a free-form string.


---

## 3. Module Status

### 3.1 api-gateway

#### What Is Working

The gateway is the single web entry point for all pages. It registers routes for all five services, renders EJS templates server-side (including data pre-fetched from backend services where needed), and manages the session cookie that identifies each user's cart.

The cart, configurator, and AI proxies forward browser requests to the appropriate backend services, keeping container-internal URLs out of client-side code. The `PATCH /api/cart/items/:id` and `DELETE /api/cart` proxies were added alongside the cart quantity and clear-cart features.

`GET /api/destinations` returns the list of BMW route targets as JSON. This endpoint makes destination data backend-owned product data: the route-planning page fetches it at runtime and no longer embeds the list in the EJS template. Future additions or changes to destinations require only a server-side update.

#### Accepted Simplifications

None specific to the gateway at this time.

#### Confirmed Gaps

The gateway does not yet expose stable deep-link routes for individual merch products. AI recommendations that target a specific merchandise item currently point to the generic merch listing page because no `/merch-shop/product/:id` route exists. This will become relevant once the merch product-detail page (Issue 1) is built. The gateway routing work is a downstream dependency of that issue.

---

### 3.2 car-configurator

#### What Is Working

The configurator resolves a model + color selection into an official result. It validates the combination against MySQL, retrieves the corresponding image key, fetches the image from MinIO, calculates the price, and returns the full result. The service is the sole source of truth for combination validity, image mapping, and price — no other service calculates or stores these.

The configurator page loads available models on open and updates the color options dynamically when a model is selected. The result (image and price) is fetched from the backend on each configuration change, not computed in the browser.

#### Accepted Simplifications

**Reduced parameter depth.** The current implementation supports model and color as the two configuration dimensions. The PRD (§6.1) describes a richer parameter set (trim, wheels, and structured rationale metadata including `configurationId`, `basePrice`, `optionAdjustments`). This depth is deliberately deferred. The current response returns enough for display; it does not yet expose `configurationId`, `optionAdjustments`, or structured rationale fields. This simplification is acceptable until a downstream consumer (AI, cart, or extended UI) explicitly requires those fields.

#### Confirmed Gaps

None that block the current user journeys.

---

### 3.3 merch-shop

#### What Is Working

The merch-shop serves a product catalog from MySQL. The gateway pre-fetches the full product list when rendering the merch page, so products are visible without a client-side data fetch. Each product card shows the image (retrieved from MinIO), name, price, and an add-to-cart button.

#### Accepted Simplifications

None specific to the merch service at this time.

#### Confirmed Gaps

**No product-detail page (Issue 1).** There is no route or view for a single product. Every merch item is only accessible through the generic product grid. This matters because AI recommendations are required by the PRD (§6.2, §6.4) to link to a concrete product-detail experience rather than to the listing page. Until a stable product identifier and a detail route exist, AI deep-linking cannot be precise.

---

### 3.4 shopping-cart

#### What Is Working

The cart service stores state in Redis under a session-keyed JSON array. It supports the full set of item operations:

- **Add** — `POST /api/cart/items`. If an item with the same `type` and `name` already exists in the session, the quantity is merged rather than creating a duplicate row. This dedup behavior means repeated add-to-cart actions accumulate quantity correctly.
- **List** — `GET /api/cart`. Returns all items and a server-calculated total (`price × quantity` summed).
- **Quantity update** — `PATCH /api/cart/items/:id`. Updates the quantity of a specific item. Passing quantity 0 removes the item.
- **Remove** — `DELETE /api/cart/items/:id`. Removes one specific item by ID.
- **Clear** — `DELETE /api/cart`. Deletes the entire session cart from Redis. Useful for removing stale or test data.

The cart page displays each item with `−` / `+` quantity controls that call the PATCH endpoint and refresh the total immediately. A "Warenkorb leeren" button at the top calls the clear-cart endpoint with a confirmation step.

Car items are stored as snapshots so cart display does not depend on a live configurator call.

#### Accepted Simplifications

**Car item snapshots are simple.** Car items in the cart currently store a flat snapshot (name, price, image, selected options as a label). The PRD (§6.5) describes a richer snapshot including `configurationId`, option breakdown, and structured rationale. This is deferred until the configurator exposes those fields.

**Car item quantity policy is not yet explicitly defined.** The cart contract does not currently specify whether car items can have quantity > 1 or are always quantity-1. This is acceptable until the team decides the intended product behavior.

#### Confirmed Gaps

**No checkout flow (Issue 5, out of scope).** The cart does not submit orders or integrate with a payment system. This is a confirmed v1 out-of-scope item per PRD §3.

---

### 3.5 ai-feature

#### What Is Working

The AI assistant integrates with Gemini. It fetches the current configuration options from `car-configurator` and the full product catalog from `merch-shop` to build domain context, then calls Gemini with the user's input and that context. The response is returned to the frontend as structured recommendation links: a configurator URL pre-filled with recommended model and options, and merch shop recommendation items that include the product title, thumbnail URL, and a concise recommendation reason.

#### Accepted Simplifications

**AI merch recommendations are still compact list items.** The merch recommendation panel now has a structured layout with thumbnails, titles, and reasons, but it remains a compact list rather than a full product-detail experience. That is acceptable until Issue 1 is resolved with a dedicated merch detail route.

#### Confirmed Gaps

**Merch recommendation landing contract (Issue 1).** The AI now emits structured merch items with titles, image URLs, and reasons, but it still links to the generic merch listing page. A stable product-detail route is still missing, so deep-linking is not yet precise.

---

### 3.6 road-to-supercar

#### What Is Working

The route planning page uses the Google Maps JavaScript API, loaded in the browser with a key injected by the gateway at render time. On page load, the destination dropdown is populated by a fetch to `GET /api/destinations`, which returns the six BMW locations from the gateway. The user selects a destination, clicks "Route berechnen," and the browser uses geolocation and `DirectionsService` to calculate and render the driving route. Distance and duration are shown in an info badge.

The Google Maps API key is configured in `.env` (`GOOGLE_MAPS_API_KEY`) and injected into the EJS template server-side. If the key is absent or empty, the page shows a clear "API-Key erforderlich" fallback state instead of a broken map.

#### Accepted Simplifications

None. This module's intended behavior per PRD §6.3 is fully implemented.

#### Confirmed Gaps

None.

---

## 4. Infrastructure State

The full stack runs locally via Docker Compose with `docker compose up --build`.

| Container | Image / Build | Port (host) | Role |
|---|---|---|---|
| `api-gateway` | build: `./api-gateway` | 3000 | Web entry, EJS rendering, API proxy |
| `car-configurator` | build: `./services/car-configurator` | 3001 | Config logic, MinIO image, price |
| `merch-shop` | build: `./services/merch-shop` | 3002 | Product catalog |
| `ai-feature` | build: `./services/ai-feature` | 3004 | Gemini integration |
| `shopping-cart` | build: `./services/shopping-cart` | 3005 | Cart state (Redis) |
| `mysql` | `mysql:8.4.8` | 3306 | Persistent domain data |
| `mysql-seed` | build inline | — | One-shot seed runner, exits after seeding |
| `redis` | `redis:7.4.2` | 6379 | Cart session storage |
| `minio` | `minio/minio` | 9000 / 9001 | Object storage (images); console at 9001 |
| `minio-init` | `minio/mc` | — | One-shot bucket creator + image sync |

**MySQL.** All service tables currently live in the shared `bmw_app` database (see Decision Log entry 5). The PRD target schema (§7.1) specifies `configurator_db` (owned by `car-configurator`) and `merchandise_db` (owned by `merch-shop`). Cross-schema queries are not permitted even in the shared setup.

**Redis.** Cart state is stored at `cart:{sessionId}` as a JSON-serialized array of item objects. TTL is 24 hours. Session ID is assigned by the gateway as a cookie on first request.

**MinIO.** The `configurator-images` bucket holds all product images. Configurator images are uploaded under the `configurator/` prefix; merch images under `webshop/`. Images are pre-uploaded using `minio-init` on stack start, or manually re-synced with `docker compose run --rm minio-init`. Use ASCII-only filenames for merch assets to keep object keys stable across encodings.

**Persistence note.** Running `docker compose down -v` destroys all data volumes. MySQL seed and MinIO sync run automatically on the next `docker compose up`.

---

## 5. Cross-Service Contracts

### Cart item shape — Implemented

**Parties:** `shopping-cart` (producer) ↔ `api-gateway` (proxy) ↔ browser cart page (consumer)

**Defined fields:**
```json
{
  "id":       "uuid",
  "type":     "car" | "merch",
  "name":     "string",
  "price":    "number (per-unit price)",
  "imageUrl": "string | null",
  "quantity": "integer >= 1",
  "details":  "object (free-form snapshot metadata)",
  "addedAt":  "ISO 8601 timestamp"
}
```

**Total** is calculated server-side as `sum(price × quantity)`.

---

### Destinations payload — Implemented

**Parties:** `api-gateway` (producer) → route-planning page (consumer)

**Endpoint:** `GET /api/destinations`

**Payload:**
```json
[{ "label": "string", "value": "string (Google Maps query)" }]
```

---

### AI prompt/template + output schema — Implemented

**Parties:** `ai-feature` (producer) → browser frontend (consumer)

**Current state:** Structured recommendation payload returned. Merch items include product title, image URL, and reason metadata.

**PRD requirement (§6.4):** Structured payload separating recommendation links from free-text rationale. Must support car and merch recommendations in a single response. Car payload must be rich enough for configurator resolution; merch payload must identify the specific product target.

---

### Merch recommendation landing contract — Unresolved

**Parties:** `ai-feature` (link generator) → `merch-shop` / `api-gateway` (route target)

**Current state:** AI links to the generic merch listing page. No product-detail route exists.

**Required:** A stable product identifier in the merch service, a product-detail route in the gateway, and an agreed URL format that AI can construct and the gateway can resolve.

---

## 6. Design Decision Log

### 1. Unified web entry via api-gateway with EJS

**Date:** Project start  
**Context:** The project needed one coherent user-facing application spanning all five service capabilities.  
**Decision:** All pages are rendered through a single `api-gateway` using EJS templates. Service views live in their own directories and are rendered by the gateway.  
**Rationale:** Keeps the web layer simple (no SPA framework), avoids CORS complexity, and lets the gateway manage session state centrally.  
**Consequences:** All service UI changes touch the gateway's view resolution path. The gateway is a prerequisite for all page-level features.  
**Status:** Standing.

---

### 2. Pre-generated configurator images in MinIO

**Date:** Project start  
**Context:** Rendering car images on demand would require 3D assets or an image generation pipeline.  
**Decision:** All valid model + option combinations are pre-rendered as image files, uploaded to MinIO, and indexed in MySQL. The configurator looks up the image key and returns a MinIO URL.  
**Rationale:** Eliminates real-time rendering complexity. Keeps the configurator's responsibility to data lookup, not image generation.  
**Consequences:** New option combinations require a new pre-generated image and a new MySQL row. The image set is fixed at upload time.  
**Status:** Standing.

---

### 3. Client-side route planning via Google Maps JS API

**Date:** Project start  
**Context:** Route calculation requires a mapping service. A backend proxy would add latency and complexity for a feature that does not need server-side data.  
**Decision:** Route calculation and rendering run entirely in the browser using the Google Maps JS API. The backend only injects the API key and serves the destination list.  
**Rationale:** Keeps the backend out of the runtime Maps call. The browser is better positioned to use the user's geolocation directly.  
**Consequences:** The Maps API key is visible in the rendered HTML (acceptable for a course project). Route data is not stored or logged.  
**Status:** Standing.

---

### 4. AI returns frontend links, not structured resolution data

**Date:** Project start  
**Context:** Building a stable AI output schema requires prompt engineering and contract design work that would block the initial integration.  
**Decision:** The AI service currently returns a free-form string containing URLs. No structured payload is defined.  
**Rationale:** Unblocks the initial Gemini integration and end-to-end flow demonstration without committing to a schema prematurely.  
**Consequences:** Frontend rendering quality is limited. Merch deep-linking cannot be precise. This is the primary open design task for the AI module.  
**Status:** Revisable. The next AI work item is designing the prompt template and output schema (Issue 2).

---

### 5. Shared `bmw_app` MySQL database

**Date:** Project start  
**Context:** Per-service MySQL schemas require more setup overhead and a more complex Docker Compose configuration.  
**Decision:** All service tables currently share a single `bmw_app` database instance. Cross-schema queries are still prohibited; each service may only query its own tables.  
**Rationale:** Reduces local development complexity for the initial skeleton. The service ownership rules are enforced by convention.  
**Consequences:** Schema isolation is not enforced by the database engine. Migration to per-service schemas (PRD §7.1 target) will require data migration work when the time comes.  
**Status:** Revisable. Acceptable until a later task explicitly requires schema isolation.

---

### 6. No authentication system

**Date:** Project start  
**Context:** Authentication would require a user model, session management beyond cart cookies, and access control across all services.  
**Decision:** No authentication. Cart state is keyed by an anonymous session cookie.  
**Rationale:** Authentication is confirmed out of scope for v1 per PRD §3.  
**Consequences:** All users share the same anonymous session model. Cart state is not tied to an account.  
**Status:** Standing (out of scope).

---

### 7. Cart stores item snapshots

**Date:** Project start  
**Context:** Displaying a car configuration in the cart requires either a live configurator call or a stored copy of the result.  
**Decision:** Car items are stored as snapshots (name, price, image, options label) at add time. The cart does not call the configurator to re-resolve items at display time.  
**Rationale:** Cart display remains stable even if the configurator is unavailable. Avoids a synchronous service call on every cart page load.  
**Consequences:** If configurator data changes (e.g. price update), existing cart snapshots do not reflect the change. Acceptable for a course project.  
**Status:** Standing.

---

### 8. Cart add merges on type + name

**Date:** 2026-04-13  
**Context:** Without dedup logic, adding the same merch product twice creates two separate cart rows, which is confusing to users and inconsistent with standard cart behavior.  
**Decision:** `POST /api/cart/items` checks for an existing item with the same `type` and `name`. If found, it increments the quantity rather than inserting a new row.  
**Rationale:** Matches expected e-commerce cart behavior. Keeps the cart list clean for merch items where the product identity is stable across adds.  
**Consequences:** Two items with the same name but different prices (e.g. different product variants with the same display name) would be incorrectly merged. Acceptable given the current simple product model.  
**Status:** Standing. Revisable if product variants are introduced.

---

## 7. Issues

Append-only. When an issue is resolved, change Status to `Resolved` — do not delete the row. New issues take the next sequential number.

**Severity:** `Blocking` — a required journey cannot complete at all · `High` — journey completes with meaningful degradation · `Medium` — less-primary flow or workaround exists · `Low` — edge case or cosmetic · `Out of Scope` — confirmed not in v1 scope

| # | Title | Affected Services | PRD | Severity | Impact | Status |
|---|---|---|---|---|---|---|
| 1 | No merch product-detail page | merch-shop, ai-feature, api-gateway | §6.2, §6.4 | High | AI recommendations land on the generic product list; no stable product URL exists for deep-linking | Open |
| 2 | No structured AI prompt/output schema | ai-feature | §6.4 | High | The AI service now returns structured recommendation items and the free-form contract has been replaced | Resolved |
| 3 | Cart quantity update | shopping-cart, api-gateway | §6.5 | Medium | Users had no way to change item quantities without removing and re-adding | Resolved |
| 4 | Destinations hardcoded in frontend | road-to-supercar, api-gateway | §6.3 | Medium | Destination data was embedded in the EJS template rather than served from the gateway | Resolved |
| 5 | No checkout / order submission | shopping-cart | §3 (out of scope) | Out of Scope | Cart has no payment or order flow; confirmed not in v1 scope | Out of Scope |
