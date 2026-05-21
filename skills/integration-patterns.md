# Integration Patterns

Sources: Hohpe & Woolf, *Enterprise Integration Patterns* (Addison-Wesley 2003) — the canonical reference for everything in this file except the API Gateway Pattern (microservices.io) and the Application Component Proxy Pattern (Fehling et al. 2014).

## Why integration is its own concern

Once an application is decomposed (SOA, Microservices, Three-Tier), the design of how the parts talk becomes as important as the design of the parts themselves. Synchronous RPC is the obvious default and the one most developers reach for; it has four dependencies that the lecture names explicitly:

- **Reference Dependency** — the caller must know the callee's address.
- **Time Dependency** — both ends must be online simultaneously.
- **Format Dependency** — caller and callee must use compatible data formats.
- **Platform Dependency** — historically caller and callee often had to share language / framework.

Any cross-cutting integration concern that touches even one of these dependencies pushes the design toward **asynchronous messaging** instead.

## The Messaging Pattern (Hohpe & Woolf)

> **Problem:** How can multiple individual software components be integrated so that they work together and can exchange information even if they are heterogeneous?

**Solution:** Clients implemented in arbitrary programming languages connect to a **messaging middleware** to transfer **messages** via **message channels** — frequently, immediately, reliably, asynchronously, using customisable message formats.

```
Component 1  →  [ Channel ]  →  Component 2
              Messaging Middleware
```

- **Message** — a data packet (e.g., a product order) with a **Header** (target channel, metadata, security, schema info) and a **Body** (the data payload, arbitrary format).
- **Message Channel** — a logical location managed by the messaging middleware to which messages are sent and from which they are retrieved.
- **Messaging Middleware** — message broker (RabbitMQ, ActiveMQ, AWS SQS / SNS, Azure Service Bus, Kafka).

### The two channel types

**Queues — Point-to-Point communication**
- A message sent to a queue is received by **exactly one or no receiver** component.
- If multiple consumers compete on the same queue, each message is delivered to one of them — load distribution.
- Use for work distribution, task queues, order processing.

**Topics — Publish-Subscribe communication**
- A message sent to a topic is received by **all subscribers** subscribed to that topic.
- Use for event broadcast, fan-out, notifications.

Both are first-class architectural elements; draw them explicitly on the diagram. A "queue" labelled `r:invoiceQueue` (read access) versus `w:invoiceQueue` (write access) is a useful diagram convention when access direction matters.

### What messaging removes

Compared to synchronous RPC:

| Dependency | RPC | Messaging |
|---|---|---|
| Reference | Caller must know callee | Caller knows channel only |
| Time | Both must be online | Producer/consumer independent |
| Format | Must match | Header allows mediation |
| Platform | Often shared | Broker is the bridge |

## Pipes-and-Filters Pattern (Hohpe & Woolf)

> **Problem:** How can we perform complex processing on a message while maintaining independence and flexibility of the individual processing steps?

> **Context:** A huge monolithic application performing all required business logic is inflexible and hard to maintain.

**Forces:**
- How to add or remove processing steps cleanly?
- Steps inside a monolith cannot be reused individually.
- Scalability is limited; steps cannot be distributed across environments.

**Solution:**
> Divide a larger processing task into a sequence of smaller, independent processing steps ("filters") implemented as individual applications, connected by channels ("pipes").

```
Filter → Pipe → Filter → Pipe → Filter → Pipe → Filter
```

Important framing the lecture stresses:

> **Filters do not need to "filter".** They can implement any functionality. A filter can store data in a database, translate XML to JSON, enrich a message with extra data, validate, log, audit, route, route based on content — whatever. The "filter" name is historical.

**Two data-flow variants** (the lecture names both with mnemonics):

1. **Streaming** — a filter can output partial results while still receiving more input. Analogy: water flowing through a pipe — the "water paradigm". This was the original idea.
2. **Messaging** — discrete messages are stored in a channel and processed individually. Analogy: ice cubes rolling down a pipe — the "ice-cube paradigm". This is the common variant when integrating systems.

When the pipes are queues, Pipes-and-Filters becomes a particular topology of Messaging — and the lecture draws it that way.

### Canonical filter types (Hohpe & Woolf taxonomy)

- **Translator** — converts a message from one format to another (XML → JSON).
- **Content Enricher** — adds data to a message from an external source (e.g., look up customer details and add them to an order).
- **Content Filter** (the actual filter) — removes unnecessary data from a message.
- **Message Router** — directs a message to the correct downstream channel based on content.
- **Splitter** — breaks one message into many.
- **Aggregator** — combines many messages into one.
- **Resequencer** — re-orders messages that arrived out of order.

The lecture's canonical example: a web shop produces XML order requests; the shipping system expects JSON enriched with customer data. Insert two filters between them — a **Translator** (XML → JSON) and an **Enricher** (adds customer info from a customer database).

```
Web Shop ─ XML ─→ [Translator] ─ JSON ─→ [Enricher] ─ JSON+customer ─→ Shipping
                                              ↑
                                      Customer Database
```

### Properties of Pipes-and-Filters

