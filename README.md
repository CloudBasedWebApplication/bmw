# BMW Cloud Web App

Course project for a cloud-based web application built with a microservices architecture.

## Directory Structure

```text
bmw/
├─ api-gateway/
│  └─ src/
├─ web/
│  ├─ public/
│  └─ views/
├─ services/
│  ├─ web-shop-frontend/
│  ├─ web-shop-backend/
│  ├─ car-configurator/
│  ├─ merch-shop/
│  ├─ ai-feature/
│  └─ shopping-cart/
├─ assets/
│  └─ configurator/
├─ docs/
│  └─ diagrams/
├─ scripts/
├─ .env.example
├─ docker-compose.yml
└─ README.md
```

## What Each Directory Is For

### `api-gateway/`

Contains the API proxy and support endpoints.

- `api-gateway/src/`: API proxy routes, health/support endpoints, and session-cookie handling

This directory keeps backend service URLs internal. It forwards API requests to the owning microservices and manages the anonymous cart session cookie. The `/api/destinations` endpoint is gateway support data for predefined BMW route targets, not a separate Route Planning microservice.

### `web/`

Contains shared browser assets and EJS templates used by the web-shop presentation services.

- `web/views/`: EJS page templates and layouts
- `web/public/`: static browser assets served by `web-shop-frontend`

### `services/`

Contains the split web-shop presentation layer and backend microservices.

- `services/web-shop-frontend/`: browser-facing entry service; serves `/static`, exposes host port 3000, and forwards all other requests to `web-shop-backend`
- `services/web-shop-backend/`: renders all HTML/EJS pages, forwards same-origin `/api/*` calls to `api-gateway`, and fetches merch SSR data through the gateway
- `services/car-configurator/`: resolves selected options into a pre-generated image, validates combinations, and calculates price
- `services/merch-shop/`: provides merchandise catalog and product detail data
- `services/ai-feature/`: integrates Gemini, generates recommendations, and calls the configurator service
- `services/shopping-cart/`: stores and returns unified cart state for both car configurations and merchandise

### `assets/`

Contains business assets that are not source code.

- `assets/configurator/`: pre-generated configurator images and related metadata

### `docs/`

Contains project documentation.

- requirements, architecture notes, and API-related documents are stored here
- `docs/diagrams/`: Mermaid or other diagram source files

### `scripts/`

Contains helper scripts for local development, setup, and data preparation. The directory is kept flat for now and should only be split later if real script volume justifies it.


## Important Root Files

- `.env.example`: shared environment variable template
- `docker-compose.yml`: local multi-container runtime definition
- `README.md`: repository overview and onboarding entry point

## Local Development

The project is intended to run locally with Docker during the first development phase.

### 1. Prepare the environment file

macOS:

```bash
cp .env.example .env # MacOS
Copy-Item .env.example .env # Windows
```

After copying the file, fill in at least `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` in `.env`.
If you want to override the Gemini model selection locally, `GEMINI_MODEL` defaults to `gemini-2.5-flash` and `GEMINI_FALLBACK_MODEL` defaults to `gemini-2.5-flash-lite`.

MinIO API port `9000` is Docker-internal only. Browser-visible product image URLs are owned API asset routes (`/api/configurator/assets/*` and `/api/merch/assets/*`) that flow through the web-shop frontend, web-shop backend, API gateway, and owning service before reading MinIO. Only the MinIO console/debug port `9001` is host-exposed.

After changing `.env`, recreate the affected containers:

```bash
docker compose up -d car-configurator merch-shop
```

### 2. Start the full local stack

```powershell
docker compose up --build
```

This starts the web-shop frontend/backend, gateway, all microservices, MySQL, Redis, MinIO, and the MinIO bootstrap container.
Host port `3000` belongs to `web-shop-frontend`; `web-shop-backend`, `api-gateway`, and domain microservices are internal. The backend reaches the gateway through `API_GATEWAY_URL`.

### 3. Open the app

After the containers are healthy, open [http://localhost:3000](http://localhost:3000).

### 4. Stop the stack

```powershell
docker compose down
```

### When to restart vs. recreate a container

| What changed | Command | Why |
|---|---|---|
| Source code (service **with** volume mount) | `docker compose restart <service>` | Code is read from the host at runtime — a process restart is enough |
| Source code (service **without** volume mount) | `docker compose up --build -d <service>` | Code is baked into the image — a rebuild is required |
| `.env` / environment variables | `docker compose up -d <service>` | Env vars are injected at container creation; `restart` keeps the old values |
| `Dockerfile` or `docker-compose.yml` | `docker compose up --build -d <service>` | Image or container config changed — rebuild and recreate |

**Rule of thumb:** `docker compose restart` only restarts the process inside an existing container. Anything frozen at container-creation time (env vars, built-in code, image layers) requires `up -d` (recreate) or `up --build -d` (rebuild + recreate) to take effect.

## MinIO Image Sync

Images are imported from the project folders `assets/configurator/` and `assets/merch-shop/` into the MinIO bucket `MINIO_BUCKET`.
Home page presentation assets live under `web/public/images/` and are served by `web-shop-frontend` as `/static/images/<file>`.

Phase 2 keeps product image objects in MinIO, but removes presentation-tier direct access to MinIO. Browser image requests use same-origin API routes:

- `GET /api/configurator/assets/*`
- `GET /api/merch/assets/*`

Those routes flow through `web-shop-frontend`, `web-shop-backend`, and `api-gateway` to the owning service, which streams the object from Docker-internal MinIO. The old `/minio/*` browser URL path has been deleted rather than kept as a redirect. MinIO API port `9000` is Docker-internal only; port `9001` remains available for local console/debug access.

1. Put the car images into `assets/configurator/` and the merchandise images into `assets/merch-shop/`.
2. Put the Home page images into `web/public/images/`.
3. Start the infrastructure:

```bash
docker compose up -d mysql redis minio minio-init
```

The `minio-init` service waits until MinIO is healthy, creates the bucket automatically, and syncs the images once on startup.

4. If you want to re-sync the images later after adding or changing files:

macOS:

```bash
./scripts/sync-minio-images.sh  # MacOS
docker compose run --rm minio-init # Windows
```

4. Optional local infrastructure/debug access: open the MinIO console at `http://localhost:9001`. This is not part of the browser-facing application or image URL path.

The sync writes object keys with stable prefixes:

- `configurator/<filename>`
- `merch-shop/<filename>`

Example object keys:

- `configurator/1_front.jpg`
- `merch-shop/BMW_Merchandise_Sweatshirt.avif`

For new merch assets, prefer ASCII-only filenames in `assets/merch-shop/` so object keys stay stable across encodings. For example, use `weiss` instead of `weiß` in filenames.

Excel files in those folders are ignored during upload.
