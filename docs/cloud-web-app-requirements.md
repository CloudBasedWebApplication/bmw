# Cloud Web App Requirements

## 1. Background

A course assignment for a cloud web application. The product is an automotive platform centered around a car configurator, with additional features for merchandise browsing, route planning, an AI shopping assistant, and a unified cart.

The main purpose is to demonstrate service decomposition, containerized local development, and integration with external infrastructure (database, cache, AI API, map API).

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | EJS (server-side rendering) + vanilla JS |
| Backend | Node.js + Express |
| Primary DB | MySQL (single instance, one schema per service) |
| Cache | Redis |
| AI | Gemini API |
| Map | Google Maps JavaScript API (client-side) |
| Orchestration | Docker Compose |

## 3. Scope

### In Scope

- One unified frontend (EJS templates served by a frontend/gateway service)
- Five backend services: `configurator`, `merchandise`, `road`, `ai-feature`, `cart`
- MySQL for persistent domain data
- Redis for cart state
- Gemini API for AI recommendations
- Google Maps JavaScript API for route planning and map rendering

### Out of Scope (v1)

- Authentication and user accounts
- Live 3D or real-time car rendering
- Order and payment workflow
- Complex configuration rule engine
- Inventory or pricing synchronization
- Message queue (all inter-service calls are synchronous REST)

## 4. Architecture

### Service Communication

All inter-service calls are synchronous HTTP REST. No message queue. Key call chains:

- Frontend → each backend service directly
- `ai-feature` → `configurator` (to resolve official car config result)
- `ai-feature` → `merchandise` (to fetch product catalog for context)
- Frontend → `cart` (add car snapshot or merchandise item)

### Cart Session

No login. Cart state is keyed by a session ID (generated client-side or by a cookie). Redis key format: `cart:{sessionId}`.

### Docker Containers

| Container | Role |
|---|---|
| `frontend` | Serves EJS pages, proxies API calls |
| `configurator` | Configuration logic and price calculation |
| `merchandise` | Product catalog |
| `road` | Store destinations data, route API proxy |
| `ai-feature` | Gemini integration and recommendation logic |
| `cart` | Cart state management |
| `mysql` | Single MySQL instance with per-service schemas |
| `redis` | Cart state store |

## 5. Functional Requirements

### 5.1 Car Configurator (`configurator`)

- Supports **2 car models**; user first selects a model, then configures options within that model (e.g. color, trim, wheels)
- All valid combinations per model are pre-generated; each maps to a stored image and a price
- The service receives model + selected parameters, validates the combination, looks up the image, and calculates the final price
- Returns: model, selected options, image reference, base price, option price adjustments, final price, configuration ID, and structured rationale metadata (recommendation tags, advantages, disadvantages, suitability labels)
- `configurator` is the sole source of truth for combination validity, image mapping, and price

### 5.2 Merchandise (`merchandise`)

- Sells car-related **peripheral/accessory products** (e.g. branded apparel, scale models, accessories) — not the cars themselves
- Stores product catalog in MySQL (`merchandise_db`)
- Provides: product list, product detail, price, and metadata
- Sufficient for display and adding items to cart

### 5.3 Road and Route Planning (`road`)

- Stores predefined store/showroom destinations (name + coordinates) in the service
- Returns destination list to the frontend
- The frontend uses Google Maps JavaScript API to render the map and calculate routes from the user's current location to the selected destination
- Google Maps API key is injected server-side into the EJS template

### 5.4 AI Assistant (`ai-feature`)

Global shopping assistant accessible from any page, not general-purpose Q&A. Helps users with both car configuration selection and merchandise recommendations.

Flow:
1. User submits natural language input from anywhere in the app
2. `ai-feature` fetches relevant data: configuration options (both models) + merchandise catalog
3. Calls Gemini API with user prompt + domain context
4. Gemini determines intent (car config recommendation, merchandise recommendation, or both) and returns structured parameters + rationale
5. For car recommendations: `ai-feature` calls `configurator` to resolve the official result
6. Returns final payload to frontend

Output format — all recommendations are returned as **links** pointing to the relevant page:
- Car recommendation: link to `configurator` page pre-filled with recommended model + options, with rationale (advantages, disadvantages, suitability)
- Merchandise recommendation: link to product detail page in `merchandise`, with rationale
- May return both a car link and one or more merchandise links in a single response

`ai-feature` does not define prices or image mappings directly.

### 5.5 Unified Cart (`cart`)

- Stores state in Redis, keyed by session ID
- Supports: add car configuration, add merchandise item, list cart, remove item, update quantity
- Car items are stored as snapshots (not raw parameters), containing: selected options, image reference, final price, summary label
- Snapshots allow cart display even if `configurator` is unavailable

## 6. Data Storage

### MySQL Schemas

| Schema | Owner | Contents |
|---|---|---|
| `configurator_db` | `configurator` | model definitions (2 models), option definitions per model, valid combinations, image paths, price data, rationale metadata |
| `merchandise_db` | `merchandise` | product catalog, prices, metadata |

`road`, `ai-feature`, and `cart` have no MySQL schemas.

### Redis

Used exclusively by `cart`. Stores cart state as JSON per session key.
