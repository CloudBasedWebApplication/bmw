# Containers, Docker, Docker Compose, the PaaS Effect

Source: lecture's Chapters 8 (Docker / Docker Compose / CaaS) and 9 (PaaS).

## Why containers belong in the architecture conversation

A container is a packaging and isolation unit for a single process tree along with all of its runtime dependencies (libraries, configuration, files). For architecture purposes, three properties matter:

1. **A container is a self-contained, immutable deployable** — built once, run anywhere the runtime exists.
2. **A container is a unit of scaling** — orchestrators add and remove containers based on load.
3. **A container is a single concern** — the Docker convention is "one process per container", which forces decomposition along the same lines as a microservice would.

Containers therefore shape what "a component" on the architecture diagram physically becomes.

## Container as a Service (CaaS)

The cloud provider runs the container runtime and orchestration; you supply images.

Examples: AWS ECS (with Fargate), Azure Container Instances, Google Cloud Run, every managed Kubernetes offering (EKS, AKS, GKE).

Architecturally, CaaS sits between IaaS (where you also manage the OS) and PaaS (where you also leave the runtime to the provider). It is the right level when:

- The application is containerised and you want to keep the container as the deployable unit.
- You want elastic scaling, health checks, restart-on-failure, but you do not want to fit your app into a specific PaaS's framework conventions.
- You need fine-grained control over base image, OS-level libraries, sidecars.

## Multi-Container Application — definition

> **Multi-Container Application** — a composed application that consists of multiple individual software components that work together to provide the application's overall functionality, i.e., they communicate with each other. These software components are deployed in different containers that are wired and communicate with each other.

Most non-trivial cloud-native web applications are multi-container — at minimum a frontend container, a backend container, a DB container, a cache container, a blob-store container in development.

## Docker Compose

Docker Compose is a tool for defining and running Multi-Container Applications. A **Docker Compose file** is a YAML file that describes:

- **Services** — the containers to deploy, with image, environment variables, ports, dependencies.
- **Virtual networks** — how containers are connected.
- **Volumes** — persistent storage attached to containers.

A whole multi-container stack starts with `docker compose up`.

### What Compose is good for

- **Local development environments** — bring up the full stack on a developer's laptop with one command.
- **Reproducible demos and tutorials** — exactly what the HHZ stack uses.
- **Integration testing** — same stack, ephemeral, in CI.
- **Simple single-host production** — small applications, hobby projects.

### What Compose is **not** good for

- **Production at any meaningful scale.** Compose is single-host. It has no orchestrated scheduling across nodes, no rolling updates beyond basic, no autoscaling, no service mesh, no advanced health-check semantics. For production cloud-native deployments, the unit is Kubernetes, ECS, Cloud Run, or a PaaS — *not* Compose.
- Treating Compose as "lightweight Kubernetes" hides architectural decisions that need to be made for production.

For the HHZ project: Compose for local dev is fine and standard. The Architekturdokumentation must distinguish between **development deployment** (Compose) and **production deployment** (CaaS / PaaS / IaaS). The architecture diagram is about the logical structure; the deployment options describe how it lands.

## The HHZ technology stack — concrete component mapping

The lecture's reference Web Shop is a deliberately complete multi-container stack:

| Component | Role | Container |
|---|---|---|
| **HTML / CSS / JavaScript** | Presentation Tier (client side) | served from the web shop frontend container |
| **Node.js + Express** | Web Shop Backend (Business Logic Tier) | one container, or several when decomposed into microservices |
| **MySQL** | Relational DBaaS substitute in dev (Data Tier) | one container with a persistent volume |
| **MinIO** | S3-compatible Blob Storage in dev (Data Tier) | one container with a persistent volume |
| **Redis** | Cache aaS substitute in dev (Data Tier) | one container, memory-only |
| **Docker** | Container runtime | host |
| **Docker Compose** | Multi-container orchestration in dev | host |

Production-mapping:

- Node.js → CaaS (Cloud Run / ECS) or PaaS (Beanstalk / App Engine).
- MySQL → managed relational DBaaS (RDS / Cloud SQL / Azure Database for MySQL).
- MinIO → managed Blob aaS (S3 / GCS / Azure Blob Storage). The point of MinIO in dev is that it speaks S3 API, so the production swap is configuration-only.
- Redis → managed Cache aaS (ElastiCache / Memorystore / Azure Cache for Redis).

This dev/prod symmetry is a deliberate architectural choice: same protocols, different operators.

## The "PaaS Effect"

The lecture has a slide titled "Summary of typical IaaS-related problems" leading into "The PaaS Effect". The point is that IaaS leaves the consumer responsible for:

- Updating runtimes (Tomcat / Node) when security patches drop.
- Restarting web servers on error.
- Managing licences.
- Specifying scaling rules manually.

PaaS hands all of that to the provider. The cost is less control (e.g., specific runtime versions, OS-level tweaks) and increased lock-in (every PaaS's "manifest" or "buildpack" is its own format).

CaaS is the middle ground: the cloud manages the container runtime and the orchestrator, but the container image is yours — you choose the runtime version, base image, dependencies. FaaS is one step further: the cloud manages even more, you supply only the function.

Architecturally, the **PaaS effect** is a recurring decision per component: "how much of this layer should we let the cloud manage?" The answer is not uniform across an architecture; each component can sit at a different rung on the IaaS → CaaS → PaaS → FaaS → SaaS ladder.

## How to write this section of the Architekturdokumentation

For each component:

1. State the **packaging unit** — container image, VM image, function code, etc.
2. State the **deployment target** — IaaS / CaaS / PaaS / FaaS, in dev and in production separately.
3. Justify the chosen rung — what control you gain by being lower, what operational cost you escape by being higher.
4. If Compose is used in dev, state that explicitly; do not let it leak into the production architecture diagram.
