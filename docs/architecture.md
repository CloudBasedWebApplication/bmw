# System Architecture

## 1. Purpose

This document describes the high-level architecture of the BMW cloud web app course project. It summarizes the agreed system boundaries, service responsibilities, main data flow, and infrastructure dependencies.

The system is designed around one web application, one API gateway, and multiple backend microservices. The first version is optimized for local Docker-based development and demonstration, while still keeping service ownership clear.

For product-level expected behavior, refer to `docs/PRD.md`. This architecture document focuses on responsibility boundaries and request/data flow rather than delivery status.

## 2. Architecture Diagram

```mermaid
flowchart LR
    user["User"]
    webapp["Web App\nEJS pages + static assets"]
    gateway["API Gateway\nAPI proxying"]

    subgraph backend["Microservices"]
        configurator["Car Configurator Service"]
        merchandise["Merch Shop Service"]
        ai["AI Feature Service"]
        cart["Shopping Cart Service"]
    end

    subgraph data["Data Stores"]
        mysql["MySQL"]
        redis["Redis"]
        minio["MinIO"]
    end

    subgraph external["External APIs"]
        gemini["Gemini API"]
        googlemaps["Google Maps API"]
    end

    user --> webapp
    webapp --> gateway

    gateway --> configurator
    gateway --> merchandise
    gateway --> ai
    gateway --> cart

    user --> googlemaps

    configurator --> mysql
    configurator --> minio

    merchandise --> mysql

    ai --> gemini
    ai --> configurator
    ai --> mysql
    ai --> merchandise

    cart --> redis

    cart -. "stores car snapshot" .-> configurator
    cart -. "stores merchandise snapshot" .-> merchandise
```

The Mermaid source is also stored separately in `docs/diagrams/architecture.mmd`.

## 3. Architecture Overview

The architecture follows a simple microservice structure:

- one web application for user interaction, EJS page rendering, and static assets
- one API gateway for API request forwarding
- four backend domain services
- one relational database for persistent business data
- one cache store for cart state
- one object storage service for configurator images
- one backend AI integration through the `ai-feature` service
- one client-side map integration through the Google Maps JavaScript API

The web application is the single browser-facing entry point in local development. Browser API calls use same-origin `/api/*` routes, which are forwarded to the API gateway. Business truth remains in the backend services.

## 4. Main Components

### 4.1 Web App

The `services/web-app` service provides the browser-facing presentation layer.

Its responsibilities are:

- render the EJS pages for Home, Configurator, Merch Shop, AI Feature, and Shopping Cart
- serve static assets for the web experience, such as fonts and images under `/home/static`
- keep the existing page routes stable for the browser
- forward same-origin `/api/*` requests to the API gateway

The web app does not own configuration validity, official pricing, AI recommendation logic, or cart persistence rules.

### 4.2 API Gateway

The `api-gateway` service provides the API-facing entry point for the frontend.

Its responsibilities are:

- proxy API requests to backend services
- provide internal product-owned support data such as the predefined route destination list
- maintain the session cookie used for cart tracking

It intentionally does not render EJS pages and does not serve static assets.

### 4.3 Configurator Service

The configurator service is the source of truth for car configuration results.

Its responsibilities are:

- support two car models; the user selects a model first, then configures options within that model
- receive model and selected parameters, validate the combination
- look up the image key in MySQL for the matching combination, then retrieve the image from MinIO
- calculate final price in the backend
- return structured metadata such as advantages, disadvantages, and recommendation labels

The service does not generate images. It looks up a pre-uploaded image object in MinIO using the key stored in MySQL for the given combination.

### 4.4 Merch Shop Service

The merch shop service provides product information for the merchandise page.

Its responsibilities are:

- return product list and detail information
- read merchandise data from MySQL
- support cart addition and display use cases
- provide stable product identifiers suitable for direct linking from AI recommendations and the web application

### 4.5 Route Planning

There is no standalone road service. Route planning runs entirely in the browser using the Google Maps JavaScript API.

- the `web-app` injects the Maps API key server-side into the EJS template
- the browser loads Maps JS API and uses `DirectionsService` and `DirectionsRenderer`
- the `api-gateway` holds a hardcoded list of store and showroom destinations, returned via `/api/destinations`
- no backend call is made to Google Maps at runtime

### 4.6 AI Feature Service

The AI feature service is a global shopping assistant accessible from any page. It handles both car configuration recommendations and merchandise recommendations.

