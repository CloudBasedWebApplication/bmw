# Architectural Styles

The lecture frames system architecture as a small set of named **Architectural Styles** (or "System Architecture Patterns") which are *combined* — not used in isolation — for any real cloud application.

Sources: lecture's own framing for Monolith and Client-Server; Fehling et al. for Three-Tier Cloud Application; microservices.io / Richardson for Microservice Architecture; Hohpe & Woolf for Pipes-and-Filters; Fowler / Martin Fowler's article for Serverless reasoning.

## The styles taught in CBWAD

1. Monolithic
2. Client-Server (and its layer-distribution variants)
3. Three-Tier Cloud Application
4. Service-Oriented Architecture (SOA) — with or without an Enterprise Service Bus (ESB)
5. Microservice Architecture
6. Pipes-and-Filters (covered under integration patterns but is itself a structural style)
7. Serverless / FaaS-driven

> "Typically, a combination of multiple System Architecture Patterns is required for modern applications — especially if they have to handle a high workload and use the cloud."

Do not pick one style and stop. Real architectures stack them: a Three-Tier shape, with the Business Logic Tier decomposed into Microservices, fronted by an API Gateway, with one of those Microservices implementing Pipes-and-Filters internally over a message broker.

## Monolithic Architecture

All functionality lives in a single deployable software component.

**Benefits:**
- **Simplicity of development** — entire business processes implemented in one application; no network between components.
- **Mainly local errors** — bugs do not propagate across a network. Few external dependencies → few attack vectors.
- **Simple versioning** — only one application to maintain.
- **Simple deployment** — install on a single OS.
- **Simple code management** — one code base, one repo.

**Drawbacks:**
- **Rapidly growing complexity** — the larger the application, the harder development becomes.
- **Cumbersome maintenance** — updates require redeploying the whole app, often with downtime.
- **Limited scalability** — different functionalities cannot be scaled independently. If the search subsystem is hot but the catalogue is cold, you still replicate everything.
- **Limited technology flexibility** — one programming language for the whole thing.
- **Single point of failure** — if the application or its host crashes, the whole system goes down.
- **Architectural restrictions** — many modern styles and patterns simply cannot be applied within a monolith.

**Use when:**
- Desktop applications (e.g., Photoshop) used by a single user at a time.
- Internal tools with bounded user count and no scaling requirement.
- Early-stage products where you do not yet know the bounded contexts; premature decomposition is worse than late decomposition.

The lecture deliberately rehabilitates the monolith. Do not reflexively recommend microservices just because the deployment target is a cloud.

## Client-Server Architecture

The fundamental two-party model. Software splits into:

- A **Client** that runs on the user's device.
- A **Server** that runs centrally and is invoked by the client.

Three logical layers exist in nearly every Client-Server system:

- **Presentation Layer** — UI / rendering.
- **Business Logic Layer** — domain rules, workflows.
- **Data Access Layer** — talks to persistence.

### Layer-distribution variants

The lecture is explicit about three valid layer distributions. They are not interchangeable; pick by use case.

#### Variant 1 — Presentation on client; Business Logic, Data Access, Storage on server

A "thin client" arrangement. Suits applications where:
- The business logic needs to be enforced server-side for trust reasons.
- The client device may be weak (e.g., music-streaming UI on smart speakers, low-end browsers).
- All clients see the same backend logic and you want a single source of truth.

Example: most web applications. The browser renders; the server holds the rules and the data.

#### Variant 2 — Presentation and Business Logic on client; Data Access and Storage on server

The "fat client" arrangement. Business logic in the client.

Suits:
- Single-page applications (SPA) where most logic runs in the browser, calling a thin REST API.
- Native mobile apps with rich offline / responsive behaviour and a remote data store.
- Desktop applications backed by a remote database.

Risks: any client-side logic that can be bypassed for cheating, fraud, or privilege escalation must be re-validated server-side. Treat client-side business logic as a UX feature, not as a security boundary.

#### Variant 3 — Presentation, Business Logic, and Data Access on client; only Storage on server

The classic "remote storage" arrangement. Suits cases where the central component is essentially a database (or blob store), e.g.:
- Photo-backup apps.
- Cloud-storage clients (Dropbox-style).
- Note-taking apps with local-first semantics.

## Three-Tier Cloud Application (Fehling et al.)

A specialisation of Client-Server where the server side itself is split into three independently scalable tiers — and where each tier sees the workload arriving at it as the trigger for scaling.

> "The presentation, business logic, and data handling are realised as separate tiers to scale stateless presentation and compute-intensive processing independently of the data tier."

**Tier 1 — Presentation Tier**
- A load balancer distributes user requests among application components.
- User interface components are stateless.
- **Scaling trigger:** number of user requests.

**Tier 2 — Business Logic Tier**
- Coupled to the Presentation Tier via **messaging** (decouples them, allows independent scaling, smooths bursts).
- Processing components are stateless.
- **Scaling trigger:** number of enqueued messages.

**Tier 3 — Data Tier**
- Coupled to the Business Logic Tier via messaging.
- Data-access components mediate between messages and storage.
- **Scaling trigger:** number of enqueued messages.

**Caching consideration** — load increases the deeper a request is handled (more components involved). Tiers often **cache** results to avoid hitting deeper layers on every request.

### Two-tier vs. Three-tier

- **Two-tier:** basic separation of data from stateless application functionality. Easy to manage. Use for **simple applications with few components**.
- **Three-tier:** all layers scale individually. Reflects different resource needs. Finer granularity, more complexity. Use for **complex applications with many components having different resource needs**.

