# What is Rabbit Relay?

Rabbit Relay is a **reliable, type-safe RabbitMQ event framework for Node.js**.

It is built on top of `amqplib` and focuses on **correctness, clarity, and learning**, without hiding RabbitMQ concepts behind opaque abstractions.

Rabbit Relay is designed for:
- Event-driven systems
- Microservices
- Message-heavy workloads
- Teams that care about reliability and observability

---

## Philosophy

> **Rabbit Relay aims to be easy to understand and hard to misuse.  
> It helps teams build reliable systems while still learning how RabbitMQ actually works.**

---

## Why not just use `amqplib`?

`amqplib` is a **low-level AMQP client**. It gives you the building blocks — but leaves all higher-level concerns to you.

In real production systems, this often leads to:
- Repeated boilerplate across services
- Subtle message-loss bugs
- Inconsistent retry and error-handling strategies
- Runtime-only failures caused by mismatched message shapes

Rabbit Relay exists to solve these problems **once**, in a consistent and type-safe way.

---

## Comparison

| Capability                     | amqplib | Rabbit Relay |
|--------------------------------|---------|--------------|
| Typed event definitions        | ❌      | ✅ |
| Publisher confirms             | Manual  | ✅ Built-in |
| RPC abstraction                | ❌      | ✅ |
| Automatic reconnect            | ❌      | ✅ |
| Backpressure handling          | ❌      | ✅ |
| Dead-letter / retry routing    | Manual  | ✅ |
| Duplicate message protection   | ❌      | ✅ |
| Plugin / extension hooks       | ❌      | ✅ |

---

## What Rabbit Relay adds

Rabbit Relay layers **safe defaults** and **explicit guarantees** on top of RabbitMQ:

- Strongly typed event factories
- Broker-acknowledged publishing
- Structured RPC over AMQP
- Automatic channel and topology recovery
- Backpressure-aware publishing
- Failure routing and duplicate guards
- Plugin hooks for logging, metrics, and tracing

All of this **without hiding RabbitMQ** or forcing a custom DSL.

---

## What Rabbit Relay is *not*

Rabbit Relay does **not**:
- Replace RabbitMQ concepts
- Abstract away exchanges, queues, or routing keys
- Attempt to be Kafka, SNS, or SQS
- Hide AMQP behavior behind magic

Instead, it helps you **use RabbitMQ correctly, consistently, and safely**.

---

## When should you use Rabbit Relay?

Use Rabbit Relay if:
- You want compile-time safety for events
- You need delivery guarantees
- You rely on RPC over RabbitMQ
- You want fewer production surprises
- You value observability and correctness

If you only need to publish a few messages and don’t care about guarantees, raw `amqplib` may be enough.

---

