# Product Requirements Document (PRD)

## 1. Background

A course assignment for a cloud web application. The product is an automotive platform centered around a car configurator, with additional features for merchandise browsing, route planning, an AI shopping assistant, and a unified cart.

The main purpose is to demonstrate service decomposition, containerized local development, and integration with external infrastructure (database, cache, AI API, map API).

This PRD describes the intended product behavior and target architecture for the course project. It is the product-level source of truth. Implementation may be phased, but feature trade-offs or temporary simplifications do not redefine the target behavior documented here.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Web Entry | `api-gateway` with EJS (server-side rendering) + vanilla JS |
| Backend | Node.js + Express |
| Primary DB | MySQL (single instance, one schema per service) |
| Cache | Redis |
| Object Storage | MinIO |
| AI | Gemini API |
| Map | Google Maps JavaScript API (client-side, key injected by `api-gateway`) |
| Orchestration | Docker Compose |

## 3. Product Scope

### In Scope

- One unified web entry application in `api-gateway/`
- Four backend services: `car-configurator`, `merch-shop`, `ai-feature`, `shopping-cart`
- MySQL for persistent domain data
- Redis for cart state
- MinIO for image storage
- Gemini API for AI recommendations
- Google Maps for route planning
- A merch product-detail experience reachable from direct links and AI recommendations
- Structured AI prompt/response contracts that keep recommendations stable enough for frontend rendering

### Out of Scope (v1)

- Authentication and user accounts
- Live 3D or real-time car rendering
- Order and payment workflow
- Complex configuration rule engine
- Inventory or pricing synchronization
- Message queue (all inter-service calls are synchronous REST)
- User-specific personalization profiles beyond the current session

## 4. Users and Core Journeys

### Primary Users

- Course evaluators who need to see a coherent cloud application architecture and service boundaries
- End users who want to configure a BMW, browse branded merchandise, ask for shopping guidance, and collect selections in one cart

### Core Journeys

1. A user opens the platform, chooses a BMW model, adjusts available configuration parameters, and reviews the official result.
2. A user browses merchandise, opens a single product detail, and adds one or more units to the cart.
3. A user asks the AI assistant for a recommendation and receives actionable links that open the relevant configurator state or merch product detail.
4. A user opens the route planning view, selects a predefined BMW location, and gets driving directions in the browser.
5. A user reviews the unified cart, changes quantities where applicable, and removes unwanted items.

## 5. Architecture

### Service Communication

All inter-service calls are synchronous HTTP REST. No message queue. Key call chains:

- Frontend → each backend service directly
- `ai-feature` → `configurator` (to resolve official car config result)
- `ai-feature` → `merchandise` (to fetch product catalog for context)
- Frontend → `cart` (add car snapshot or merchandise item)
- Frontend → `api-gateway` destinations endpoint (to fetch predefined route targets)

### Cart Session

No login. Cart state is keyed by a session ID (generated client-side or by a cookie). Redis key format: `cart:{sessionId}`.

### Docker Containers

| Container | Role |
|---|---|
| `api-gateway` | Serves EJS pages and acts as the web entry point |
| `car-configurator` | Configuration logic and price calculation |
| `merch-shop` | Product catalog |
| `ai-feature` | Gemini integration and recommendation logic |
| `shopping-cart` | Cart state management |
| `mysql` | Single MySQL instance with per-service schemas |
| `redis` | Cart state store |
| `minio` | Object storage for configurator images |

## 6. Functional Requirements

### 6.1 Car Configurator (`car-configurator`)

- Supports **2 car models**; user first selects a model, then configures options within that model (e.g. color, trim, wheels)
- All valid combinations per model are pre-generated; each maps to a stored image and a price
- The service receives model + selected parameters, validates the combination, looks up the image, and calculates the final price
- Images are pre-uploaded to MinIO; the service looks up the image key in MySQL and retrieves the object from MinIO — it does not generate images
- Returns: model, selected options, image reference, base price, option price adjustments, final price, configuration ID, and structured rationale metadata (recommendation tags, advantages, disadvantages, suitability labels)
- `configurator` is the sole source of truth for combination validity, image mapping, and price

Minimum response fields for downstream consumers:

- `configurationId`
- `model`
- `selectedOptions`
- `basePrice`
- `optionAdjustments`
- `finalPrice`
- `imageReferences`
- `rationale`

