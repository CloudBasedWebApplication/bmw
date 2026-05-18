# Project Status

## 1. Document Metadata

**Last updated:** 2026-05-18

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

This is a course project for a cloud web application, built around an automotive platform. The core purpose is to demonstrate service decomposition, containerized local development, and integration with external infrastructure — database, object storage, cache, an AI API, and a map API. The product has one browser-facing web app, one API gateway, four backend microservices, and three infrastructure services, all orchestrated locally with Docker Compose.

The current implementation has a complete working skeleton. All major pages are reachable through `services/web-shop-frontend`, which forwards page/API requests to `services/web-shop-backend`; browser API calls then flow through `api-gateway`. The main user journeys work end to end, and the infrastructure layer (MySQL, Redis, MinIO) is integrated. Several design choices were deliberately simplified, including the shared MySQL database and reduced configurator parameter depth. Phase 2 image delivery is complete: product images remain in MinIO, but browser-visible access flows through service-owned API asset routes. The AI service now returns structured recommendation links instead of a free-form string.


---

## 3. Module Status

### 3.1 web-shop-frontend and web-shop-backend

#### What Is Working

The web-shop presentation layer is split into two services. `web-shop-frontend` is the only browser-facing application container; it serves shared static assets under `/static`, returns `{ ok: true, service: "web-shop-frontend" }` from `/health`, and forwards every other request to `web-shop-backend`.

`web-shop-backend` registers page routes for Home, Configurator, Merch Shop, Merch Product Detail, AI Feature, Shopping Cart, and Impressum, renders EJS templates server-side, and proxies same-origin `/api/*` requests to `api-gateway`. The merch pages fetch product data through the gateway at `/api/merch/products` and `/api/merch/products/:productId`; the backend no longer has a direct `MERCH_URL` dependency.

The home page injects the Google Maps API key server-side and fetches destination data through `/api/destinations`. The cart and AI pages consume the same-origin API surface exposed through the gateway.

#### Accepted Simplifications

None specific to the presentation split at this time.

#### Confirmed Gaps

None that block the current user journeys.

---

### 3.2 api-gateway

#### What Is Working

The gateway is the API-facing entry point for browser requests. It manages the session cookie that identifies each user's cart and proxies cart, configurator, merch, AI, and binary product-asset requests to the appropriate backend services, keeping container-internal URLs out of client-side code. The `PATCH /api/cart/items/:id` and `DELETE /api/cart` proxies support cart quantity changes and clear-cart behavior.

`GET /health` reports only gateway service status. Route and page discovery belongs to `services/web-shop-backend` documentation or route definitions rather than gateway health.

`GET /api/destinations` returns the list of BMW route targets as JSON. This endpoint makes destination data backend-owned product data: the route-planning page fetches it at runtime and no longer embeds the list in the EJS template. Future additions or changes to destinations require only a server-side update.

#### Accepted Simplifications

None specific to the gateway at this time.

#### Confirmed Gaps

No page-rendering gaps remain after local issue 8. Browser-facing routes are mediated by `services/web-shop-frontend` and rendered by `services/web-shop-backend`; gateway changes should stay limited to API, session, and support endpoint behavior.

---

### 3.3 car-configurator

#### What Is Working

The configurator resolves a model + color selection into an official result. It validates the combination against MySQL, retrieves the corresponding image key, returns image URLs under `/api/configurator/assets/*`, streams configurator-owned images from MinIO through `GET /assets/*`, calculates the price, and returns the full result. The service is the sole source of truth for combination validity, image mapping, and price — no other service calculates or stores these.

The configurator page loads available models on open and updates the color options dynamically when a model is selected. The result (image and price) is fetched from the backend on each configuration change, not computed in the browser.

#### Accepted Simplifications

**Reduced parameter depth.** The current implementation supports the option dimensions present in the seeded data and API (`model`, `color`, `wheels`, and `interior`), but not a full production rules engine. The response returns enough for display and downstream linking; richer normalized fields can still be added if a downstream consumer needs them.

