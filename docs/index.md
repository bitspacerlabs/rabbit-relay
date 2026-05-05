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
    details: Wait for broker acknowledgements when critical messages must be accepted by RabbitMQ.

  - icon: 🔁
    title: Built-in RPC
    details: Request–reply messaging with correlation IDs, reply queues, and timeouts handled.

  - icon: 🚦
    title: Backpressure & Concurrency
    details: Control channel pressure with prefetch and protect services with real handler concurrency.

  - icon: 🚨
    title: Retry & Dead-Letter Queues
    details: Use bounded retries and DLQ routing for predictable failure handling.

  - icon: 🔄
    title: Auto Reconnect
    details: Restore channels, topology, bindings, and consumers after temporary outages.

  - icon: 🧰
    title: amqplib Escape Hatch
    details: Pass native AMQP options or access the raw channel when advanced RabbitMQ features are needed.

  - icon: 🩺
    title: Health & Shutdown
    details: Inspect broker health and close consumers, channels, and connections cleanly.
---

## Example

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
