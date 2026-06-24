# Configuration

Rabbit Relay keeps configuration explicit and close to RabbitMQ concepts.

You configure defaults on the broker, then override them per queue/exchange interface when needed.

---

## RabbitMQ connection URL

Rabbit Relay reads the RabbitMQ connection URL from:

```bash
RABBITMQ_URL
```

Example:

```bash
RABBITMQ_URL=amqp://user:password@localhost:5672
```

If not set, Rabbit Relay uses:

```text
amqp://user:password@localhost
```

---

## Broker-level defaults

```ts
import { RabbitMQBroker } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("orders-service", {
  exchangeType: "topic",
  routingKey: "#",
  durable: true,
  publisherConfirms: false,
  topologyMode: "assert",
  maxMessageBytes: 256 * 1024,
});
```

These options become defaults for broker interfaces created from this broker.

---

## Exchange-level overrides

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    publisherConfirms: true,
    topologyMode: "passive",
  });
```

Exchange-level options override broker-level defaults.

---

## Common topology options

| Option | Description | Default |
|---|---|---|
| `exchangeType` | RabbitMQ exchange type | `"topic"` |
| `routingKey` | Binding routing key | `"#"` |
| `durable` | Durable exchange/queue declaration | `true` |
| `publisherConfirms` | Use confirm channel for publishing | `false` |
| `topologyMode` | Assert, passively check, or only plan topology | `"assert"` |
| `passiveQueue` | Backward-compatible queue-only passive check | `false` |
| `queueArgs` | RabbitMQ queue arguments | `undefined` |
| `maxMessageBytes` | Maximum serialized event size | `undefined` |
| `deadLetter` | Built-in DLQ helper | `undefined` |
| `amqp` | Native amqplib options | `undefined` |

---

## Topology ownership mode

Use `topologyMode` to decide who owns RabbitMQ topology.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Supported values:

| Mode | Use when |
|---|---|
| `"assert"` | Rabbit Relay should declare topology |
| `"passive"` | Terraform, Helm, RabbitMQ definitions, or DevOps creates topology |
| `"plan-only"` | CI/docs should inspect topology without setup calls |

Default:

```ts
topologyMode: "assert"
```

For new infrastructure-managed deployments, prefer:

```ts
topologyMode: "passive"
```

over:

```ts
passiveQueue: true
```

`passiveQueue` remains supported, but it only controls the main queue declaration behavior.

---

## App-owned topology

Use the default mode when the application owns topology.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "assert",
});
```

Rabbit Relay declares:

- exchange
- queue
- binding
- configured DLQ topology
- delayed retry topology when used

---

## Infrastructure-owned topology

Use passive mode when topology is created before the app starts.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Rabbit Relay checks that required exchanges and queues exist.

It does not declare or bind topology.

If required topology is missing, startup fails early.

---

## CI / review topology mode

Use plan-only mode when you want Rabbit Relay to build a topology plan without RabbitMQ topology setup calls.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "plan-only",
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(broker.planTopology());
```

This is useful for:

- CI checks
- DevOps review
- docs generation
- comparing code topology with infrastructure topology

---

## Publisher confirms

Publisher confirms are disabled by default.

Enable them when the publisher must know that RabbitMQ accepted the message.

```ts
const pub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    publisherConfirms: true,
  });
```

See [Publisher Confirms](/features/publisher-confirms).

---

## Message size guard

Use `maxMessageBytes` to fail fast when an event payload is too large.

```ts
const broker = new RabbitMQBroker("orders-service", {
  maxMessageBytes: 256 * 1024,
});
```

Override per publish:

```ts
await sub.publish(eventEnvelope, {
  maxMessageBytes: 64 * 1024,
});
```

See [Message Size Guard](/features/message-size-guard).

---

## Dead-letter configuration

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });
```

When `autoDeclare: true`, Rabbit Relay includes DLQ topology in assertion and planning behavior.

With `topologyMode: "passive"`, Rabbit Relay checks the configured DLX/DLQ exist instead of declaring them.

With `topologyMode: "plan-only"`, Rabbit Relay records them in the topology plan without setup calls.

---

## Native amqplib options

Use `amqp` when you need RabbitMQ-specific options not directly modeled by Rabbit Relay.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    amqp: {
      queue: {
        arguments: {
          "x-queue-type": "quorum",
        },
      },
      publish: {
        persistent: true,
      },
    },
  });
```

See [amqplib Escape Hatch](/features/amqplib-escape-hatch).

---

## Recommended environment setup

| Environment | Recommended mode |
|---|---|
| Local development | `"assert"` |
| Tests with disposable RabbitMQ | `"assert"` |
| CI topology review | `"plan-only"` |
| Production with app-owned topology | `"assert"` |
| Production with infra-owned topology | `"passive"` |

---

## Summary

- Configure defaults on `RabbitMQBroker`
- Override per `.exchange(...)`
- Use `topologyMode` to make topology ownership explicit
- Prefer `topologyMode: "passive"` for infrastructure-managed RabbitMQ
- Keep `passiveQueue` only for legacy queue-only passive behavior