#### Confirmed Gaps

None that block the current user journeys.

---

### 3.4 merch-shop

#### What Is Working

The merch-shop serves a product catalog from MySQL. The web app pre-fetches the full product list when rendering the merch page, so products are visible without a client-side data fetch. Each product card shows the image through `/api/merch/assets/*`, name, price, and an add-to-cart button. The merch service owns merchandise image URL generation and streams `merch-shop/` objects from MinIO through `GET /assets/*`.

The merch service exposes `GET /products/:productId`, and the web app exposes `/merch-shop/:productId` for direct product-detail pages. Product identifiers can be numeric IDs or generated slugs, which gives the web application a stable target for direct product links.

#### Accepted Simplifications

None specific to the merch service at this time.

#### Confirmed Gaps

None specific to the merch service at this time.

---

### 3.5 shopping-cart

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

### 3.6 ai-feature

#### What Is Working

The AI assistant integrates with Gemini. It fetches the current configuration options from `car-configurator` and the full product catalog from `merch-shop` to build domain context, then calls Gemini with the user's input and that context. Gemini output is constrained through a structured response schema and normalized before being returned to the frontend.

The response is returned to the frontend as structured recommendation links: a configurator URL pre-filled with recommended model and options, and merch shop recommendation items that include the product title, thumbnail URL, price, and a concise recommendation reason.

`ai-feature` is an integration/orchestration service. It does not own a MySQL schema, does not depend on `mysql2`, and does not query `car-configurator` or `merch-shop` tables directly. Additional AI data needs should be solved through new or extended service endpoints in the owning service.

This boundary is intended to remain valid if the current shared database is later decomposed into service-owned databases. `ai-feature` should depend on `CONFIGURATOR_URL`, `MERCH_URL`, and the HTTP response contracts of those services, not on database schema names, credentials, containers, or migration details.

#### Accepted Simplifications

**AI merch recommendations are still compact list items.** The merch recommendation panel has a structured layout with thumbnails, titles, prices, and reasons, but it remains a compact recommendation panel rather than embedding the full product-detail experience.

#### Confirmed Gaps

**Official configurator resolution.** AI currently builds a configurator link from structured model/options. If strict PRD wording requires the AI service to resolve an official configuration result before responding, it should call the configurator resolution endpoint as a final validation step.

---

### 3.7 home

#### What Is Working

The customer home page uses the Google Maps JavaScript API, loaded in the browser with a key injected by the web app at render time. On page load, the destination dropdown is populated by a fetch to `GET /api/destinations`, which returns the BMW locations from the gateway. The user selects a destination, clicks "Route berechnen," and the browser uses geolocation and `DirectionsService` to calculate and render the driving route. Distance and duration are shown in an info badge.

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
| `web-shop-frontend` | build: `./services/web-shop-frontend` | 3000 | Browser-facing static asset server and request proxy |
| `web-shop-backend` | build: `./services/web-shop-backend` | internal 3006 | EJS rendering and same-origin API forwarding |
| `api-gateway` | build: `./api-gateway` | internal 3000 | API proxy, session cookie, support endpoints |
| `car-configurator` | build: `./services/car-configurator` | internal 3001 | Config logic, MinIO image, price |
| `merch-shop` | build: `./services/merch-shop` | internal 3002 | Product catalog and MinIO-backed merchandise image URLs |
| `ai-feature` | build: `./services/ai-feature` | internal 3004 | Gemini integration |
| `shopping-cart` | build: `./services/shopping-cart` | internal 3005 | Cart state (Redis) |
| `mysql` | `mysql:8.4` | 3306 | Persistent domain data |
| `mysql-seed` | `mysql:8.4` | — | One-shot seed runner, exits after seeding |
| `redis` | `redis:8-alpine` | 6379 | Cart session storage |
| `minio` | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | internal 9000 / debug 9001 | Object storage (images); console at 9001 |
| `minio-init` | `minio/mc:RELEASE.2025-08-13T08-35-41Z` | — | One-shot bucket creator + image sync |