Its responsibilities are:

- accept user natural-language prompts
- fetch relevant context: configuration options and merchandise catalog
- send structured context and a stable prompt/template to Gemini
- receive structured recommendation output and rationale from Gemini
- call `configurator` to resolve the official car configuration result
- return recommendations as links and structured merchandise recommendation items

This service does not own official pricing or image truth. Those remain in the configurator service.

### 4.7 Shopping Cart Service

The cart service manages the unified cart.

Its responsibilities are:

- store cart state in Redis
- aggregate both car configurations and merchandise items
- store displayable snapshots rather than only raw identifiers
- support quantity changes for merchandise items as part of standard cart editing

For car items, the cart should persist enough snapshot data to show the selected result without requiring a fresh configurator lookup for every render.

## 5. Data Stores

### 5.1 MySQL

MySQL stores persistent business data:

- configuration option definitions
- option values
- valid configuration combinations
- combination image paths or URLs
- pricing information
- rationale metadata
- merchandise catalog data

The first version uses a table-driven lookup model instead of a complex rules engine.

### 5.2 Redis

Redis stores shopping cart state. It is used because the cart is session-oriented and needs low-latency updates for add, remove, quantity update, and display operations.

### 5.3 MinIO

MinIO stores pre-generated configurator and merchandise images. It is used because these images are binary assets rather than relational records.

## 6. External Integrations

### 6.1 Gemini API

Gemini is used only by the AI feature service.

Its role is to:

- interpret natural-language user intent
- recommend structured configuration parameters
- generate recommendation rationale and trade-off explanations
- emit structured merchandise recommendation items for the frontend recommendation panel

### 6.2 Google Maps JavaScript API

The Maps JS API is loaded client-side in the browser. The API key is injected into the EJS template by `web-app` at render time and restricted by HTTP referrer in Google Cloud Console.

Its role is to:

- render an interactive map in the browser
- calculate routes from the user's current location to a selected store destination via `DirectionsService`
- display the route on the map via `DirectionsRenderer`

## 7. Main Request Flows

### 7.1 Standard Configurator Flow

1. the user selects configuration options in the web app
2. the web app calls `/api/configurator/...`
3. the API gateway forwards the request to the configurator service
4. the configurator service validates the selection
5. the configurator service resolves the image and price
6. the frontend displays the official result

### 7.2 AI Recommendation Flow

1. the user enters a natural-language request
2. the frontend calls `/api/ai/recommend`
3. the API gateway forwards the request to the AI feature service
4. the AI feature service reads relevant context
5. the AI feature service calls Gemini
6. Gemini returns structured recommendation output and rationale
7. the AI feature service calls the configurator service
8. the configurator service returns the official configuration result
9. the frontend shows the recommended configuration and merch recommendation panel

### 7.3 Cart Flow

1. the frontend sends a selected car configuration or merchandise item to `/api/cart/...`
2. the API gateway forwards the request to the cart service
3. the cart service stores a snapshot in Redis
4. the frontend may update merchandise quantity through the cart API
5. the frontend reads the aggregated cart through the cart API

### 7.4 Route Planning Flow

1. the user opens the route planning page; the browser loads Maps JS API with the key injected by `web-app`
2. the frontend fetches the destination list through `/api/destinations`
3. the user selects a destination; the browser calls `DirectionsService` directly
4. `DirectionsRenderer` draws the route on the map in the browser

## 8. Key Design Decisions

The architecture reflects the following agreed decisions:

- one unified web app is used instead of multiple frontend applications
- server-side rendering and static web assets are separated into `services/web-app`
- `api-gateway` is kept focused on API proxying and request forwarding
- the configurator uses pre-generated images instead of live rendering
- pre-generated images are stored in MinIO
- backend services own business truth
- configuration pricing is calculated in the backend
- AI recommendation is implemented through a service-to-service flow, not a direct frontend-to-Gemini shortcut
- AI recommendation should use a stable prompt/template plus structured output contract
- cart stores snapshots for display stability
- route planning runs client-side via Maps JS API; the key is injected by `web-app` and the destination list is served by `api-gateway`

## 9. First-Version Constraints

To keep the course project deliverable realistic, the first version intentionally stays simple:

- no authentication system
- no production order flow
- no live rendering engine
- no complex pricing rule engine
- no arbitrary destination search requirement
- no dedicated Nginx or edge proxy container in the first version

These constraints reduce implementation cost while preserving architectural clarity.
