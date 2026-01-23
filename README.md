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
  A <b>type-safe</b> RabbitMQ framework for Node.js (TypeScript), built on top of <b>amqplib</b> to simplify
  event-driven messaging, publishing, and consumption.
</p>

<p align="center">
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
  <a href="https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples">Examples</a>
  ·
  <a href="https://github.com/bitspacerlabs/rabbit-relay/issues">Issues</a>
  ·
  <a href="https://github.com/bitspacerlabs/rabbit-relay/discussions">Discussions</a>
</p>

---

## Why Rabbit Relay?

**amqplib is powerful, but it’s low-level.** Rabbit Relay keeps “real RabbitMQ concepts” (exchanges, queues, routing keys),
and adds:

- ✅ **Type-safe events** (typed payloads + versioning)
- ✅ **Cleaner publish / consume APIs** (less boilerplate)
- ✅ **Explicit topology & ownership** (no hidden abstractions)
- ✅ **Reliable defaults** (so every service doesn’t reinvent the same setup)

If you already use RabbitMQ and you want a better TypeScript developer experience, Rabbit Relay is for you.

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

// Build a typed API and publish
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

---

## Examples

See runnable examples in:  
- `examples/` → https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples

---

## When to use Rabbit Relay

- You already use RabbitMQ
- You want **type-safe events**
- You prefer **explicit topology** and ownership
- You don’t want “magic” abstractions

---

## Project status

Rabbit Relay is actively evolving. If something is unclear or missing, please open an issue (or start a discussion) with:
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
