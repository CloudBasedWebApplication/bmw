# State, Consistency, and the Session-State Patterns

Sources: Fehling et al. (Stateless Component Pattern, Strict vs. Eventual Consistency); Fowler 2002 (*Patterns of Enterprise Application Architecture* — the three Session State Patterns); Brewer 2000 (CAP Theorem).

This is the most important reference file in the skill. Most architecture mistakes in cloud-based web applications stem from confused thinking about state.

## Data vs. State — the lecture's distinction

Two orthogonal data categories first:

- **Application Data** — information that results from a *completed* business transaction. Persistent, has final business relevance. Examples: order and invoice records in an online shop; customer records in an insurance system; a published post on a social-media platform.
- **Session Data** — temporary information about an active interaction between a user and a system. Transient, no final business relevance. Examples: contents of a shopping cart before checkout; product-filter configuration; text in a form field before submit.

Then state is "a summary of":

- **Application State** — a summary of a certain kind of Application Data (e.g., "all currently available products" or "all orders by customer X").
- **Session State** — a summary of one user's Session Data (e.g., shopping cart contents, current filter config).

Both transition through business interactions: a completed order moves Application State forward; adding a product to the cart moves Session State forward.

## The Stateful / Stateless Component dichotomy

> **Stateful Component** — holds Session or Application State *internally*. Example: a Web Shop backend that stores shopping carts in a local JavaScript array. **Hard to scale horizontally.**

> **Stateless Component** — holds no Session or Application State internally. Example: an image-filter web service that receives an image, applies a filter, and returns it without storing anything beyond the single invocation. **Easy to scale horizontally.**

The Stateless Component Pattern (Fehling et al.) is therefore the single most important pattern for cloud-native web applications. Its consequence is blunt: **externalise every piece of state** — Application State to a Database / Object Store, Session State to a Cache (or Database, or the Client). Then any instance can serve any request.

## Why a Stateful Component breaks under horizontal scaling

Imagine N backend instances behind a round-robin load balancer, each with their own internal shopping-cart array. User adds a product → request goes to instance A → cart is now in A's memory. User loads the cart page → request goes to instance B → instance B has no cart. The user sees an empty cart and rage-quits.

Three classical "fixes" exist; each has a price:

1. **Sticky sessions** — the load balancer routes the same user to the same instance. Works until that instance dies, then the user loses their cart. Also defeats load-aware balancing.
2. **Synchronous data replication** between instances — every instance has every user's cart. Strict Consistency at the cost of write performance, network chatter, and CAP-availability problems.
3. **Asynchronous data replication** — instances eventually agree. Available even under partition; reads can be stale → only Eventual Consistency.

None of these is as clean as just making the component stateless and putting the cart in a Cache (Redis). Whenever you reach for sticky sessions or replication, ask first whether you should be externalising state instead.

## The CAP Theorem (Brewer 2000)

For a distributed stateful system, of the three properties

- **C — Consistency**: every read from any node at a given time returns the most recently written data (or an error if consistency cannot be guaranteed). All clients see the same data.
- **A — Availability**: every request to any non-failing node is served with a valid response and no exception, even if other nodes are unreachable. Every non-failing node offers all regular functionalities, though returned data may be stale.
- **P — Partition Tolerance**: the system continues to operate despite arbitrary network message loss or delay between nodes. Even if a network partition isolates some nodes, the overall system continues working.

…**only two can be guaranteed simultaneously.**

In any non-trivial distributed system, network partitions *will* happen. P is therefore not optional. That leaves a binary choice **when a partition is in progress**:

- **CP** — demand Consistency, relax Availability. During a partition, write requests are rejected (or block) so all clients still see the same data. The system says "please try again later" rather than diverge. Result: **Strict Consistency**.
- **AP** — demand Availability, relax Consistency. During a partition, accept writes everywhere; reconcile later. Result: the system is always available, but reads can return stale data until replication catches up. Result: **Eventual Consistency**.

The two formal definitions used in the lecture:

> **Strict Consistency** — if all clients that read a certain data item from a system at a certain point in time receive identical data, the system fulfils Strict Consistency.

> **Eventual Consistency** — if some clients reading a recently-updated data item receive an older version, and some time later receive the new version (or an even newer one), the system fulfils only Eventual Consistency. "Eventual" here means "final".

When the network is healthy, of course both Consistency and Availability are achievable. The CAP choice is about the *partition mode*.

### How to document the CAP decision

For every distributed stateful component, the Architekturdokumentation must record explicitly:

- Whether the component is partition-tolerant (almost always yes — distributed = yes).
- Whether the design biases toward Strict Consistency or Eventual Consistency during partitions.
- Why that bias matches the business semantics. (Shopping cart? Eventual is fine. Bank balance? Strict.)

Skipping this step is the single most common cause of "we deployed and everything works, until it doesn't".

## The three Session State Patterns (Fowler 2002)