**MySQL.** All service tables currently live in the shared `bmw_app` database (see Decision Log entry 5). The PRD target schema (§7.1) specifies `configurator_db` (owned by `car-configurator`) and `merchandise_db` (owned by `merch-shop`). Cross-schema queries are not permitted even in the shared setup.

**Redis.** Cart state is stored at `cart:{sessionId}` as a JSON-serialized array of item objects. TTL is 24 hours. Session ID is assigned by the gateway as a cookie on first API request.

**MinIO.** The `configurator-images` bucket holds all product images. Configurator images are uploaded under the `configurator/` prefix; merch images under `merch-shop/`; home/static support images are mirrored under `home/` but the Home page now uses `/static/images/<file>` from `web/public/images`. Images are pre-uploaded using `minio-init` on stack start, or manually re-synced with `docker compose run --rm minio-init`. Use ASCII-only filenames for merch assets to keep object keys stable across encodings.

**Phase 2 image boundary decision — implemented.** Images remain stored in MinIO, but browser-visible image delivery is owned by the service that owns the image reference. Configurator images are exposed through `GET /api/configurator/assets/*`; merchandise images are exposed through `GET /api/merch/assets/*`. The request path is `Browser -> web-shop-frontend -> web-shop-backend -> api-gateway -> owning service -> MinIO`. The legacy `/minio/*` browser URL was deleted without a compatibility redirect. MinIO API port `9000` is no longer host-exposed; only console port `9001` remains exposed for local infrastructure/debug use.

Phase 2 validation covers no runtime browser path using the legacy MinIO URL contract, binary response preservation for the gateway asset routes, configurator and merch image URL prefixes, Home page static presentation assets, and Docker Compose with no host exposure for MinIO API port `9000`.

**Persistence note.** Running `docker compose down -v` destroys all data volumes. MySQL seed and MinIO sync run automatically on the next `docker compose up`.

---

## 5. Cross-Service Contracts

### Cart item shape — Implemented

**Parties:** `shopping-cart` (producer) ↔ `api-gateway` (proxy/session) ↔ `web-shop-backend` cart page (consumer)

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

**Parties:** `ai-feature` (producer) → `api-gateway` (proxy) → `web-shop-backend` AI page (consumer)

**Current state:** Gemini output is constrained with a response schema and normalized by `ai-feature`. The frontend receives structured fields such as `text`, `carLink`, `merchLinks`, and the selected car option fields. Merch items include product title, image URL, price, and reason metadata.

**PRD requirement (§6.4):** Structured payload separating recommendation links from free-text rationale. Must support car and merch recommendations in a single response. Car payload must be rich enough for configurator resolution; merch payload must identify the specific product target.

---

### Merch product-detail route — Implemented

**Parties:** `merch-shop` (product data) → `api-gateway` (proxy) → `web-shop-backend` (route/view)

**Current state:** `merch-shop` exposes product detail data via `GET /products/:productId`, and the web app exposes `/merch-shop/:productId` using the `web/views/merch-product.ejs` view.

---

### AI merch recommendation landing URL — Implemented

**Parties:** `ai-feature` (link generator) → `web-shop-backend` merch detail route (route target)

**Current state:** AI merch recommendation links target the canonical `/merch-shop/:productId` product-detail route.

---

## 6. Design Decision Log

### 1. Browser-facing web shop frontend/backend plus API gateway