### 6.2 Merchandise (`merch-shop`)

- Sells car-related **peripheral/accessory products** (e.g. branded apparel, scale models, accessories) — not the cars themselves
- Stores product catalog in MySQL (`merchandise_db`)
- Provides: product list, product detail, price, and metadata
- Sufficient for display and adding items to cart

Product detail requirements:

- Every merch item must be addressable through a stable product identifier.
- The web application must provide a product-detail experience that can be opened directly from a link.
- AI recommendations for merch must resolve to that detail experience rather than only to the generic listing page.

### 6.3 Route Planning (client-side via Maps JS API)

- No standalone road service; route planning runs entirely in the browser
- `api-gateway` injects the Maps API key into the EJS template at render time and exposes an endpoint returning the hardcoded store/showroom destination list
- The browser loads Maps JS API, calls `DirectionsService` to calculate the route, and renders it with `DirectionsRenderer`
- No backend call to Google Maps at runtime

Destination list requirements:

- The list of supported BMW destinations is product-owned data, even if the entries are static in v1.
- The frontend must obtain that list from `api-gateway` through an internal endpoint.
- The endpoint payload must include enough data to render the selector and route target, such as `id`, `name`, and `destination` or equivalent address data.

### 6.4 AI Assistant (`ai-feature`)

Global shopping assistant accessible from any page, not general-purpose Q&A. Helps users with both car configuration selection and merchandise recommendations.

Flow:
1. User submits natural language input from anywhere in the app
2. `ai-feature` fetches relevant data: configuration options (both models) + merchandise catalog
3. Calls Gemini API with user prompt + domain context
4. Gemini determines intent (car config recommendation, merchandise recommendation, or both) and returns structured parameters + rationale
5. For car recommendations: `ai-feature` calls `configurator` to resolve the official result
6. Returns final payload to the web application

Output format — all recommendations are returned as **links** pointing to the relevant page:
- Car recommendation: link to the configurator page pre-filled with recommended model + options, with rationale (advantages, disadvantages, suitability)
- Merchandise recommendation: link to a merch shop product detail page, with rationale
- May return both a car link and one or more merchandise links in a single response

`ai-feature` does not define prices or image mappings directly.

Prompt and output contract requirements:

- `ai-feature` must use a stable prompt template that constrains model output into a machine-readable schema.
- The output contract must separate free-text explanation from structured recommendation payloads.
- The contract must support both car and merch recommendations in a single response.
- For car recommendations, the structured payload must be rich enough for `configurator` resolution.
- For merch recommendations, the structured payload must identify the concrete product target used by the merch detail link.
- The design should allow the model to infer recommendation reasoning, while the frontend consumes predictable fields.

### 6.5 Unified Cart (`shopping-cart`)

- Stores state in Redis, keyed by session ID
- Supports: add car configuration, add merchandise item, list cart, remove item, update quantity
- Car items are stored as snapshots (not raw parameters), containing: selected options, image reference, final price, summary label
- Snapshots allow cart display even if `configurator` is unavailable

Quantity update requirements:

- Merchandise items must support explicit quantity changes after being added to the cart.
- Quantity changes must immediately affect cart totals.
- The cart API must expose an update operation for quantity changes without requiring delete-and-readd flows.
- Car items may remain quantity-limited by product decision, but the cart contract must define that behavior explicitly.

## 7. Data Storage

### 7.1 MySQL Schemas

| Schema | Owner | Contents |
|---|---|---|
| `configurator_db` | `car-configurator` | model definitions (2 models), option definitions per model, valid combinations, image paths, price data, rationale metadata |
| `merchandise_db` | `merch-shop` | product catalog, prices, metadata |

`ai-feature` and `shopping-cart` have no MySQL schemas. Route planning is currently handled at the web layer rather than in a standalone service.

### 7.2 Redis

Used exclusively by `cart`. Stores cart state as JSON per session key.

### 7.3 MinIO

Used to store pre-generated configurator images as objects.

## 8. Acceptance Notes for Phase Planning

The following items are considered part of the intended product and should remain visible in planning, even if delivered in different phases:

- merch recommendation links landing on a concrete product-detail experience
- structured AI prompt/template and output schema design
- cart quantity-update behavior
- `api-gateway` endpoint for route destinations
