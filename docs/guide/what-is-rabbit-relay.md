# What is Rabbit Relay?

Rabbit Relay is a **reliable, type-safe RabbitMQ event framework for Node.js**.

It is built on top of `amqplib` and focuses on **correctness, clarity, and learning**, without hiding RabbitMQ concepts behind opaque abstractions.

Rabbit Relay is designed for:

- event-driven systems
- microservices
- message-heavy workloads
- teams that care about reliability and observability

---

## Philosophy

> **Rabbit Relay aims to be easy to understand and hard to misuse.  
> It helps teams build reliable systems while still learning how RabbitMQ actually works.**

---

## Why not just use `amqplib`?

`amqplib` is a low-level AMQP client. It gives you the building blocks, but leaves all higher-level concerns to you.

In real production systems, this often leads to:

- repeated boilerplate across services
- subtle message-loss bugs
- inconsistent retry and error-handling strategies
- runtime-only failures caused by mismatched message shapes
- unclear operational behavior during retries, DLQs, and reconnects

Rabbit Relay exists to solve these problems once, in a consistent and type-safe way.

---

## Comparison

| Capability | amqplib | Rabbit Relay |
|---|---|---|
| Typed event definitions | ❌ | ✅ |
| Publisher confirms | Manual | ✅ Built-in |
| RPC abstraction | ❌ | ✅ |
| Automatic reconnect | ❌ | ✅ |
| Backpressure handling | ❌ | ✅ |
| Dead-letter / retry routing | Manual | ✅ |
| Delayed retry | Manual | ✅ |
| Duplicate message protection | ❌ | ✅ |
| Lifecycle hooks | ❌ | ✅ |
| OpenTelemetry adapter | Manual | ✅ |
| Topology planning / validation | Manual | ✅ |
| DLQ redrive helper | Manual | ✅ |
| Plugin / extension hooks | ❌ | ✅ |

---

## What Rabbit Relay adds

Rabbit Relay layers safe defaults and explicit guarantees on top of RabbitMQ:

- strongly typed event factories
- broker-acknowledged publishing
- structured RPC over AMQP
- automatic channel and topology recovery
- backpressure-aware publishing
- failure routing, delayed retry, and duplicate guards
- lifecycle hooks for operational visibility
- OpenTelemetry adapter
- topology planning and passive validation
- DLQ redrive helper for support workflows
- plugin hooks for logging, metrics, and tracing

All of this without hiding RabbitMQ or forcing a custom DSL.

---

## What Rabbit Relay is not

Rabbit Relay does **not**:

- replace RabbitMQ concepts
- abstract away exchanges, queues, or routing keys
- attempt to be Kafka, SNS, or SQS
- hide AMQP behavior behind magic
- provide exactly-once delivery by itself

Instead, it helps you use RabbitMQ correctly, consistently, and safely.

---

## When should you use Rabbit Relay?

Use Rabbit Relay if:

- you want compile-time safety for events
- you need delivery guarantees
- you rely on RPC over RabbitMQ
- you need predictable retry/DLQ behavior
- you want operational visibility for production systems
- you value observability and correctness

If you only need to publish a few messages and do not care about guarantees, raw `amqplib` may be enough.
