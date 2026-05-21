# Multi-Tenancy

Source: Fehling et al. *Cloud Computing Patterns*, Multi-Tenancy patterns. The lecture's framing uses the three component types: Shared, Tenant-Isolated, Dedicated.

## Why multi-tenancy is its own design decision

A SaaS-style application is consumed by multiple customers — companies, organisations, individuals. The architecture must keep them from seeing each other's data, while still benefiting from shared infrastructure economically. The decision is per-component, not global: a single application can have Shared, Tenant-Isolated, and Dedicated components simultaneously.

## Definitions

> **Tenant** — a group of users, for example, a company. Different tenants often need to be isolated from each other. Depending on the use case, a tenant can be a single user, too.

> Tenancy is concurrent: a single deployment of the application serves many tenants at the same time. The architectural question is how to keep them apart.

## The three Multi-Tenancy options (Fehling et al.)

### Option 1 — Shared Component

The component holds **no tenant-specific state at all**. Everyone using it sees the same content / functionality. There is nothing to isolate.

**When this applies:**
- The component is a static asset (corporate website, marketing page).
- The component is a fully stateless processor (image filter, format converter) that does not retain anything between invocations.

**Implication:** trivially scalable, trivially safe — there is no tenant data to leak. This is the cheapest option when applicable.

### Option 2 — Tenant-Isolated Component

The component **is multi-tenant aware**. It manages multiple tenants inside its own logic and stores tenant information so that each request is associated with a tenant and each tenant's data is segregated.

**Realisations:**
- **Single shared database with a `tenant_id` column on every row.** All queries filter by the current tenant's id. The id is set from the authenticated request context and never trusted from the client. The simplest and most common realisation.
- **Schema-per-tenant** in one shared database instance. Tenants share the DBMS but have separate schemas. Coarser isolation than a column; finer than a database.
- **Database-per-tenant** inside a shared DBaaS instance. Stronger isolation; higher per-tenant cost.

**When this applies:**
- The application has state (cart, profile, settings, content).
- The number of tenants is moderate to high — too many to operate one instance per tenant.

**Implication:** the **application** is responsible for never leaking across tenants. Authentication produces a tenant id; every data path uses it. A missing `WHERE tenant_id = ?` is a security incident — privacy and compliance failure. Treat this as a top-priority invariant in code reviews.

### Option 3 — Dedicated Component

Each tenant gets **its own instance** of the component. Different tenants share absolutely nothing.

**Realisations:**
- One VM (or container, or PaaS app) per tenant.
- One database per tenant on a dedicated DBaaS instance.
- Per-tenant subdomain routing to the right instance.

**When this applies:**
- Regulatory requirement of strict isolation (e.g., separate compute, separate storage).
- The application is *not* multi-tenant aware in its code, and cannot be made so cheaply, so isolation is enforced at the infrastructure level.
- Each tenant is large enough to justify its own instance economically.

**Implication:** expensive at scale; you need a routing layer that maps the inbound request to the correct tenant instance ("redirect each user to his instance, think about scaling, availability, etc." — lecture's phrasing). Each instance is itself a system that needs scaling, monitoring, deployment, patching. This option scales by *replicating the operations burden*, which is fine for tens of tenants and impossible for thousands.

## Picking the option per component

A typical SaaS application combines all three:

| Component | Tenancy choice | Why |
|---|---|---|
| Marketing site / public docs | **Shared** | No tenant data |
| Image-processing function | **Shared** | Stateless processor |
| Web Shop Backend (multi-tenant SaaS shop platform) | **Tenant-Isolated** | Each merchant is a tenant; data segregated by `tenant_id` |
| Authentication service | **Tenant-Isolated** | Users belong to tenants |
| Big enterprise customer with regulatory demands | **Dedicated** | Strict isolation required |

The decision is per-component. Do not declare one tenancy choice for the whole architecture.

## Where the tenant id lives

For a Tenant-Isolated design, the tenant id must travel with every request, end-to-end. Typical realisation:

1. User authenticates → session / JWT identifies the user.
2. From the user record (in the DB), look up the tenant id.
3. Place the tenant id in the request context (a request-scoped variable, a JWT claim, a header).
4. Every data-access call uses the tenant id.

Doing this once at the gateway and enforcing it in middleware is far safer than relying on every developer to remember it in every query.

## Tenancy interactions with other patterns

- **With Session State:** session data is per-user, and the user belongs to a tenant. Session State Patterns work as before; the tenant id is just another piece of the session.
- **With Cache aaS:** keys must include the tenant id to prevent cross-tenant cache poisoning. `cart:<userId>` is a bug if user ids are not globally unique across tenants; `cart:<tenantId>:<userId>` is correct.
- **With Blob aaS:** bucket-per-tenant or path-prefix-per-tenant (`s3://app-data/<tenantId>/...`). Signed-URL generation must verify the user's tenant.
- **With FaaS:** every function invocation must establish tenant context from the trigger event before doing anything.

## Anti-patterns to flag

- **No tenant id anywhere.** The application is "multi-user" but the architecture treats all users as if they belonged to one global tenant. Eventually one customer will see another's data. Eventually it will be a data-breach notification.
- **Tenant id supplied by the client.** The client says "I am tenant 42" in a header, and the backend trusts it. Trivially exploitable.
- **Dedicated for everyone "for safety".** Operationally unsustainable past a small number of tenants. Use Tenant-Isolated with strong invariants instead, and reserve Dedicated for cases that genuinely demand it.
- **Tenant id stored only on the user, never propagated.** Queries against shared tables without `tenant_id` predicates. Same eventual outcome as no tenant id at all.

## How to write this section of the Architekturdokumentation

For each component on the architecture diagram, state explicitly:

1. **Tenancy classification** — Shared / Tenant-Isolated / Dedicated.
2. **How the tenant id is established** — at the gateway, from the JWT, etc.
3. **How the tenant id is enforced** — middleware, repository layer, schema-level row security, separate database, etc.
4. **What happens if the id is missing** — fail closed (reject the request); never default to "no tenant" or "tenant 0".
