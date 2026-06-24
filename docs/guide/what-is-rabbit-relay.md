# What is Rabbit Relay?

Rabbit Relay is a **type-safe RabbitMQ messaging framework for Node.js**.

It is built on top of `amqplib`, but adds the patterns most teams end up building themselves:

- typed events
- reliable publishing
- consumers with concurrency control
- retries and dead-letter queues
- RPC over RabbitMQ
- reconnect and topology recovery
- observability hooks

Rabbit Relay does not try to hide RabbitMQ.

Instead, it helps you use RabbitMQ correctly, consistently, and with fewer production mistakes.

---

## The idea

RabbitMQ is powerful, but raw `amqplib` is low-level.

You work directly with channels, exchanges, queues, bindings, acknowledgements, retries, confirms, and reconnect behavior.

That control is useful, but in real services it often creates repeated code and small mistakes:

- publishing without waiting for broker confirms
- consumers handling too many messages at once
- retry logic implemented differently in every service
- dead-letter queues created manually and inconsistently
- message contracts only failing at runtime
- reconnect logic restoring only part of the topology
- observability added after something breaks

Rabbit Relay gives these patterns a clear, typed, reusable shape.

---

## Why Rabbit Relay?

Rabbit Relay is designed for teams that want RabbitMQ to stay understandable, but safer to use.

You still work with RabbitMQ concepts like:

- exchanges
- queues
- routing keys
- acknowledgements
- prefetch
- dead-letter queues
- publisher confirms

But Rabbit Relay gives you a higher-level API around them, so your services can focus on business logic instead of messaging boilerplate.

---

## What it gives you

### Type-safe events

Define an event once and use it safely across publishers and consumers.

```ts
const chargeRequested = event("payments.charge.requested", "v1").of<{
  orderId: string;
  amount: number;
}>();
```

Now the message shape is checked by TypeScript before the service runs.

---

### Reliable publishing

Rabbit Relay supports publisher confirms, so critical messages can wait until RabbitMQ accepts them.

This helps avoid the common mistake of “sent from the app” being treated as “accepted by the broker”.

---

### Safer consumers

Consumers can use prefetch and concurrency limits to avoid overwhelming a service.

That makes message handling more predictable under load.

---

### Retries and dead-letter queues

Rabbit Relay gives you a consistent way to handle failures using retry queues, delayed retry, DLQs, and redrive helpers.

Instead of every service inventing its own failure strategy, the behavior becomes explicit and reusable.

---

### RPC over RabbitMQ

Rabbit Relay includes request-reply messaging with correlation IDs, reply queues, and timeouts handled for you.

This is useful when one service needs a response from another service but you still want to communicate over RabbitMQ.

---

### Recovery after outages

Rabbit Relay can restore channels, topology, bindings, and consumers after temporary connection failures.

This reduces the amount of reconnect code each service has to own.

---

### Observability hooks

Rabbit Relay provides lifecycle hooks and tracing/metrics integration points, so messaging behavior is easier to inspect in production.

You can see what is being published, consumed, retried, dead-lettered, or redriven.

---

## Rabbit Relay vs amqplib

| Need | With amqplib | With Rabbit Relay |
|---|---|---|
| Define message contracts | Manual TypeScript types | Typed event factories |
| Publish reliably | Manually use confirm channels | Built-in publisher confirms |
| Control consumer load | Manually manage prefetch | Prefetch and concurrency helpers |
| Retry failed messages | Custom queues and routing | Retry/DLQ helpers |
| Build RPC | Manual correlation/reply logic | Built-in RPC |
| Reconnect safely | Custom recovery code | Topology and consumer recovery |
| Add observability | Manual instrumentation | Lifecycle hooks and adapters |
| Use advanced AMQP options | Directly available | Still available through escape hatches |

---

## What Rabbit Relay is not

Rabbit Relay is not a replacement for RabbitMQ knowledge.

It does not pretend exchanges, queues, routing keys, acknowledgements, or dead-lettering do not exist.

It also does not promise exactly-once delivery by magic.

Rabbit Relay keeps RabbitMQ concepts visible, but gives them safer defaults and clearer APIs.

---

## When should you use it?

Use Rabbit Relay when you are building services that depend on RabbitMQ for real application behavior.

It is a good fit when you need:

- typed message contracts
- reliable publishing
- predictable consumers
- retry and DLQ behavior
- RPC over RabbitMQ
- reconnect recovery
- production observability

If you only need to publish a few simple messages, raw `amqplib` may be enough.

If RabbitMQ is part of your service architecture, Rabbit Relay gives you a safer foundation.
