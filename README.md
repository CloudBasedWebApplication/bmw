# BMW Cloud Web App

Course project for a cloud-based web application built with a microservices architecture.

## Directory Structure

```text
bmw/
├─ apps/
│  └─ web/
├─ services/
│  ├─ configurator/
│  ├─ merchandise/
│  ├─ road/
│  ├─ ai-feature/
│  └─ cart/
├─ infrastructure/
│  └─ mysql/
├─ assets/
│  ├─ configurator/
│  └─ merchandise/
├─ docs/
│  └─ diagrams/
├─ scripts/
├─ .env.example
├─ docker-compose.yml
└─ README.md
```

## What Each Directory Is For

### `apps/`

Contains user-facing applications.

- `apps/web/`: the unified frontend for configurator, merchandise, route planning, AI assistant, and cart

### `services/`

Contains all backend microservices.

- `services/configurator/`: resolves selected options into a pre-generated image, validates combinations, and calculates price
- `services/merchandise/`: provides merchandise catalog and product detail data
- `services/road/`: handles route planning through Google Maps related APIs
- `services/ai-feature/`: integrates Gemini, generates recommendations, and calls the configurator service
- `services/cart/`: stores and returns unified cart state for both car configurations and merchandise

### `infrastructure/`

Contains local infrastructure-related files used by Docker.

- `infrastructure/mysql/`: MySQL initialization scripts and seed data for local development

### `assets/`

Contains business assets that are not source code.

- `assets/configurator/`: pre-generated configurator images and related metadata
- `assets/merchandise/`: merchandise-related static assets if needed later

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
