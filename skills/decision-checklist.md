# Architecture Reviewer Checklist

When the skill is invoked to review an existing architecture (diagram + decisions document), walk this list explicitly. Each row is one check; mark it pass / fail / unclear with a one-line justification. Do not skip a row even if it seems trivially satisfied — making the check explicit is what catches errors.

## Workload and scaling

- [ ] **Workload classified.** One of: Static / Periodic / Once-in-a-Lifetime / Continuously Changing / Unpredictable (Fehling et al.). If unstated → fail.
- [ ] **Scaling axis chosen per component.** Vertical / Horizontal / both, with justification.
- [ ] **Elasticity engine identified.** Platform-provided is the default; any other choice is justified.
- [ ] **Elasticity rules sketched.** Metrics, thresholds, actions, step size.

## State

- [ ] **Every component tagged.** Stateless Component or Stateful Component.
- [ ] **Stateful components are explicitly *not* horizontally scaled** — or, if they are, the replication / consistency strategy is documented.
- [ ] **Session State Pattern named** (Client / Server / Database) wherever sessions exist. If "the backend keeps sessions in memory" appears anywhere → fail.
- [ ] **CAP corner stated** for each distributed stateful store. C+P (Strict Consistency, reduced availability under partition) or A+P (available, only Eventual Consistency).
- [ ] **Eventual Consistency tolerated by business semantics** where chosen — e.g., shopping cart yes, bank balance no.

## Architectural style

- [ ] **Style explicitly named** with canonical name from `architecture-styles.md`.
- [ ] **Monolith considered and explicitly accepted or rejected.** Going to Microservices without justifying *why not a monolith* is grounds for failure of the design rationale, even if the architecture itself happens to be fine.
- [ ] **Where Three-Tier is used, the three tiers appear on the diagram as grouping bands.** Tier scaling triggers documented.
- [ ] **Where Microservices is used:**
  - Each service has its own database (or the deviation is justified).
  - Services communicate via REST or async messaging (no ESB).
  - Service boundaries follow domain boundaries, not technical layers.
- [ ] **No claim of "Microservices" while showing a single shared database for all services** — that is SOA or a distributed monolith, not Microservices.

## Integration

- [ ] **Every connection on the diagram has a labelled protocol.** HTTP / REST / AMQP / SQL / S3 / Redis / etc.
- [ ] **Synchronous vs. asynchronous choice justified.** Asynchronous chosen for at least the integration points that need to decouple time, reference, format, or platform.
- [ ] **Queues vs. topics correctly named** wherever messaging is used. Queue = P2P, Topic = Pub/Sub.
- [ ] **Pipes-and-Filters chains named at filter granularity.** Translator / Enricher / Router / etc., from Hohpe & Woolf.
- [ ] **API Gateway is a real API Gateway.** Does it do auth, routing, aggregation? If only "reverse proxy", do not call it an API Gateway.
- [ ] **Cross-environment integration uses Application Component Proxy Pattern.** Untrusted side never initiates inbound to trusted side.

## Data tier

- [ ] **Each data store sits in the right family.** DBaaS for structured, Blob aaS for unstructured large objects, Cache aaS for hot small key-value.
- [ ] **Binaries are in blob storage, not in the relational DB.**
- [ ] **Cache invalidation strategy documented.** TTL / write-through / cache-aside / write-behind. Unspecified → fail.
- [ ] **Blob-store access pattern correct.** If clients fetch blobs directly via signed URLs, the diagram shows that connection — it does not all funnel through the backend.
- [ ] **The Data Tier is recognised as the typical bottleneck.** Read replicas / sharding / caching strategy stated.

## Cloud service model and deployment

- [ ] **Service model chosen per component.** IaaS / CaaS / PaaS / FaaS / SaaS. Mixed is fine; uniform is suspicious.
- [ ] **Deployment model stated.** Public / Private / Hybrid / Community / Multi-Cloud.
- [ ] **Vendor lock-in acknowledged** where it exists. Especially FaaS-heavy architectures.
- [ ] **Hybrid / Multi-Cloud designs include the Application Component Proxy Pattern.**

## Multi-tenancy

- [ ] **If multi-tenant: tenancy choice per component.** Shared / Tenant-Isolated / Dedicated.
- [ ] **Tenant id is server-side, never client-supplied.**
- [ ] **Tenant id is part of every cache key, every blob path, every DB query predicate.**

## Diagram quality

- [ ] **Load balancers appear as explicit components.** Drawing an arrow into a "service" without a load balancer in front of horizontally-scaled instances is wrong.
- [ ] **Every external store (DB, blob, cache, broker) is its own box.** No "data" labels on connection lines.
- [ ] **Tier boundaries are visible** as background bands or labelled regions.
- [ ] **Trust boundaries are visible** for Hybrid / Multi-Cloud.
- [ ] **Protocols labelled on every arrow.**
- [ ] **No generic "cloud" cloud-shape as an architectural element.** Cloud is a deployment substrate, not a component.

## Documentation quality

- [ ] **Decisions are documented in the Fehling-style or ADR-style "Problem / Context / Considered Options / Decision / Consequences"** format.
- [ ] **Sources cited.** Fehling et al., Hohpe & Woolf, Fowler, NIST. Unsourced pattern usage weakens the work.
- [ ] **No invented pattern names.** If something is not named by a canonical source, it is described descriptively and that is acknowledged.
- [ ] **Each decision traceable from the workload classification onward.** A reader can reconstruct Step 1 → Step 12 from the document.

## Common anti-patterns — flag if seen

These are the recurring failure modes the lecture warns about; flag each one explicitly if found.

1. **Internal Session State in a horizontally-scaled backend.** "`var carts = {}` in the backend, scaled to N instances." Broken.
2. **Sticky sessions presented as a real solution rather than a stopgap.**
3. **Microservices with shared DB.** Distributed monolith.
4. **"Infinitely scalable" with vertical scaling only.** Physical limits exist.
5. **FaaS function holding in-memory state across invocations.** Cold start kills it.
6. **No tenant id in any storage primitive of a multi-tenant app.**
7. **API Gateway that is only a reverse proxy.**
8. **Strict-consistency assumed silently in a messaging design.**
9. **Insecure cloud opening connections inward to the secure cloud.**
10. **Cloud-shape clouds in the diagram instead of concrete components.**
11. **Recommendation of Microservices without justifying why-not-a-monolith.**
12. **Compose treated as a production deployment platform.**

## How to deliver the review

Produce the output in two parts:

1. **The checklist itself**, with pass / fail / unclear and a one-line note for each item.
2. **A prioritised remediation list** — the three most important problems, each with a concrete fix grounded in the canonical patterns. Avoid listing twenty equally-weighted items; force the prioritisation.

If the architecture passes everything: say so, plainly, and resist the urge to invent problems.
