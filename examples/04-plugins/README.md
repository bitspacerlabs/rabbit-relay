# Plugins – Cross‑Cutting Concerns for Messaging

This example demonstrates **Rabbit Relay’s plugin system**, which enables platform‑level, cross‑cutting concerns (logging, metrics, tracing, headers, etc.) to be applied **consistently** across producers and consumers **without polluting business logic**.

This is how Rabbit Relay moves beyond a simple RabbitMQ wrapper and acts as a **microservices messaging platform**.

---

## What this example shows

* Centralized **logging** for all message flows
* Automatic **correlation IDs**
* Built‑in **metrics collection** (produced / processed counts)
* Optional **tracing hooks**
* Zero changes required in business handlers
* Shared behavior across **all services**

> This mirrors production patterns like middleware, interceptors, and OpenTelemetry instrumentation.

---

## Files

* `publisher.ts`
  Publishes `demo.ping` events at a fixed interval.

* `consumer.ts`
  Simple consumer that handles `demo.ping` events with **no observability code inside the handler**.

* `register.ts`
  Registers plugins globally for the service.

* `loggerPlugin.ts`
  Logs message lifecycle (produce → process → complete).

* `metricsPlugin.ts`
  Aggregates produced / processed counters per event.

* `headersPlugin.ts`
  Demonstrates header enrichment and propagation.

* `tracingPlugin.ts`
  Shows where distributed tracing hooks would live.

---

## Run

### 1) Start the consumer

```bash
npx ts-node-dev --transpile-only examples/04-plugins/consumer.ts
```

Expected output:

* plugin logs before and after processing
* metrics snapshots printed periodically
* clean business logs from the consumer

---

### 2) Start the publisher

```bash
npx ts-node-dev --transpile-only examples/04-plugins/publisher.ts
```

Expected output:

* plugin logs for every produced message
* metrics showing produced counts

---

## Sample output (annotated)

```text
[plugin:logger] -> process  name=demo.ping corr=abc123
[consumer] got ping #1
[plugin:logger] <- processed name=demo.ping
```

What this means:

* `plugin:logger` runs **before** your handler
* `consumer` contains only business logic
* `plugin:logger` runs again **after** processing
* correlation ID flows automatically

---

## Why this matters in real microservices

In production systems, teams need:

* consistent logging across services
* unified metrics
* trace propagation
* correlation IDs for debugging
* zero duplication of boilerplate

Without plugins, each service:

* re‑implements logging
* forgets metrics
* inconsistently handles headers

Rabbit Relay plugins solve this **once**, centrally.

---

## What Rabbit Relay provides (added value)

RabbitMQ alone provides:

* message delivery
* acknowledgements
* headers

Rabbit Relay plugins add:

* platform‑level observability
* lifecycle hooks
* enforced best practices
* clean separation of concerns

This is typically built by **internal platform teams** — Rabbit Relay gives it out of the box.

---

## Production notes

* Plugins are **safe for production use**
* Plugins must be fast and non‑blocking
* Heavy I/O (e.g. remote metrics) should be buffered or async
* Plugin failures should never crash message processing

---

## When to use plugins

Use plugins when:

* you have multiple services
* observability must be consistent
* business logic must stay clean
* platform behavior should be enforced centrally

Do NOT use plugins for:

* business rules
* domain decisions
* message routing logic

---

## Summary

This example demonstrates how Rabbit Relay supports **cross‑cutting concerns as first‑class citizens**, turning messaging infrastructure into a **platform**, not just a client library.

If you remove this example, you lose the story of *why Rabbit Relay scales beyond simple messaging*.
