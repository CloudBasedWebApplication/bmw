# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BMW Cloud Web App — a course project. One unified frontend (`apps/web`) + five backend microservices, all Node.js/Express, running locally via Docker Compose. No auth, no message queue.

See [`docs/architecture.md`](docs/architecture.md) for the full architecture reference.

## Running

```bash
docker compose up mysql redis  # infrastructure only
docker compose up              # all services
```

Service ports: `web` 3000 · `configurator` 3001 · `merchandise` 3002 · `road` 3003 · `ai-feature` 3004 · `cart` 3005.

Within Docker, services reach each other by container name (`mysql`, `redis`), not `localhost`.

## Key Principles

- **`configurator` is the sole source of truth** for car combinations, image paths, and prices. No other service calculates or stores these.
- **`cart` stores snapshots**, not raw parameters. Cart items must be displayable without a live `configurator` call.
- **`ai-feature` returns links**, not data. Output is a URL to the configurator page (pre-filled params) or a merchandise product page — never raw prices or images.
- **MySQL schemas are service-owned.** `configurator` owns `configurator_db`; `merchandise` owns `merchandise_db`. Cross-schema queries are not allowed.
- **Google Maps runs in the browser.** The `road` service only returns destination data. Route calculation and map rendering happen client-side via the Maps JS API, whose key is injected server-side into EJS templates.
