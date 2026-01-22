<p align="center">
  <img src="assets/logo.svg" alt="Rabbit Relay" width="260">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/rabbit-relay">
    <img src="https://img.shields.io/npm/v/@bitspacerlabs/rabbit-relay.svg?style=flat-square" alt="NPM Version">
  </a>
  <a href="https://github.com/bitspacerlabs/rabbit-relay">
    <img src="https://img.shields.io/github/stars/@bitspacerlabs/rabbit-relay.svg?style=flat-square" alt="GitHub Stars">
  </a>
  <a href="https://github.com/bitspacerlabs/rabbit-relay/issues">
    <img src="https://img.shields.io/github/issues/@bitspacerlabs/rabbit-relay.svg?style=flat-square" alt="Issues">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License">
  </a>
</p>

---

## Rabbit Relay

**Rabbit Relay** is a type-safe RabbitMQ framework for Node.js.

It helps you publish and consume events using real RabbitMQ concepts, with TypeScript types and reliable defaults.

---

## Start Here

**Documentation & Guides**  
https://bitspacerlabs.github.io/rabbit-relay/


---

## Installation

```bash
npm install @bitspacerlabs/rabbit-relay
```

---

## Minimal Examples

```ts
import { RabbitMQBroker, event } from "rabbit-relay";

const broker = new RabbitMQBroker("example.service");

const pub = await broker.queue("example.q").exchange("example.exchange", { exchangeType: "topic" });

const send = event("send", "v1").of<{ message: string }>();

const api = pub.with({ send });

await api.send({ message: "hello world" });
```

---


```ts
import { RabbitMQBroker, event } from "rabbit-relay";

const broker = new RabbitMQBroker("example.publisher");

const pub = await broker.queue("example.q").exchange("example.direct", { exchangeType: "direct" });

const hello = event("hello", "v1").of<{ msg: string }>();

await pub.produce(hello({ msg: "world" }));
```

---

## When to Use Rabbit Relay

- You already use RabbitMQ
- You want type-safe events
- You prefer explicit topology and ownership
- You don’t want hidden abstractions

---

## License

MIT © BitSpacerLabs