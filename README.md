# BMW Cloud Web App

Course project for a cloud-based web application built with a microservices architecture.

## Directory Structure

```text
bmw/
├─ api-gateway/
│  ├─ src/
│  └─ views/
├─ services/
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

Contains the user-facing entry application.

- `api-gateway/src/`: gateway and server-side application code
- `api-gateway/views/`: EJS templates rendered for the web UI

This directory acts as the unified entry point for the app. It serves the pages and coordinates calls to backend services.

### `services/`

Contains all backend microservices.

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

```bash
cp .env.example .env  # fill in GEMINI_API_KEY and GOOGLE_MAPS_API_KEY
```

## MinIO Image Sync

Configurator images should live in `assets/configurator/` locally and are mirrored into MinIO bucket `MINIO_BUCKET`.

1. Put the pre-generated car images into `assets/configurator/`.
2. Start the infrastructure:

```bash
docker compose up -d mysql redis minio
```

3. Create the bucket and upload or refresh the images:

```bash
./scripts/sync-minio-images.sh
```

4. Optional: open the MinIO console at `http://localhost:9001`.

The sync keeps the folder structure from `assets/configurator/` inside the bucket, so your MySQL image keys should match those object paths.
