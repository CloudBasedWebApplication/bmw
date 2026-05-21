# NIST Cloud Models and Responsibility Split

Source: Mell & Grance, *The NIST Definition of Cloud Computing*, NIST SP 800-145. Plus FaaS and CaaS, which post-date the NIST document but are taught by Breitenbücher as natural extensions.

## The five essential characteristics (NIST)

A cloud offering must have all five — otherwise it is "managed hosting", not cloud:

1. **On-demand self-service** — consumers can provision resources without human interaction on the provider side.
2. **Broad network access** — resources are accessible over the network through standard mechanisms.
3. **Resource pooling** — provider's resources are pooled to serve many consumers using a multi-tenant model.
4. **Rapid elasticity** — capabilities can be elastically provisioned and released, often automatically, to scale rapidly outward and inward.
5. **Measured service** — usage is monitored, controlled, and reported, providing transparency for both provider and consumer (→ pay-per-use).

If any of these is missing, what you have is not cloud computing in the NIST sense. Hosting a VM at a co-location provider is not cloud just because someone calls it "the cloud".

## The five service models

The lecture stacks them as layers of management responsibility. Higher up the stack: less you manage, less control, more vendor lock-in, more fine-grained billing.

| Layer | Traditional IT | IaaS | CaaS | PaaS | FaaS | SaaS |
|---|---|---|---|---|---|---|
| Data | you | you | you | you | you | you* |
| Applications | you | you | you | you | function code only | provider |
| Runtimes | you | you | you | provider | provider | provider |
| Containers | — | — | provider | provider | provider | provider |
| Operating Systems | you | you | provider | provider | provider | provider |
| Virtualisation | you | provider | provider | provider | provider | provider |
| Hardware | you | provider | provider | provider | provider | provider |

\* In SaaS the consumer's *business* data may still be conceptually theirs, but it lives inside the provider's system.

NIST originally defines only IaaS, PaaS, SaaS. The lecture adds **CaaS** (Container as a Service — e.g., AWS ECS, Azure Container Instances, Google Cloud Run) between IaaS and PaaS, and **FaaS** (Function as a Service — e.g., AWS Lambda) between PaaS and SaaS.

### IaaS — Infrastructure as a Service

NIST: "*The capability provided to the consumer is to provision processing, storage, networks, and other fundamental computing resources where the consumer is able to deploy and run arbitrary software, which can include operating systems and applications.*"

Concrete examples: AWS EC2, Azure VMs, Google Compute Engine, OpenStack Nova.

Use when: you need full OS control (custom kernel, low-level drivers, license-bound OS), or when the application cannot be containerised or refactored to fit a higher abstraction.

Architectural consequence: every IaaS box is a single point of failure unless explicitly replicated, scaled, and load-balanced. You provide all of that yourself.

### CaaS — Container as a Service

The provider runs container runtimes (Docker, containerd) and orchestrators; you supply container images. Examples: AWS ECS / Fargate, Azure Container Instances, Google Cloud Run, Kubernetes-as-a-Service offerings.

Use when: your application is containerised and you want elastic scaling without managing VMs.

Architectural consequence: the unit of scaling is now the container, not the VM. Stateless container design becomes essential.

### PaaS — Platform as a Service

NIST: "*The capability provided to the consumer is to deploy onto the cloud infrastructure consumer-created or acquired applications created using programming languages, libraries, services, and tools supported by the provider. The consumer does not manage or control the underlying cloud infrastructure including network, servers, operating systems, or storage, but has control over the deployed applications and possibly configuration settings for the application-hosting environment.*"

Concrete examples: AWS Elastic Beanstalk, Google App Engine, Heroku, Azure App Service.

Use when: you write standard web applications in a supported language and want scaling, health checks, logging, monitoring, deployment pipelines done for you.

Architectural consequence: the platform expects your application to be a perpetual process listening for requests. It will replicate it, restart it on failure, route to it via load balancer. Your application must therefore be a **Stateless Component** or it breaks the platform's contract.

### FaaS — Function as a Service (Serverless)

The unit of deployment is a single function with one or more event triggers (HTTP, queue message, blob upload, cron, DB change). Examples: AWS Lambda, Azure Functions, Google Cloud Functions.

Use when:
- Workload is genuinely event-driven and bursty.
- A request can be handled by a short-lived, stateless function (<15 min on Lambda).
- You want per-invocation billing — no idle cost.

Do not use FaaS when:
- The workload is steady — a permanently-running PaaS app is cheaper.
- The function needs significant warm state between invocations — cold-start latency will dominate.
- The function chains many other functions synchronously — you get a distributed monolith with worse latency.

Architectural consequence: every FaaS function is, by construction, a Stateless Component. All state must live in a managed store (DBaaS, Blob aaS, Cache aaS). "Serverless" does not mean there are no servers; it means you stop seeing them.

### SaaS — Software as a Service

NIST: "*The capability provided to the consumer is to use the provider's applications running on a cloud infrastructure. The applications are accessible from various client devices through either a thin client interface, such as a web browser, or a program interface.*"

Concrete examples: Gmail, Office 365, Salesforce, GitHub.

For architecture purposes, the SaaS layer matters mainly because pieces of the system you design can be SaaS *components* you consume — for example, an authentication SaaS (Auth0, AWS Cognito), an email-sending SaaS (SendGrid), a payment SaaS (Stripe).

Architectural consequence: every SaaS dependency is a third party with its own availability, latency, and pricing model. Treat each as an external system on your architecture diagram, with the integration style (HTTP API, webhook, SDK) labelled.

## Deployment models

1. **Public Cloud** — owned and operated by a third-party provider (the "hyperscalers": AWS since 2006, Google Cloud since 2008, Microsoft Azure since 2010). Off-premises for the consumer, multi-tenant.
2. **Private Cloud** — operated for a single organisation. Can be on-premises or hosted by a third party. Same five NIST characteristics, but no multi-tenancy across organisations.
3. **Hybrid Cloud** — two or more distinct clouds (public + private, typically) that remain unique but are bound together by technology enabling data and application portability. This is the case for which the **Application Component Proxy Pattern** exists.
4. **Community Cloud** — provisioned for exclusive use by a specific community of consumers with shared concerns (e.g., a government-only cloud).
5. **Multi-Cloud** — using multiple public clouds in parallel. Not in NIST. Breitenbücher adds it explicitly because it is now common. Drivers: avoiding vendor lock-in, regulatory residency requirements, best-of-breed services.

## How to pick the service model — decision flow

```
Is the workload steady, predictable, and small?
   yes → PaaS (single instance) or even a single VM (IaaS)
   no  → continue

Is the workload event-driven and bursty, with short-lived computations?
   yes → FaaS
   no  → continue

Do you need OS-level control (kernel modules, specific OS versions, licensed OS)?
   yes → IaaS
   no  → continue

Is the application containerised, and do you want to manage just the container?
   yes → CaaS
   no  → PaaS  (default for web applications written in standard stacks)
```

For storage, the choice is orthogonal — see `data-storage-patterns.md`.

## Common mistake — confusing the model with the deployment

PaaS is not "public". Private PaaS exists (e.g., Cloud Foundry on-premises). FaaS is not "serverless meaning no servers" — it means the consumer does not provision them. SaaS is not "any web application accessible via browser" — your own deployed web application is not SaaS, it is the application running on PaaS or IaaS.
