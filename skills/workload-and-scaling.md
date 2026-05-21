# Workload and Scaling

Source: Fehling et al., *Cloud Computing Patterns*, Springer 2014, Workload Patterns chapter. Plus the lecture's scaling and elasticity material.

## Why workload comes first

The whole architecture is shaped by what workload it must absorb. Over-provisioning wastes money; under-provisioning kills availability, which the lecture treats as one of the highest-priority qualities. The first design decision is therefore: **which of the five workload patterns describes this application's load profile?**

## The five Workload Patterns (Fehling et al.)

| Pattern | Description | Elasticity need |
|---|---|---|
| **Static Workload** | Equal over time; does not vary significantly. | None. A fixed amount of resources is sufficient. |
| **Periodic Workload** | Workload peaks periodically (daily, weekly, seasonal). | Benefits — cost savings from scaling down off-peak. |
| **Once-in-a-Lifetime Workload** | One significant peak, otherwise low. | Benefits — automated provisioning for the peak. |
| **Continuously Changing Workload** | Continuous growth or decline. | Benefits — automated adjustment of resources. |
| **Unpredictable Workload** | Cannot be predicted. | **Required.** |

Note the gradient: only Static requires no elasticity; only Unpredictable strictly requires it. Periodic, Once-in-a-Lifetime, and Continuously Changing benefit but could in principle be served by static over-provisioning at higher cost.

When the user describes "a startup that hopes for viral growth", "a Black Friday sale", "an exam-day submission system", "a podcast app with sleep-time troughs and commute-time peaks", "an internal tool used 9–5 by 50 employees", classify the workload explicitly before designing anything.

## Definitions — Scalable vs. Elastic

These are not synonyms. The lecture distinguishes them sharply.

> **Scalable Application** — A scalable application can make efficient use of increased resources. For example, a scalable application runs faster or handles increased workload with the same throughput if you add more hardware.

> **Elastic Application** — An elastic application is scalable **and** can be rescaled *during runtime, without downtime*. The application is available all the time during scaling, and resources can be added and removed dynamically.

> **Elasticity** (NIST) — The ability of a system to automatically adapt its employed resources to handle variable workloads without any downtime of the system. To the consumer of the system, the capabilities available often appear to be unlimited and can be appropriated in any quantity at any time.

Every cloud-native application aims at elasticity. Mere scalability without runtime adaptation forces planned downtimes — unacceptable for the kind of workload the cloud was invented for.

## Two scaling axes

### Vertical Scaling — "Scale Up / Scale Down"

Replace a resource with a more powerful one ("bigger box"). In a cloud, this typically means resizing a VM (more CPU, more RAM, more disk).

**Benefits:**
- Many applications run faster with more CPU/RAM without code changes.
- Software-engineering process is simpler — no data-consistency issues, no synchronisation, no load balancing required since there is still one instance.
- With virtualisation, vertical resizing is a few clicks.

**Drawbacks:**
- Hardware limits: there is always a maximum CPU / RAM / disk size for VMs. You cannot scale up infinitely.
- Single point of failure: one (powerful) machine.
- Long recovery time: restarting a big server is significantly slower than starting a small VM.
- High-end hardware costs disproportionately more than commodity hardware.

Use vertical scaling when:
- You need to improve response time and the application benefits from more CPU/RAM.
- Stable workload with rare peaks where downtime is acceptable during a resize.
- Workload does not increase significantly over time.
- Application cannot be run as multiple parallel instances — so horizontal scaling is off the table.

### Horizontal Scaling — "Scale Out / Scale In"

Add more resources of the same kind in parallel ("more boxes"). Requires a load balancer in front to distribute requests.

**Benefits:**
- No effective hardware limit — keep adding instances.
- High availability and short recovery times — if one instance fails, the others continue. No single point of failure.
- In the cloud, infinitely scalable in practice.

**Drawbacks:**
- The software-engineering process is significantly harder. You must handle:
  - Data consistency across instances (CAP-Theorem territory).
  - Synchronisation between instances.
  - Load balancing.
  - Parallel processing.
- Not all applications can be horizontally scaled.
- Capacity planning is hard in non-cloud environments. In the cloud this concern goes away.

Use horizontal scaling when:
- You need to improve **throughput** and parallel processing is possible.
- Workload varies significantly.
- You need fast recovery from server crashes.
- You need to handle workload above what any single box can carry.

> Summary: vertical scaling is easy — use it if it solves the problem. In the cloud, most of the time you need elastic horizontal scaling for high and unpredictable workloads.

## Load balancing strategies

When you scale horizontally, the load balancer chooses which instance handles each request. Common routing strategies:

- **Round Robin** — rotate through instances. Simplest, ignores load.
- **Least connections** — send to the instance with the fewest active requests.
- **Resource-based** — send based on CPU / memory usage of instances.
- **Hash-based / sticky sessions** — same client always hits the same instance. Often used as a stopgap for stateful components; do not confuse this with a real solution to state — see `state-and-consistency.md`.

## The Elasticity Engine

Horizontal scaling in the cloud is automated by an **Elasticity Engine**. It implements an infinite loop:

```
loop:
  1. Monitor defined metrics (e.g., CPU utilization)
  2. Evaluate defined elasticity rules
  3. Execute actions: add / remove resources
```

An elasticity rule has three parts:

- **Metrics** — what to observe (CPU load, request rate, queue depth, response time).
- **Conditions / thresholds** — when to fire (CPU > 80% sustained for 5 minutes).
- **Actions** — what to do (add 2 VMs of image X; scale the Beanstalk environment from 3 to 5 instances).

A concrete elasticity-rule template:

```
Monitor <Metric> every <Time>
If (<Metric> <Operator> <Value>) {
    Add | Remove <Resource> by <Number>
}
```

Example:

```
Monitor CPUUtilizationAverage every 60s
If (CPUUtilizationAverage > 80%) {
    Add UbuntuImageX412 by 2
}
```

The hard decisions in tuning an elasticity rule are:

- **Threshold height** — too low and you over-react; too high and you scale too late.
- **Cool-down period** — adding a resource takes longer than removing one, so aggressive scale-in can leave you under-provisioned.
- **Step size** — how many instances per scaling event.

### Where does the Elasticity Engine live?

1. **Integrated into the application** — for cloud-native apps that want full control. Drawback: you implement it, and it tends to lock you into the chosen cloud's APIs.
2. **Provided by the cloud platform** — what AWS Auto Scaling, GCP Managed Instance Groups, Azure VM Scale Sets, and every PaaS / CaaS / FaaS offering does. **This is the default for cloud-native architectures.** Don't build what the platform already does.

## Necessary preconditions for horizontal elasticity

The Elasticity Engine adds and removes *instances*. That only works cleanly if the instance is a **Stateless Component** — i.e., killing one and starting another loses nothing important. If state is held internally, the engine destroys data when it scales in, and routes new requests to instances that do not have the right state when it scales out.

So: **horizontal elasticity ⇒ Stateless Components ⇒ externalised state**. See `state-and-consistency.md`.

## How to write this section of the Architekturdokumentation

In the decisions document, explicitly state:

1. The classified workload pattern (one of the five), with a short justification.
2. Which scaling axis applies to each component (vertical, horizontal, or both — different components in the same application can differ).
3. The elasticity rules: which metric, which thresholds, which actions, which step size.
4. Where the elasticity engine runs (platform-provided is the default; justify any other choice).
