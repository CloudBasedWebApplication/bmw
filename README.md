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
│  ├─ web-app/
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

This directory keeps backend service URLs internal. It forwards API requests to the owning microservices and manages the anonymous cart session cookie.

### `web/`

Contains shared browser assets and EJS templates used by the web application.

- `web/views/`: EJS page templates and layouts
- `web/public/`: static browser assets served by the web app

### `services/`

Contains the browser-facing web app and backend microservices.

- `services/web-app/`: browser-facing entry application; renders all HTML/EJS pages, serves static assets, and forwards same-origin `/api/*` calls to `api-gateway`
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

`MINIO_PUBLIC_URL` controls the image URLs that are sent to the browser. Keep the default for local development:

```env
MINIO_PUBLIC_URL=http://localhost:9000
```

If another device opens the app, `localhost` would point to that device instead of your Docker host. In that case, set `MINIO_PUBLIC_URL` to a browser-reachable host:

```env
MINIO_PUBLIC_URL=http://192.168.178.20:9000
```

For GitHub Codespaces, forward port `9000` and use the forwarded MinIO URL:

```env
MINIO_PUBLIC_URL=https://<codespace-name>-9000.app.github.dev
```

After changing `.env`, recreate the affected containers:

```bash
docker compose up -d car-configurator merch-shop
```

### 2. Start the full local stack

```powershell
docker compose up --build
```

This starts the gateway, all microservices, MySQL, Redis, MinIO, and the MinIO bootstrap container.
Host port `3000` belongs to `web-app`; `api-gateway` is internal and is reached through `API_GATEWAY_URL`.

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
The Home page assets from `web/public/images/` are also mirrored into `MINIO_BUCKET/home`.

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

4. Optional: open the MinIO console at `http://localhost:9001`.

The sync writes object keys with stable prefixes:

- `configurator/<filename>`
- `merch-shop/<filename>`

Example object keys:

- `configurator/1_front.jpg`
- `merch-shop/BMW_Merchandise_Sweatshirt.avif`

For new merch assets, prefer ASCII-only filenames in `assets/merch-shop/` so object keys stay stable across encodings. For example, use `weiss` instead of `weiß` in filenames.

Excel files in those folders are ignored during upload.