- **Filters compose easily** — all filters expose the same channel-based interface.
- **Filters are independent** — stand-alone applications that do not know each other.
- **Filters are reusable** — once you have a Translator, you can drop it into any pipeline.

### When to use Pipes-and-Filters

- Processing decomposes into independent steps that can each be implemented as filters.
- Flexibility is needed: reorder steps, add or remove steps without rewriting the others.

## SOA with Enterprise Service Bus (ESB)

The classical SOA solution to mediation. An ESB sits between services and handles:

- Format translation (XML ↔ JSON, etc.).
- Protocol translation (HTTP ↔ RMI, etc.).
- Routing decisions.
- Service discovery (callers talk to the bus, not the service).

```
Service A ── Service API ──┐
                           │
Service B ── Service API ──┼── [ ESB ] ── Gateway ── Client
                           │
Service C ── Service API ──┘
```

**Trade-off:** the ESB becomes a single central component that everything depends on. It can become a bottleneck and a single point of failure. The industry moved on to Microservices for this reason — putting the mediation logic into the services themselves (smart endpoints, dumb pipes).

## API Gateway Pattern (microservices.io)

A single entry point in front of multiple microservices.

**Problem:** A microservice architecture exposes many services with different APIs. Clients should not have to know all of them, and the API at the perimeter should not change every time the internal decomposition changes.

**Solution:** Insert an **API Gateway** — a server that is the single entry point into the system from outside. It handles:

- **Routing** — `/products/*` to the Product service, `/cart/*` to the Cart service, etc.
- **Authentication and authorisation** — typically the only component checking credentials, before passing requests onward.
- **Aggregation / composition** — combines responses from several services into one client-facing response.
- **Protocol translation** — for example, REST outside, gRPC or AMQP inside.
- **Rate limiting, throttling, caching, request/response transformation.**

In the lecture's reference Three-Tier Microservices architecture for the HHZ Web Shop:

```
Web UI ─→ Load Balancer ─→ Web Shop Backend ─→ API Gateway ─→ Load Balancer ─→ Product Microservice
                                                          ├─→ Load Balancer ─→ Shopping Cart Microservice
```

A "gateway" that only proxies traffic and does no auth, routing, or aggregation is not an API Gateway — it is a reverse proxy.

## Application Component Proxy Pattern (Fehling et al. 2014)

The canonical pattern for **integrating components across trust boundaries** — e.g., a Hybrid Cloud where some components run in a public (untrusted) cloud and others in a private (trusted) one.

> **Problem:** How can an application component be accessed if direct access to its hosting environment is restricted?

**Context (the partition of trust):**
- Communication may be restricted in a hybrid setup.
- Different environments have different privacy, security, trust levels.
- Firewalls control traffic.
- Limitations typically apply to one direction — usually **incoming access to the secure environment is prohibited; outgoing access from secure to insecure is allowed.**

**Solution:**
- A proxy component mimics the restricted component.
- The restricted (trusted) environment hosts the real application functionality.
- The unrestricted (untrusted) environment hosts the proxy component with the same interface.
- **Communication is always initiated from the restricted environment outward.** Outgoing access is allowed; incoming is not.
- The trusted side **never** accepts incoming connections from the untrusted side.

### Two variants

**Synchronous:**
- The restricted component opens a long-lived channel to the proxy.
- The proxy receives external requests and routes them through this open channel back to the restricted component.
- The trusted component answers on that same channel.
- The channel must be kept open at all times.

**Asynchronous:**
- A message queue is hosted somewhere both sides can reach (often a managed broker in the public cloud).
- External requests deposit messages in the queue.
- The restricted component **polls** the queue from the inside; it never has anything inbound.
- Responses go back via the same or another queue.

Concrete example from the lecture: an insecure-side AWS Beanstalk plus SQS queue; the trusted on-prem side (e.g., a local OpenStack installation) polls SQS for results.

### When to apply

Mandatory whenever the architecture spans:
- Public ↔ Private cloud (Hybrid).
- Two public clouds with asymmetric trust (Multi-Cloud).
- Cloud ↔ on-premises legacy systems.
- Any case where one side cannot accept inbound connections (firewalls, NAT, regulatory).

Skipping this pattern in Hybrid / Multi-Cloud designs is the classical "we opened a hole in the firewall for one weekend" anti-pattern — it survives in production for years.

## How to write this section of the Architekturdokumentation

For every interaction in the diagram, record:

1. **Synchronous or asynchronous** — RPC (HTTP/REST, RMI) or Messaging (queue / topic / both).
2. **Why this choice** — pin it to one of the four dependencies (Reference, Time, Format, Platform) or to a non-functional requirement (decoupling for elasticity; smoothing bursts; survivability under partial outage).
3. **Channel type and direction** — queue (P2P) vs. topic (Pub/Sub); read access vs. write access.
4. **Mediation, if any** — Translator, Enricher, Router, etc. — name each filter explicitly.
5. **Gateways and proxies** — every API Gateway and every Application Component Proxy must appear on the diagram as its own labelled element with its responsibilities documented.
