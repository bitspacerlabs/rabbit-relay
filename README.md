<!--
NOTE:
- Package: @bitspacerlabs/rabbit-relay
- Repo: https://github.com/bitspacerlabs/rabbit-relay
-->

<p align="center">
  <img src="assets/rabbit-relay.svg" alt="Rabbit Relay" width="220" />
</p>

<h1 align="center">Rabbit Relay</h1>

<p align="center">
  A <strong>TypeScript-first RabbitMQ framework</strong> for building reliable publishers and consumers without hiding RabbitMQ.
</p>

<p align="center">
  Typed events · Publisher confirms · Retries and DLQs · RPC · Recovery · Graceful shutdown · OpenTelemetry
</p>

<p align="center">
  <a href="https://www.rabbitmq.com/client-libraries/devtools">
    <strong>Listed in the official RabbitMQ JavaScript and Node ecosystem</strong>
  </a>
</p>

<p align="center">
  <a href="https://github.com/bitspacerlabs/rabbit-relay/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/bitspacerlabs/rabbit-relay/ci.yml?branch=main&label=CI">
  </a>
  <a href="https://www.npmjs.com/package/@bitspacerlabs/rabbit-relay">
    <img alt="npm version" src="https://img.shields.io/npm/v/@bitspacerlabs/rabbit-relay">
  </a>
  <a href="https://www.npmjs.com/package/@bitspacerlabs/rabbit-relay">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@bitspacerlabs/rabbit-relay">
  </a>
  <a href="https://github.com/bitspacerlabs/rabbit-relay/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/bitspacerlabs/rabbit-relay?style=flat">
  </a>
  <a href="LICENSE">
    <img alt="license" src="https://img.shields.io/github/license/bitspacerlabs/rabbit-relay">
  </a>
</p>

<p align="center">
  <a href="https://bitspacerlabs.github.io/rabbit-relay/docs/">Documentation</a>
  ·
  <a href="https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples">Examples</a>
  ·
  <a href="https://github.com/bitspacerlabs/rabbit-relay/issues">Issues</a>
  ·
  <a href="https://github.com/bitspacerlabs/rabbit-relay/discussions">Discussions</a>
</p>

```bash
npm install @bitspacerlabs/rabbit-relay
```

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("orders-service", {
  publisherConfirms: true,
});

const orderCreated = event("orderCreated", "v1").of<{
  orderId: string;
  total: number;
}>();

const orders = await broker
  .queue("orders.created.q")
  .exchange("orders.events", {
    exchangeType: "topic",
    routingKey: "order.created",
  });

const api = orders.with({ orderCreated });

api.handle("orderCreated", async (_messageId, message) => {
  console.log("Processing order", message.data.orderId);
});

await api.consume({ prefetch: 20, concurrency: 5 });
await api.orderCreated({ orderId: "O-42", total: 99.5 });
```

> Rabbit Relay uses **at-least-once delivery semantics**. Consumers must be idempotent because duplicates remain possible during retries, reconnects, and network failures. Read the [delivery-semantics guide](https://bitspacerlabs.github.io/rabbit-relay/docs/delivery-semantics).

## Why Rabbit Relay?

[`amqplib`](https://github.com/amqp-node/amqplib) provides the essential AMQP primitives for Node.js. Production services commonly need an application layer around those primitives for recovery, typed contracts, retry policies, shutdown coordination, topology ownership, and observability.

Rabbit Relay provides that layer while keeping RabbitMQ concepts explicit:

- **Typed and versioned events** with optional runtime validation
- **Reliable publishing** with publisher confirms, mandatory returns, backpressure, and message-size limits
- **Predictable consumers** with prefetch, concurrency, middleware, and deterministic acknowledgements
- **Retries and dead-letter queues** with immediate or delayed retry strategies and DLQ redrive
- **Connection recovery** that restores channels, topology, and consumers
- **Graceful shutdown** that drains active handlers before closing resources
- **RPC** with correlation IDs, reply queues, and timeouts
- **Topology ownership modes** for application-owned, infrastructure-owned, or plan-only workflows
- **Operational visibility** through health state, lifecycle events, and OpenTelemetry
- **Native AMQP escape hatches** when direct `amqplib` access is needed

| Need | Recommended approach |
|---|---|
| A few simple publishes or consumers with full low-level control | Use `amqplib` directly |
| TypeScript-first messaging with reusable reliability conventions | Use Rabbit Relay |
| RabbitMQ Streams workloads | Use the RabbitMQ Streams client |
| A heavily configuration-driven enterprise messaging framework | Evaluate Rascal |

> Using an AI coding agent? Give it [`llms.txt`](llms.txt) for a curated documentation map. Repository agents should begin with [`AGENTS.md`](AGENTS.md).

## AI Coding Skills

Installable skills for AI coding agents that generate correct Rabbit Relay code:

```bash
npx skills add bitspacerlabs/rabbit-relay-skills
```

Includes skills for core API patterns, typed events, retries/DLQ, topology, RPC, and observability. Works with Claude Code, Cursor, Windsurf, GitHub Copilot, OpenCode, and Gemini CLI. See [`rabbit-relay-skills`](https://github.com/bitspacerlabs/rabbit-relay-skills) for details.

## Stability

Rabbit Relay is **stable** on the 1.x line and follows semantic versioning. The repository includes unit tests, live RabbitMQ integration tests, and packed-package ESM, CommonJS, and TypeScript smoke tests.

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and [`SECURITY.md`](SECURITY.md).

## License

MIT © BitSpacer Labs
