# Data Storage Patterns

Source: lecture's coverage of Chapter 11 (SaaS), specifically the three storage "as a service" categories that the lecture treats as the canonical data-tier toolkit for cloud-native web applications. Also Fehling et al.'s data-store framing.

## The three managed-storage families

Cloud-native applications use, almost always in combination:

1. **Database as a Service (DBaaS)** — structured data with schema, queries, transactions.
2. **Blob Storage as a Service** — unstructured large objects.
3. **Cache as a Service** — fast, in-memory, key-value, no durability guarantee.

Each maps to a different data shape. Choosing the wrong one is one of the most common architectural mistakes. The shape, not the technology brand, drives the choice.

## Database as a Service (DBaaS)

The cloud provider operates a Database Management System; you create databases inside it and consume them via the standard wire protocol of that DBMS.

### Subtypes

- **Relational DBaaS (SQL)** — MySQL, PostgreSQL, MariaDB on managed services like AWS RDS, Google Cloud SQL, Azure Database for MySQL.
- **NoSQL DBaaS — Document** — MongoDB Atlas, AWS DocumentDB.
- **NoSQL DBaaS — Key-Value** — DynamoDB, Cosmos DB (key-value mode).
- **NoSQL DBaaS — Column-family** — Cassandra-as-a-service, BigTable.
- **NoSQL DBaaS — Graph** — Neptune, Cosmos DB (Gremlin).

The HHZ technology stack uses **MySQL** as the canonical relational DBaaS / DB layer.

### When to use DBaaS

- Data is structured.
- You need a schema (typed columns, constraints, foreign keys).
- You need complex queries: joins, aggregations, multi-row transactions.
- You need durability — the data must survive crashes, restarts, region outages.
- You need ACID transactions for any non-trivial workflow (orders, payments, inventory).

### Suitability checklist (lecture style)

Use DBaaS if you need to store text-/number-based data items; have many similar items that share a schema; need complex queries; need relations between items; need high data durability.

### Architectural consequences

- Place a DBaaS in the **Data Tier**.
- Treat the DBaaS instance as a separate component on the diagram with its own connection drawn explicitly.
- The DB is itself stateful — scaling it is harder than scaling the stateless components in front of it. Managed services handle replication, read replicas, and failover for you; **document which** (read-replica fan-out for read-heavy workloads, multi-AZ failover for HA, sharding for write-heavy workloads).
- The DB is usually the bottleneck of the architecture. Cache aggressively in front of it (Cache aaS).

## Blob Storage as a Service

The cloud provider exposes object storage — unstructured byte blobs identified by keys, accessed via an HTTP API (typically S3-compatible).

Examples: AWS S3, Azure Blob Storage, Google Cloud Storage. The HHZ stack uses **MinIO** — an S3-compatible object store, self-hostable, which makes it a good "MinIO in dev, S3 in prod" pairing.

### Data model

- **Bucket** — a top-level namespace.
- **Object** — a blob inside a bucket, identified by a key.
- **Metadata** — small key/value attributes attached to the object.

There is no schema. There is no query language. You PUT objects, GET objects, DELETE objects, LIST keys.

### When to use Blob aaS

- The data items are unstructured: images, video, audio, PDF, ZIP, backups, build artefacts.
- Items are large (megabytes to gigabytes).
- Access patterns are key-based, not query-based.
- You need very high durability (S3 advertises 11 nines) at low cost.
- You want CDN-style delivery (objects served as static assets behind a CDN).

### Suitability checklist

Use Blob aaS if you need to store large unstructured items; you access by key only; you do not need complex queries; you need extreme durability.

### Architectural consequences

- Place Blob aaS in the **Data Tier** alongside DBaaS.
- Typical pattern: the DB holds the *metadata* (product id, image filename) and a reference to the blob; the blob store holds the *binary*. Never store binaries as BLOBs in a relational database — it kills the database.
- The blob store often serves clients **directly** (signed URLs), bypassing the application tier — draw that connection on the diagram. The Business Logic Tier hands out URLs; the client GETs from the blob store.
- FaaS pairs naturally with Blob aaS: an upload triggers a function that processes the object (thumbnail generation is the canonical example).

## Cache as a Service

The cloud provider operates a **Cache Management System**; you store data in caches that live in memory.

