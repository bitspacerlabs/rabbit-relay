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
  <a href="https://github.com/bitspacerlabs/rabbit-relay/blob/main/package.json">
    <img alt="Node.js" src="https://img.shields.io/node/v/@bitspacerlabs/rabbit-relay">
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

> Rabbit Relay uses **at-least-once delivery semantics**. Consumers must be idempotent because duplicates remain possible during retries, reconnects, and network failures. Read the [delivery-semantics guide](https://bitspacerlabs.github.io/rabbit-relay/docs/guide/delivery-semantics).

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

## Choose the right level

| Need | Recommended approach |
|---|---|
| A few simple publishes or consumers with full low-level control | Use `amqplib` directly |
| TypeScript-first messaging with reusable reliability conventions | Use Rabbit Relay |
| RabbitMQ Streams workloads | Use the RabbitMQ Streams client |
| A heavily configuration-driven enterprise messaging framework | Evaluate Rascal |

Rabbit Relay is designed for teams that want production-oriented conventions without replacing RabbitMQ with a proprietary abstraction.

## What is included

| Area | Capabilities |
|---|---|
| Events | Typed factories, versions, metadata, headers, correlation and causation IDs, tracing, runtime schemas |
| Publishing | Typed APIs, publisher confirms, mandatory returns, backpressure, size guards |
| Consuming | Prefetch, concurrency, middleware, wildcard handlers, explicit acknowledgement behavior |
| Reliability | Immediate and delayed retries, DLQs, redrive, in-memory TTL deduplication |
| RPC | Request/reply, correlation IDs, exclusive reply queues, timeouts |
| Recovery | Automatic reconnect, topology restoration, consumer restoration |
| Operations | Health checks, graceful shutdown, lifecycle hooks, topology planning, validation, and diff CLI |
| Observability | OpenTelemetry adapter and lifecycle events such as `handler.completed` and `message.dead-lettered` |

## Project status

Rabbit Relay is stable on the **1.x** line and follows semantic versioning. The repository includes unit tests, live RabbitMQ integration tests, and packed-package ESM, CommonJS, and TypeScript smoke tests.

> Using an AI coding agent? Give it [`llms.txt`](llms.txt) for a curated documentation map. Repository agents should begin with [`AGENTS.md`](AGENTS.md).

---

## Installation

```bash
npm i @bitspacerlabs/rabbit-relay
```

> Tip: Rabbit Relay ships TypeScript-first and supports both ESM and CommonJS builds.

---

## Quickstart (typed events)

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("example.service");

// Create a publisher bound to your queue + exchange
const pub = await broker
  .queue("example.q")
  .exchange("example.exchange", { exchangeType: "topic" });

// Define typed events (name + version)
const send = event("send", "v1").of<{ message: string }>();

// Build a typed publish API.
// Calling api.send(...) creates the event and publishes it.
const api = pub.with({ send });
await api.send({ message: "hello world" });
```

### Direct publish (produce)

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("example.publisher");

const pub = await broker
  .queue("example.q")
  .exchange("example.direct", { exchangeType: "direct" });

const hello = event("hello", "v1").of<{ msg: string }>();

await pub.produce(hello({ msg: "world" }));
```

### Routing keys

By default, Rabbit Relay publishes using the event name as the routing key.

```ts
const hello = event("hello", "v1").of<{ msg: string }>();

await pub.produce(
  hello({ msg: "world" })
); // routing key: "hello"
```

If you configure a concrete `routingKey` on the exchange, Rabbit Relay uses it when publishing:

```ts
const pub = await broker
  .queue("orders.q")
  .exchange("orders.exchange", {
    exchangeType: "topic",
    routingKey: "orders.created",
  });
```

For topic wildcard bindings such as `#` or `demo.*`, Rabbit Relay treats the value as a binding pattern and continues publishing by event name.

```ts
const pub = await broker
  .queue("plugins.q")
  .exchange("plugins.exchange", {
    exchangeType: "topic",
    routingKey: "demo.*",
  });

const ping = event("demo.ping", "v1").of<{ seq: number }>();

await pub.produce(
  ping({ seq: 1 })
); // routing key: "demo.ping"
```

You can always override the publish routing key explicitly:

```ts
await pub.publish(
  hello({ msg: "world" }),
  { routingKey: "custom.key" }
);
```

---

## Using config from plain JavaScript or JSON

If your topology config lives in a plain `.mjs`/`.cjs` module (or JSON),
TypeScript widens literal values to `string` and option fields like
`exchangeType` stop typechecking. Rabbit Relay exports reusable aliases so
you can keep the unions without hand-copying them:

```js
// platform.mjs
/** @typedef {import("@bitspacerlabs/rabbit-relay").ExchangeType} ExchangeType */

/** @type {{ name: string, type: ExchangeType }[]} */
export const EXCHANGES = [{ name: "orders.events", type: "topic" }];
```

```ts
import type { ExchangeType, TopologyMode } from "@bitspacerlabs/rabbit-relay";
```

Available aliases: `ExchangeType`, `TopologyMode`, `ErrorAction`
(`onError`), `RetryThenAction` (`retry.then`).

See [Configuration](https://bitspacerlabs.github.io/rabbit-relay/guide/configuration) for details.

---

## Examples

See runnable examples in:  
- `examples/` → https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples

Run all examples at once (requires Docker for RabbitMQ):

```bash
bash scripts/run-examples.sh
```

---

## When to use Rabbit Relay

Rabbit Relay is a good fit when your services depend on RabbitMQ for real
application behavior and you want:

- **typed message contracts** checked by TypeScript, not just at runtime
- **reliable publishing** with publisher confirms and message-size guards
- **predictable consumers** with prefetch, concurrency, and explicit acks
- **consistent retry, DLQ, and redrive** flows instead of per-service glue
- **RPC over RabbitMQ** without hand-rolling correlation IDs
- **reconnect recovery** that restores channels, topology, and consumers
- **production observability** via lifecycle hooks and OpenTelemetry
- **explicit topology ownership** - app-asserted, infra-owned (passive), or
  plan-only for CI/review, with a topology diff CLI

If you only publish a few fire-and-forget messages, raw `amqplib` may be
enough. For a feature-by-feature decision, see the
[decision guide](https://bitspacerlabs.github.io/rabbit-relay/docs/ai/decision-guide).

---

## Stability and testing

Rabbit Relay is **stable** on the 1.x line and follows semantic versioning.
The public API for publishing, consuming, retry, DLQ, RPC, topology, and
operations is stable, and the project ships an extensive test suite (unit,
live RabbitMQ integration, and packed-package ESM/CJS/TypeScript smoke
tests) running on Node.js 18, 20, 22, and 24 in CI.

See [`CHANGELOG.md`](CHANGELOG.md) for release history.

If something is unclear or missing, please open an issue (or start a
discussion) with:

- what you’re trying to build
- the RabbitMQ pattern you’re using (pub/sub, work queue, RPC, etc.)
- a small code snippet

---

## Contributing

Contributions are welcome ❤️

- Read: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- Security: [`SECURITY.md`](SECURITY.md)

If you want to help but don’t know where to start, check issues labeled **good first issue**.

---

## License

MIT © BitSpacer Labs
