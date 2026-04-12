# System Architecture

## 1. Purpose

This document describes the high-level architecture of the BMW cloud web app course project. It summarizes the agreed system boundaries, service responsibilities, main data flow, and infrastructure dependencies.

The system is designed around one gateway-style web application with multiple backend microservices. The first version is optimized for local Docker-based development and demonstration, while still keeping service ownership clear.

## 2. Architecture Diagram

```mermaid
flowchart LR
    user["User"]
    gateway["API Gateway / Web App"]

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

    user --> gateway

    gateway --> configurator
    gateway --> merchandise
    gateway --> ai
    gateway --> cart
    gateway --> googlemaps

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

- one gateway-style web application for user interaction and page rendering
- four backend domain services
- one relational database for persistent business data
- one cache store for cart state
- one object storage service for configurator images
- one backend AI integration (Gemini API via `ai-feature` service)
- one map integration where route calculation is requested through the backend

The API gateway is the single entry point for the user. Business truth remains in the backend services.

## 4. Main Components

### 4.1 API Gateway / Web App

The `api-gateway` directory provides one user-facing application that combines:

- car configuration
- merchandise browsing
- route planning
- AI recommendation
- unified cart display

Its role is to:

- serve the UI pages
- collect browser requests
- call backend services
- accept a route-planning request using either the user's current location or a manually entered origin
- display the route result returned by the backend

It should not own configuration validity, official pricing, or cart persistence rules.

### 4.2 Configurator Service

The configurator service is the source of truth for car configuration results.

Its responsibilities are:

- support two car models; the user selects a model first, then configures options within that model
- receive model and selected parameters, validate the combination
- map the combination to a pre-generated image stored in MinIO
- calculate final price in the backend
- return structured metadata such as advantages, disadvantages, and recommendation labels

The service does not perform live rendering. Instead, it resolves user choices against stored combinations and associated image objects in MinIO.

### 4.3 Merch Shop Service

The merch shop service provides product information for the merchandise page.

Its responsibilities are:

- return product list and detail information
- read merchandise data from MySQL
- support cart addition and display use cases

### 4.4 Route Planning in the Gateway

There is currently no standalone `road` service directory in the repository.

Route planning is currently represented as a backend capability inside the web or gateway layer:

- the frontend can use the user's current location or allow manual origin input
- the backend keeps a hardcoded list of store or showroom destinations
- the frontend sends the origin and selected destination to the backend
- the backend requests route data from Google Maps and returns the route result
- the frontend renders the returned route information

If the team later restores a standalone `road` service, this document should be updated accordingly.

### 4.5 AI Feature Service

The AI feature service is a global shopping assistant accessible from any page. It handles both car configuration recommendations and merchandise recommendations.

Its responsibilities are:

- accept user natural-language prompts
- fetch relevant context: configuration options (both models) and merchandise catalog
- send structured context and prompt to Gemini
- receive recommended parameters and rationale from Gemini
- call `configurator` to resolve the official car configuration result
- return recommendations as links: a link to the configurator page pre-filled with recommended options, and/or links to merchandise product pages

This service does not own official pricing or image truth. Those remain in the configurator service.

### 4.6 Shopping Cart Service

The cart service manages the unified cart.

Its responsibilities are:

- store cart state in Redis
- aggregate both car configurations and merchandise items
- store displayable snapshots rather than only raw identifiers

For car items, the cart should persist enough snapshot data to show the selected result without requiring a fresh configurator lookup for every render.

## 5. Data Stores

### 5.1 MySQL

MySQL stores persistent business data.

Expected data domains include:

- configuration option definitions
- option values
- valid configuration combinations
- combination image paths or URLs
- pricing information
- rationale metadata
- merchandise catalog data

The first version uses a table-driven lookup model instead of a complex rules engine.

### 5.2 Redis

Redis stores shopping cart state.

It is used because the cart is session-oriented and needs low-latency updates for:

- add item
- remove item
- update quantity
- display current cart content

### 5.3 MinIO

MinIO stores pre-generated configurator images.

It is used because:

- configurator images are binary assets rather than relational records
- the configurator service can return stable object URLs or object keys
- it matches the intended object-storage pattern better than storing image files directly in the service codebase

## 6. External Integrations

### 6.1 Gemini API

Gemini is used only by the AI feature service.

Its role is to:

- interpret natural-language user intent
- recommend structured configuration parameters
- generate recommendation rationale and trade-off explanations

### 6.2 Google Maps API

Google Maps is used for route planning through the backend-facing web layer.

Its role is to:

- calculate routes from the user-provided origin to a hardcoded destination
- provide route information that the frontend can render

## 7. Main Request Flows

### 7.1 Standard Configurator Flow

1. the user selects configuration options in the frontend
2. the frontend calls the configurator service
3. the configurator service validates the selection
4. the configurator service resolves the image and price
5. the frontend displays the official result

### 7.2 AI Recommendation Flow

1. the user enters a natural-language request
2. the frontend calls the AI feature service
3. the AI feature service reads relevant context
4. the AI feature service calls Gemini
5. Gemini returns structured recommendation output and rationale
6. the AI feature service calls the configurator service
7. the configurator service returns the official configuration result
8. the frontend shows the recommended configuration and explanation

### 7.3 Cart Flow

1. the frontend sends a selected car configuration or merchandise item to the cart service
2. the cart service stores a snapshot in Redis
3. the frontend reads the aggregated cart from the cart service

### 7.4 Route Planning Flow

1. the user opens the route planning page in the web application
2. the user either shares current location or enters an origin manually
3. the user selects one of the hardcoded store destinations
4. the web layer sends the route request to the backend
5. the backend requests route data from Google Maps
6. the frontend displays the returned route result

## 8. Key Design Decisions

The architecture reflects the following agreed decisions:

- one unified web app is used instead of multiple frontend applications
- the repository currently uses an `api-gateway` directory as the web entry point
- the configurator uses pre-generated images instead of live rendering
- pre-generated configurator images are stored in MinIO
- backend services own business truth
- configuration pricing is calculated in the backend
- AI recommendation is implemented through a service-to-service flow, not a direct frontend-to-Gemini shortcut
- cart stores snapshots for display stability
- route planning accepts current location or manual origin input and uses hardcoded store destinations through backend routing logic

## 9. First-Version Constraints

To keep the course project deliverable realistic, the first version intentionally stays simple:

- no authentication system
- no production order flow
- no live rendering engine
- no complex pricing rule engine
- no arbitrary destination search requirement

These constraints reduce implementation cost while preserving architectural clarity.
