---
layout: home

hero:
  name: "Rabbit Relay"
  text: "Type-safe messaging for RabbitMQ in Node.js"
  tagline: "Fast. Typed. Resilient."
  image:
    src: rabbit-relay.svg
    alt: "Rabbit Relay Logo"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quickstart
    - theme: alt
      text: Why Rabbit Relay?
      link: /guide/what-is-rabbit-relay
    - theme: alt
      text: GitHub
      link: https://github.com/bitspacerlabs/rabbit-relay

features:
  - icon: 🧠
    title: Simple, Typed API
    details: Publish and consume strongly typed events with full TypeScript safety.

  - icon: 🛡️
    title: Publisher Confirms
    details: Wait for broker acknowledgements to guarantee message delivery.

  - icon: 🔁
    title: Built-in RPC
    details: Request–reply messaging with correlation IDs and timeouts handled.

  - icon: 🚦
    title: Backpressure Control
    details: Automatically pauses publishing when channels are saturated.

  - icon: 🚨
    title: Failure Routing
    details: Route failures to retries or dead-letter queues with zero boilerplate.

  - icon: 🔄
    title: Auto Reconnect
    details: Restores connections, channels, queues, and bindings automatically.

  - icon: 🧬
    title: Duplicate Guard
    details: Prevents reprocessing with TTL-based message de-duplication.

  - icon: 🧩
    title: Plugin Hooks
    details: Extend behavior with lightweight hooks for logging and metrics.
---

## ⚡ Example

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("payments-service");

const charge = event("payments.charge", "v1").of<{
  orderId: string;
  amount: number;
}>();

const pub = await broker
  .queue("payments_queue")
  .exchange("payments", { exchangeType: "topic" });

await pub.produce(
  charge({ orderId: "ORD-1", amount: 99.5 })
);

```