---
name: cloud-architecture-cbwad
description: Use this skill whenever the user is designing, documenting, reviewing, or critiquing the architecture of a cloud-based web application — especially in the context of the HHZ "Cloud-based Web Application Development" module by Prof. Dr. Uwe Breitenbücher. Trigger on any of: "Architekturbeschreibung", "Architekturdiagramm", "Architekturdokumentation", "cloud-native architecture", "Web-Shop architecture", "Microservice vs. Monolith", "3-Tier", "horizontal scaling", "elastic application", "stateless component", "Session State", "CAP", "eventual consistency", "Pipes-and-Filters", "Messaging", "Multi-Tenancy", "API Gateway", "Docker Compose architecture", "IaaS/PaaS/FaaS/SaaS choice", "which cloud service model should I use", or any request to evaluate a cloud-application architecture against established architectural styles, patterns, and principles. Use this skill EVEN if the user only asks for a small piece (e.g., "should this component be stateless?") — the skill encodes the consistent vocabulary and reasoning that the lecture grades against, and ad-hoc answers will diverge from it.
---

# Cloud-Based Web Application Architecture (CBWAD)

This skill encodes the architectural framework taught in the HHZ module "Cloud-based Web Application Development" by Prof. Dr. Uwe Breitenbücher. It is built around four canonical sources that the lecture relies on and that this skill treats as authoritative:

1. **Fehling, Leymann, Retter, Schupeck, Arbitter (2014):** *Cloud Computing Patterns. Fundamentals to Design, Build, and Manage Cloud Applications.* Springer.
2. **Hohpe & Woolf (2003):** *Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions.* Addison-Wesley.
3. **Fowler et al. (2002):** *Patterns of Enterprise Application Architecture.* Addison-Wesley.
4. **Mell & Grance (NIST SP 800-145):** *The NIST Definition of Cloud Computing.*

When you produce an architecture in this skill's vocabulary, use these names exactly. Do not invent synonyms ("microservice", not "service worker"; "Stateless Component", not "stateless service"; "Eventual Consistency", not "loose consistency"). The lecture grades against the canonical names.

## When to use this skill

Trigger on any of these signals:

- User says "Architekturbeschreibung", "Architekturdokumentation", "Architekturmodellierung", "Architekturdiagramm".
- User describes a system and asks how to structure / decompose / split / scale it.
- User is choosing between IaaS, CaaS, PaaS, FaaS, SaaS.
- User mentions a specific named pattern from the four sources above.
- User mentions the HHZ technology stack: HTML/CSS/JS frontend; NodeJS, MySQL, MinIO, Redis, Docker, Docker Compose backend.
- User is reviewing or critiquing a proposed architecture diagram and wants to know what is wrong with it.

Do **not** trigger for pure implementation questions ("how do I write an Express route", "how do I configure a Redis client") — those are coding tasks, not architecture tasks.

## What this skill makes Claude do differently

Without this skill, Claude tends to:

- Mix vocabulary from unrelated sources (AWS Well-Architected, "12-Factor", Kubernetes-isms) and dilute the lecture's framework.
- Recommend a Microservice Architecture by reflex for anything cloud-related, ignoring that Breitenbücher explicitly teaches monoliths as appropriate for many cases.
- Treat "stateless" as a vibe rather than the specific Stateless Component Pattern (Fehling et al.) with its concrete consequence: externalise all state.
- Skip the CAP-Theorem reasoning step and silently assume Strict Consistency.
- Forget that the elasticity engine, load balancer, and external state store are themselves architectural elements that must appear on the diagram.

With this skill, Claude reasons in the order: **workload → state → scaling strategy → architectural style → integration style → data/storage choices → cloud service model → multi-tenancy → cross-environment integration → diagram**, and uses the source-of-truth names throughout.

## Mandatory reasoning order

Whenever you produce or review an architecture, execute these steps explicitly in the response, in this order. Do not skip steps even if they feel obvious — the order is the deliverable.

### Step 1 — Characterise the workload

Ask (or infer from context): is the workload **Static**, **Periodic**, **Once-in-a-Lifetime**, **Continuously Changing**, or **Unpredictable**? (Fehling et al., Workload Patterns.) Only Static needs no elasticity. Anything else benefits from or requires elasticity, and that fact drives every later decision.

Read `references/workload-and-scaling.md` for the five workload types and their elasticity implications.

### Step 2 — Identify state and classify each component

For every prospective component, identify which data it touches and tag it:

- **Application Data** (persistent, final business relevance — orders, products, customers) → **Application State**.
- **Session Data** (transient, no final business relevance — shopping cart, filter config, form draft) → **Session State**.

Then classify the component itself:

- **Stateful Component** — holds Session or Application State *internally* (e.g., shopping cart as a local JS array in the backend). Hard to scale horizontally.
- **Stateless Component** — holds no state internally; reads/writes through an external store. Easy to scale horizontally.

Read `references/state-and-consistency.md` for the precise definitions, the Session State Patterns (Client / Server / Database), and the Stateless Component Pattern.

### Step 3 — Choose the scaling strategy

For each component decide: **Vertical Scaling** (scale up/down — bigger box) or **Horizontal Scaling** (scale out/in — more boxes behind a load balancer). The cloud's main strength is horizontal scaling, but it is only viable if components are stateless (or stateful state has been externalised).

If horizontal scaling is required and you still have a Stateful Component, you have only three honest options:
1. Apply a Session State Pattern (Client / Server / Database Session State, Fowler 2002) to externalise the state.
2. Synchronously replicate — gives Strict Consistency, sacrifices Availability under partition (CAP).
3. Asynchronously replicate — gives Availability under partition, sacrifices Strict Consistency → only Eventual Consistency.

Read `references/state-and-consistency.md` for CAP and the two consistency definitions.

### Step 4 — Pick the architectural style

Choose, justify, and *combine where appropriate* among:

- **Monolithic** — legitimate default for small / single-user / desktop-like applications. Do not dismiss it.
- **Client-Server** — fundamental layering (Presentation, Business Logic, Data Access) with three valid layer distributions.
- **Three-Tier Cloud Application** (Fehling et al.) — Presentation Tier, Business Logic Tier, Data Tier, each scaled independently. Often messaging between tiers.
- **Service-Oriented Architecture (SOA)** — multiple services behind a Gateway, optionally with an Enterprise Service Bus (ESB) for mediation (format, protocol).
- **Microservice Architecture** — fine-grained, independently deployable services, each typically with its own database, communicating via REST or messaging. "Smart endpoints" — no ESB; mediation in the services themselves.
- **Pipes-and-Filters** (Hohpe & Woolf) — sequence of independent filters connected by pipes (queues). Streaming ("water") or messaging ("ice cubes") variant.
- **Serverless / FaaS** — event-driven functions, fully managed scaling and operation.

Read `references/architecture-styles.md`. Modern cloud applications almost always *combine* multiple styles. Make the combination explicit.

### Step 5 — Pick the integration style

For every cross-component interaction, decide: **synchronous RPC** (HTTP/REST, RMI) or **asynchronous Messaging** (queues for Point-to-Point, topics for Publish-Subscribe).

Messaging removes four dependencies that synchronous RPC imposes: **Reference**, **Time**, **Format**, **Platform**. Use it whenever any of these is a problem.

If a sequence of processing steps with composable, reusable, optionally reorderable stages is needed → **Pipes-and-Filters**.

If you have many services and want a single entry point with auth, routing, and aggregation → **API Gateway Pattern**.

Read `references/integration-patterns.md`.

### Step 6 — Pick storage primitives

For each piece of data, choose one of three managed-storage families taught explicitly in the lecture:

- **Database as a Service (DBaaS)** — relational (e.g., MySQL on RDS, Cloud SQL) or NoSQL. Use when you have structured data, complex queries, schema, durability.
- **Blob Storage as a Service** — object storage (S3, MinIO, Azure Blob). Use for unstructured large objects: images, videos, PDFs, ZIPs.
- **Cache as a Service** — Redis, Memcached as managed service. Key-value, in-memory, no durability guaranteed. Use for Session State, hot reads, results of expensive computations.

Read `references/data-storage-patterns.md`.

### Step 7 — Pick the cloud service model

For each component decide where it lives on the NIST stack: **IaaS** (you manage OS up), **CaaS** (you manage container image and up), **PaaS** (you manage the application code and up), **FaaS** (you manage one function and its trigger), **SaaS** (you consume the running service). Higher up the stack means less control, less effort, more vendor lock-in, more fine-grained billing.

Read `references/nist-cloud-models.md`.

### Step 8 — Pick the deployment model

**Public**, **Private**, **Hybrid**, **Community**, or **Multi-Cloud**. Whenever the choice is Hybrid or Multi-Cloud, you have a trust-boundary problem — go to Step 10.

### Step 9 — Decide tenancy