Fowler's *Patterns of Enterprise Application Architecture* offers three canonical ways to externalise Session State, all of which the lecture teaches. Pick the one that fits the data shape and trust assumptions.

### Client Session State Pattern

**Problem and context** — the server should be stateless but the session is multi-step and needs to remember something between requests.

**Solution** — store the session data **on the client** and have the client send it back with every request.

**Realisations:**
- **Hidden form fields** — small amounts of data piggybacked on form submissions.
- **URL parameters** — same idea, but visible in the browser bar.
- **Cookies** — the cleanest realisation for small (≤ ~4 KB) data. The browser sends the cookie with every request automatically. This is the default for the smallest cases.
- **HTML5 `localStorage` / `sessionStorage` + explicit AJAX** — modern variant, larger capacity, but the client must send the data manually.
- **JWT (JSON Web Token)** — a signed/encrypted token carrying claims; structurally Client Session State Pattern with cryptographic integrity.

**Benefits:**
- Server holds nothing → trivially stateless → trivially horizontally scalable.
- No server-side storage cost.

**Restrictions:**
- Limited size (cookies ~4 KB; URL parameters shorter; even localStorage has practical limits).
- The data travels on every request → bandwidth cost.
- The client can tamper with it → must be signed or encrypted if it carries any trust-bearing claim.
- Privacy: data sits on the user's machine.

### Server Session State Pattern

**Problem and context** — session data is too large or too sensitive for the client; you want the server to remember it across requests.

**Solution** — store the session data **on the server**, identified by a session ID. The session ID is the only thing sent to the client (and back, typically as a cookie — note this is itself an application of Client Session State for the ID alone).

**Realisations:**
- In-memory map on the server (e.g., Tomcat's default — but then the server is stateful → see the warning below).
- Serialised to disk on the server.

**Critical warning** — if "the server" means one specific instance, you have just re-introduced a Stateful Component. To make this pattern work at horizontal scale, the server-side storage must itself be either:
- Replicated across all instances (expensive, CAP-bound), or
- Externalised — which is exactly the Database Session State Pattern.

So in practice, the pure "Server Session State on one server" form is only safe for vertically-scaled or non-elastic deployments.

**Benefits:**
- Larger session data possible.
- Server controls the data — client cannot tamper.

**Restrictions:**
- The session-holding server is now stateful → load balancing must be sticky, or session data lost on failover.
- Otherwise → go to Database Session State.

### Database Session State Pattern

**Problem and context** — you need server-side session state *and* horizontal scaling.

**Solution** — store the session data in an external store (database or, in practice, in-memory cache like Redis). All backend instances are then identical stateless components reading and writing the shared store via a session ID.

**Realisations:**
- A `sessions` table in the relational DB. Simple but slow — every request hits the DB.
- A **Cache as a Service** (Redis, Memcached). This is what the HHZ Web Shop reference architecture does and what production systems use. Fast, in-memory, key-value access pattern matches sessions exactly. Note that the lecture deliberately says "in-memory cache systems such as Redis to implement this pattern".

**Note on the SessionID** — the SessionID itself must be transferred between client and server somehow. That transfer is always an instance of the Client Session State Pattern (typically a cookie). So Database Session State Pattern is **always combined with Client Session State Pattern for the ID**.

**Benefits:**
- All instances are stateless → horizontal scaling works cleanly.
- Cache durability characteristics match the data: session data is transient anyway, so the lack of strong persistence in caches is fine.

**Restrictions:**
- An extra network hop on every request that needs session data. Mitigated by Redis being in-memory and same-region.
- The cache is itself a component to operate; in cloud-native designs, use it as Cache aaS rather than self-hosted.
- For high availability, the cache itself must be clustered, which re-introduces CAP at a smaller scale.

## How to pick among the three

| Need | Pattern |
|---|---|
| Tiny session data, no privacy concern | Client Session State (cookie) |
| Tiny session data, must be tamper-proof | Client Session State (signed cookie / JWT) |
| Medium-large session data, vertical scale only | Server Session State (in-memory) |
| Medium-large session data, horizontal scale | Database Session State (Redis / Memcached) |
| Long-lived session data, durability required | Database Session State (relational DB) |

## How to externalise Application State

Application State follows the same logic as Session State but lives in:

- **Relational DBaaS** for structured data with complex queries, schemas, transactions (orders, customers).
- **NoSQL DBaaS** for high-volume, simple-schema data (logs, telemetry, certain catalogues).
- **Blob Storage aaS** for unstructured large objects (product images, PDFs).
- **Cache aaS** for hot reads that should not hit the DB on every request.

See `data-storage-patterns.md`.

## What to write in the Architekturdokumentation

For every component:

1. State its tag: Stateful or Stateless.
2. If Stateful, justify why — and prove it does not need to scale horizontally, or explain how state is replicated and which CAP corner you accept.
3. If Stateless, identify what state was externalised and to which store, and which Session State Pattern (if any) is in play.
4. For every distributed store, name the consistency model (Strict / Eventual) and justify it against the business semantics.