**Date:** Project start
**Context:** The project needed one coherent user-facing application spanning all five service capabilities.
**Decision:** Static assets and host exposure live in `services/web-shop-frontend`; EJS pages are rendered through `services/web-shop-backend` using shared templates. Browser API calls stay same-origin under `/api/*` and are forwarded through `web-shop-backend` to `api-gateway`, which handles API proxying and session-oriented support endpoints.
**Rationale:** Keeps the web layer simple (no SPA framework), avoids CORS complexity, and separates browser presentation from API routing concerns.
**Consequences:** Page-level SSR changes usually touch `services/web-shop-backend` or `web/views`; static/proxy entry changes touch `services/web-shop-frontend`; API routing and session behavior remain in `api-gateway`.
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

### 4. AI returns structured recommendation payloads

**Date:** Project start
**Context:** The initial AI integration needed predictable frontend rendering rather than free-form model text.
**Decision:** The AI service constrains Gemini output with a response schema, normalizes it server-side, and returns structured fields for free-text rationale, car recommendation links, merch recommendation cards, and selected car options.
**Rationale:** Keeps frontend rendering stable while still allowing Gemini to choose recommendations from service-provided domain context.
**Consequences:** The frontend can render cards and links predictably. Remaining routing refinement is limited to making merch recommendation URLs use the canonical product-detail route.
**Status:** Standing. Schema details remain extensible as downstream consumers need richer metadata.

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

### 9. Runtime and dependency version policy

**Date:** 2026-05-18
**Context:** Review feedback called out the security risk of stale or overly fixed dependency and runtime versions.
**Decision:** Keep dependencies and runtime images on current supported major or LTS-line versions, but do not use `latest`. Node service Dockerfiles use `node:24-alpine`; Docker Compose uses `mysql:8.4` and `redis:8-alpine`; MinIO keeps explicit release tags. Node services commit `package-lock.json` and Docker builds use `npm ci`.
**Rationale:** Supported major lines receive maintenance updates, while avoiding uncontrolled breaking changes from `latest`. Lock files make npm resolution reproducible and audits make security maintenance explicit.
**Consequences:** Dependency upgrades are deliberate changes that require `npm audit --omit=dev`, service tests, Docker build validation, and smoke testing.
**Status:** Standing.

---

## 7. Issues

Append-only. When an issue is resolved, change Status to `Resolved` — do not delete the row. New issues take the next sequential number.

**Severity:** `Blocking` — a required journey cannot complete at all · `High` — journey completes with meaningful degradation · `Medium` — less-primary flow or workaround exists · `Low` — edge case or cosmetic · `Out of Scope` — confirmed not in v1 scope

| # | Title | Affected Services | PRD | Severity | Impact | Status |
|---|---|---|---|---|---|---|
| 1 | No merch product-detail page | merch-shop, ai-feature, api-gateway | §6.2, §6.4 | High | Product detail route and view now exist; AI URL generation still needs to switch to the canonical detail route | Resolved |
| 2 | No structured AI prompt/output schema | ai-feature | §6.4 | High | The AI service now returns structured recommendation items and the free-form contract has been replaced | Resolved |
| 3 | Cart quantity update | shopping-cart, api-gateway | §6.5 | Medium | Users had no way to change item quantities without removing and re-adding | Resolved |
| 4 | Destinations hardcoded in frontend | home, api-gateway | §6.3 | Medium | Destination data was embedded in the EJS template rather than served from the gateway | Resolved |
| 5 | No checkout / order submission | shopping-cart | §3 (out of scope) | Out of Scope | Cart has no payment or order flow; confirmed not in v1 scope | Out of Scope |
| 6 | AI merch links use listing query URL | ai-feature, web-shop-backend | §6.2, §6.4 | Medium | AI recommendations now target the canonical `/merch-shop/:productId` route | Resolved |
| 7 | AI car recommendation not officially resolved before response | ai-feature, car-configurator | §6.4 | Medium | AI returns a configurator link from structured options; strict official-result semantics would require a final configurator API validation step | Open |
| 8 | Gateway still contains page-rendering routes | web-shop-backend, api-gateway | §5, architecture §4.1-4.2 | Medium | Responsibility split is documented but gateway still duplicated EJS browser routes | Resolved |