Examples: AWS ElastiCache (Redis, Memcached), Azure Cache for Redis, Google Memorystore. The HHZ stack uses **Redis**.

### Data model

Key-value:

| Key | Value |
|---|---|
| `cart1412` | `{ products: ["p1"] }` |
| `cart1113` | `{ products: ["p4", "p2", ...] }` |
| `cart2151` | `{ products: ["p1", "p2"] }` |

Operations: `get(key)`, `set(key, value)`, `delete(key)`, `update(value of key)`.

No schema across items, no complex queries, no joins. Sometimes a small set of richer data structures (Redis offers lists, sets, sorted sets, hashes) but these are still per-key.

### Characteristics

- **In-memory** — orders of magnitude faster than disk-backed DBs.
- **Not durable** — data can be lost on restart (Redis persistence is optional and partial).
- **Horizontally scalable** — the simple data model makes sharding straightforward; throughput scales close to linearly with nodes.
- **Elastic** — managed offerings auto-scale.

### When to use Cache aaS

- Storing **Session State** — exactly the canonical use case. Session data is loaded on every request (e.g., shopping cart on every page view), is small, is not business-critical to durably persist beyond the session, and benefits massively from in-memory access.
- Caching expensive results: DB query results, computed aggregations, rendered fragments.
- Storing transient state for FaaS or stateless components that must coordinate.

### Suitability checklist

Use Cache aaS if you need small items; very fast access (memory-resident); text- or number-based data; many similar items; simple key-based queries only; **no need for high durability**; no need for complex multi-item queries; no need for relations; no schema needed.

### Architectural consequences

- Place Cache aaS in the **Data Tier**.
- It is the standard backing store for the **Database Session State Pattern** when implemented at horizontal scale.
- Cache invalidation is the hard problem. Document the strategy explicitly: TTL-only, write-through, write-behind, cache-aside (read-through). Cache-aside (read-through) is the safe default for cloud-native web apps: read from cache, miss → read from DB, populate cache; write goes to DB and invalidates the cache entry.
- Caches that are not strongly consistent with the underlying DB are themselves a source of **Eventual Consistency** — call it out.

## Side-by-side comparison

| | DBaaS (relational) | Blob aaS | Cache aaS |
|---|---|---|---|
| Data shape | Tables, schemas, relations | Unstructured byte blobs | Key-value |
| Item size | Small to medium (rows) | Large (KB to GB) | Small (bytes to MB) |
| Storage medium | Disk | Disk (often cold-tier capable) | Memory |
| Query | SQL, complex | GET by key, LIST by prefix | GET by key |
| Schema | Yes | No | No |
| Durability | High (transactional) | Very high | Low (in-memory, optional persistence) |
| Horizontal scale | Hard (replication, sharding) | Easy (provider handles) | Easy |
| Cost per byte | Higher | Low | Highest |
| Latency | ms | tens of ms | sub-ms |
| Typical role | Application State | Application State (binaries) | Session State, cache |

## How to externalise state — concrete mappings

Given the Stateless Component Pattern's mandate to externalise state, the standard mapping is:

| State category | Store |
|---|---|
| Shopping cart contents (Session State, small, hot) | **Cache aaS (Redis)** |
| User authentication session ID → user info | **Cache aaS** |
| Product catalogue (Application State, structured, queried) | **Relational DBaaS (MySQL)** |
| Product images (Application State, binary, large) | **Blob aaS (MinIO / S3)** |
| Order records (Application State, structured, transactional) | **Relational DBaaS (MySQL)** |
| Order receipt PDFs | **Blob aaS** |
| Search index (Application State, queried but not transactional) | NoSQL DBaaS or dedicated search service (Elasticsearch / OpenSearch) |

This is the HHZ Web Shop canonical decomposition (MySQL + MinIO + Redis) and the pattern the lecture grades against.

## How to write this section of the Architekturdokumentation

For each store on the diagram:

1. Name the family (DBaaS / Blob aaS / Cache aaS).
2. Name the concrete technology (MySQL, MinIO, Redis) and the cloud service form (e.g., RDS for MySQL, ElastiCache for Redis).
3. State what data lives there.
4. State the durability requirement and confirm the store meets it.
5. State the access pattern (read-heavy / write-heavy / read-modify-write).
6. State the consistency model (Strict on a single-region relational DB; Eventual through caches and cross-region replication).
7. For caches: state the invalidation strategy explicitly.
