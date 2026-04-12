# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BMW Cloud Web App — a course project. One `api-gateway` (EJS frontend) + four backend microservices, all Node.js/Express, running locally via Docker Compose. No auth, no message queue.

See [`docs/architecture.md`](docs/architecture.md) for the full architecture reference.

## Running

```bash
docker compose up mysql redis minio  # infrastructure only
docker compose up                    # all services
```

Service ports: `api-gateway` 3000 · `car-configurator` 3001 · `merch-shop` 3002 · `ai-feature` 3004 · `shopping-cart` 3005.

Within Docker, services reach each other by container name (`mysql`, `redis`, `minio`), not `localhost`.

## Key Principles

- **`car-configurator` is the sole source of truth** for car combinations, image keys, and prices. No other service calculates or stores these.
- **Configurator retrieves images, never generates them.** Images are pre-uploaded to MinIO. The service looks up the image key in MySQL and fetches the object from MinIO.
- **`shopping-cart` stores snapshots**, not raw parameters. Cart items must be displayable without a live `car-configurator` call.
- **`ai-feature` returns links**, not data. Output is a URL to the configurator page (pre-filled params) or a merch-shop product page — never raw prices or images.
- **MySQL schemas are service-owned.** `car-configurator` owns `configurator_db`; `merch-shop` owns `merchandise_db`. Cross-schema queries are not allowed.
- **Google Maps runs in the browser.** No backend call to Google Maps at runtime. `api-gateway` injects the Maps API key into EJS templates and serves the destination list. Route calculation and rendering happen client-side via `DirectionsService` + `DirectionsRenderer`.