## Service-Oriented Architecture (SOA)

The server side is decomposed into multiple services. Each service has a **Service API**; services communicate by invoking each other over the network — typically synchronous **Remote Procedure Call (RPC)** over HTTP, or RMI, sometimes asynchronous messaging.

A **Gateway** sits in front for unified entry, security, routing.

**Benefits over a server-side monolith:**
- Functionalities can be scaled individually.
- Services can be developed and maintained independently.

**Problems SOA exposes:**
- **Reference Dependency** — calling service must know the called service's address.
- **Format Dependency** — caller and callee must use compatible data formats (XML vs. JSON, etc.).
- **Invocation-style mismatch** — synchronous vs. asynchronous, REST vs. SOAP vs. RMI.
- **Time Dependency** — for synchronous RPC, both ends must be online simultaneously.
- **Platform Dependency** — historical issue when services use the same language / framework.

### SOA with Enterprise Service Bus (ESB)

To solve the SOA mediation problems, classical SOA introduces an **Enterprise Service Bus** between services. The ESB knows how to translate formats, route, transform protocols. Services talk to the ESB; the ESB talks to services.

This is sometimes called "smart pipes, dumb endpoints" — the bus carries the integration logic.

**Trade-off:** the ESB becomes a central, complex, potentially performance-bottleneck component. Failures in the ESB cascade everywhere. This is one of the reasons the industry moved on to Microservices.

## Microservice Architecture

A modern evolution of SOA. Pattern catalogue: microservices.io / Chris Richardson.

> **Problem:** What's an enterprise application's deployment architecture if the domain and business functionalities should be reflected in the IT architecture?

**Context (when to consider Microservices):**
- A server-side enterprise application integrating with other software via web services or message broker.
- Logical components correspond to different functional areas.
- You want to clearly separate domains in the IT architecture.
- Many developers / teams working in parallel.
- You want flexibility regarding programming languages, platforms, technologies.

**Solution (Richardson, summarised in the lecture):** Structure the application as a set of loosely-coupled, collaborating services. Services communicate using either synchronous RPC protocols such as HTTP/REST or asynchronous messaging such as AMQP. Each microservice provides a certain business functionality to be used by the others. Often **a microservice has its own database** to be decoupled from other services. Each microservice knows how to communicate with the others — **smart endpoints, dumb pipes** (the inverse of ESB-SOA).

### Microservice vs. SOA, explicitly

| | SOA-with-ESB | Microservices |
|---|---|---|
| Mediation logic | In the ESB | In the services themselves ("smart endpoints") |
| Pipes | Smart | Dumb (just transport) |
| Data store | Often shared across services | Each service typically has its own DB |
| Communication | Often synchronous via ESB | Mix of REST and async messaging |
| Granularity | Coarser | Finer |

A diagram that shows several "microservices" all reading and writing the same shared MySQL is an SOA — possibly a distributed monolith, depending on how coupled they are — not a Microservice Architecture. Be precise.

### REST as the synchronous default

> Microservices with REST: enables long-running tasks; supports handling different data formats.

REST over HTTP is the lecture's default synchronous protocol for microservices. AMQP-based messaging (RabbitMQ, ActiveMQ) is the default asynchronous one.

## Pipes-and-Filters (Hohpe & Woolf)

Treated separately under integration patterns (see `integration-patterns.md`), but is itself a complete structural style: a sequence of independent processing applications ("filters") connected by channels ("pipes"). Use it when the processing decomposes naturally into reusable, reorderable steps.

## Serverless / FaaS-driven Architecture

When the application's compute layer is entirely FaaS, the architecture becomes a graph of functions triggered by events. Each function is by construction a Stateless Component. All state must live in managed stores (DBaaS, Blob aaS, Cache aaS).

**Benefits:**
- No server administration at all — no VMs, no scaling rules to write, no health checks.
- Per-invocation billing — no idle cost.
- Automatic, fine-grained scaling at the level of individual events.

**Drawbacks (the lecture is explicit):**
- Vendor lock-in is severe — every cloud's FaaS API and event model is different.
- Cold-start latency.
- Long-running computations do not fit (Lambda's 15-minute limit, equivalents elsewhere).
- Chained FaaS calls become hard to reason about — distributed-monolith risk.

**Use when:**
- Workload is event-driven and bursty (image uploads triggering thumbnail generation; webhook handlers; scheduled jobs).
- Per-function logic is small and stateless.
- You want to glue managed services together with minimal custom code.

## How to combine the styles — the real architecture

A typical modern cloud-native web application combines:

- **Three-Tier** at the macro level (Presentation / Business Logic / Data).
- **Microservices** within the Business Logic Tier — split by domain.
- **API Gateway** at the front of the microservices, for auth, routing, aggregation.
- **Messaging** between microservices for asynchronous workflows.
- **Pipes-and-Filters** for specific processing chains (order processing, image processing).
- **FaaS** for narrow event-driven pieces (thumbnail generation, scheduled cleanup).
- **DBaaS + Blob aaS + Cache aaS** in the Data Tier.
- Each component is a **Stateless Component**; all state is externalised.

Document each style choice explicitly. Do not hide a microservice decomposition inside a "Three-Tier" label.

## How to write this section of the Architekturdokumentation

For each chosen style:

1. Name it with the canonical name.
2. State the problem the style solves in this application's context.
3. State the alternatives considered (especially: did you consider the monolith and explicitly reject it?).
4. State the consequences — what the style buys you and what it costs.
5. Cite the source (Fehling et al., Richardson / microservices.io, Hohpe & Woolf, Fowler).