If multiple customers will use the system, classify each stateful component as **Shared** (stateless, same content for everyone), **Tenant-Isolated** (multi-tenant aware — tenant id in DB), or **Dedicated** (one instance per tenant — expensive but maximally isolated).

Read `references/multi-tenancy.md`.

### Step 10 — Handle the trust boundary

If the architecture spans untrusted ↔ trusted environments (Hybrid Cloud, Multi-Cloud, on-prem ↔ public), apply the **Application Component Proxy Pattern** (Fehling et al.): the secure side initiates the connection outward, the insecure side never gets to initiate a connection inward. Synchronous (long-open channel) or asynchronous (polling a queue) variants.

Read `references/integration-patterns.md` for the proxy pattern.

### Step 11 — Produce the diagram

The diagram must show:

- Each component as its own box, with its containing tier (Presentation / Business Logic / Data) labelled.
- Every load balancer explicitly.
- Every external state store (DB, blob store, cache, message broker) explicitly as a separate box.
- Direction and protocol of every connection (HTTP, AMQP, S3 API, SQL API, Redis API).
- Tier boundaries as background bands or grouping rectangles.
- For multi-cloud / hybrid: trust-environment boundaries as labelled regions.

Do not draw an arrow into a "cloud" cloud-shape. Draw arrows into concrete components.

### Step 12 — Write the decisions

The Architekturdokumentation has to record, for every non-trivial decision: the alternatives considered, the chosen option, and the justification grounded in the workload / state / scaling chain. Bullet points are fine; what matters is that the chain Step 1 → 2 → 3 → ... is reconstructible.

## Anti-patterns to flag on review

When reviewing an architecture handed to Claude, flag any of these on sight:

- A backend with internal `var cart = []` style state that is then said to be "horizontally scaled" — that is broken under CAP.
- A diagram that names a "Microservice Architecture" but shows a single shared database across all services — that is SOA-with-ESB-removed, not Microservices.
- Round-robin load balancing into a Stateful Component without sticky sessions or externalised state — broken Session State.
- A claim of "infinitely scalable" with Vertical Scaling only — there are always hardware ceilings.
- A FaaS function that maintains in-memory state between invocations.
- A multi-tenant application with no tenant id in any storage schema.
- An "API Gateway" that is actually just a reverse proxy without auth / routing / aggregation.
- A messaging-based design with both producer and consumer assuming Strict Consistency.
- Hybrid-cloud designs where the insecure side initiates inbound connections to the secure side.

See `references/decision-checklist.md` for the full reviewer checklist.

## Reference index

Load these files when the corresponding decision is on the table; do not preload them all.

| File | Load when |
|------|-----------|
| `references/nist-cloud-models.md` | Choosing IaaS/CaaS/PaaS/FaaS/SaaS, deployment models, responsibility split. |
| `references/workload-and-scaling.md` | Characterising workload, choosing Vertical vs. Horizontal scaling, designing the Elasticity Engine. |
| `references/state-and-consistency.md` | Anything involving Session/Application State, Stateless Component, CAP, Strict vs. Eventual Consistency, Session State Patterns. |
| `references/architecture-styles.md` | Picking among Monolith, Client-Server, Three-Tier, SOA, Microservices, Pipes-and-Filters, Serverless. |
| `references/integration-patterns.md` | Synchronous vs. async, queues vs. topics, ESB, API Gateway, Pipes-and-Filters, Application Component Proxy. |
| `references/data-storage-patterns.md` | DBaaS vs. Blob aaS vs. Cache aaS; how to externalise state; storage scaling. |
| `references/multi-tenancy.md` | Anything involving multiple customers / companies / user groups. |
| `references/container-platform.md` | Docker, Docker Compose, the PaaS effect, the HHZ technology stack. |
| `references/decision-checklist.md` | Reviewing an existing architecture description / diagram. |

## Output conventions

- Write in the language the user wrote in. The lecture is bilingual (DE/EN); follow the user.
- When producing an Architekturdokumentation, structure each decision as: **Problem → Context → Considered Options → Decision → Consequences (Benefits & Drawbacks)**. This mirrors the Fehling et al. and Hohpe & Woolf pattern format and is what the lecture rewards.
- Cite the source for each pattern you invoke (Fehling et al., Hohpe & Woolf, Fowler, NIST). The lecture treats unsourced pattern usage as weaker.
- Never invent a pattern name. If you need a structure that has no canonical name in the four sources, describe it descriptively and say so.
