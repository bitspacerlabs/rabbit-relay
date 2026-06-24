---
layout: home

hero:
  name: "Rabbit Relay"
  text: "Type-safe RabbitMQ messaging for Node.js"
  tagline: "Build reliable event-driven services with typed events, resilient delivery, and production-ready messaging patterns."
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
  - icon:
      src: /icons/blocks.svg
      alt: Type-safe events
    title: Type-Safe Events
    details: Define events once and publish or consume them with full TypeScript inference.

  - icon:
      src: /icons/shield-check.svg
      alt: Reliable publishing
    title: Reliable Publishing
    details: Use publisher confirms to make sure important messages are accepted by RabbitMQ.

  - icon:
      src: /icons/repeat-2.svg
      alt: Built-in RPC
    title: Built-in RPC
    details: Request–reply messaging with correlation IDs, reply queues, and timeouts handled for you.

  - icon:
      src: /icons/gauge.svg
      alt: Backpressure control
    title: Backpressure Control
    details: Protect your services with prefetch, controlled concurrency, and safe message handling.

  - icon:
      src: /icons/refresh-cw-off.svg
      alt: Retries and dead-letter queues
    title: Retries & DLQs
    details: Add bounded retries, delayed retry queues, dead-letter queues, and redrive flows.

  - icon:
      src: /icons/plug-zap.svg
      alt: Auto reconnect
    title: Auto Reconnect
    details: Recover connections, channels, topology, bindings, and consumers after temporary outages.

  - icon:
      src: /icons/radar.svg
      alt: Observability
    title: Observability Ready
    details: Add lifecycle hooks, health checks, topology validation, and OpenTelemetry integration.

  - icon:
      src: /icons/wrench.svg
      alt: Native AMQP access
    title: Native AMQP Access
    details: Pass amqplib options or access the raw channel when you need advanced RabbitMQ control.
---

## Example

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("payments-service");

const chargeRequested = event("payments.charge.requested", "v1").of<{
  orderId: string;
  amount: number;
}>();

const publisher = await broker
  .queue("payments_queue")
  .exchange("payments", { exchangeType: "topic" });

await publisher.produce(
  chargeRequested({ orderId: "ORD-1", amount: 99.5 })
);
````
