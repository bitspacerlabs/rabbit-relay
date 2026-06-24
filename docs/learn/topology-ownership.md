# Topology Ownership

Topology ownership answers one question:

> Who creates RabbitMQ exchanges, queues, bindings, DLQs, and retry queues?

Rabbit Relay makes this explicit with `topologyMode`.

---

## The three modes

| Mode | Owner | Behavior |
|---|---|---|
| `"assert"` | Application | Rabbit Relay declares topology |
| `"passive"` | Infrastructure | Rabbit Relay checks topology exists |
| `"plan-only"` | Review / CI | Rabbit Relay only records the plan |

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "assert",
});
```

---

## App-owned topology: `assert`

Use `assert` when the application is allowed to create RabbitMQ resources.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "assert", // [!code focus]
});
```

Rabbit Relay can declare:

- exchanges
- queues
- bindings
- configured DLQ topology
- delayed retry topology

This is the default mode.

::: tip Good for local development
`assert` is convenient when running RabbitMQ locally or in disposable test environments.
:::

---

## Infrastructure-owned topology: `passive`

Use `passive` when RabbitMQ resources are created before the app starts.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive", // [!code focus]
});
```

Rabbit Relay checks that required exchanges and queues exist.

It does not declare or bind topology.

If something is missing, startup fails early.

::: tip Good for production
Use `topologyMode: "passive"` when Terraform, Helm, RabbitMQ definitions, or DevOps scripts own RabbitMQ topology.
:::

---

## Review mode: `plan-only`

Use `plan-only` when you want topology output without RabbitMQ setup calls.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "plan-only", // [!code focus]
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(sub.planTopology());
```

This is useful for:

- CI checks
- docs
- DevOps review
- comparing application topology with infrastructure code

::: warning Plan-only does not publish or consume
`plan-only` skips topology setup calls. Normal publishing, consuming, validation, and redrive operations can still require RabbitMQ.
:::

---

## Where to set topology mode

You can set a broker-level default:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Or override it per exchange:

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    topologyMode: "assert",
  });
```

Exchange-level settings override broker-level defaults.

---

## Recommended setup

| Environment | Recommended mode |
|---|---|
| Local development | `"assert"` |
| Tests with disposable RabbitMQ | `"assert"` |
| CI topology review | `"plan-only"` |
| Production with app-owned topology | `"assert"` |
| Production with infra-owned topology | `"passive"` |

---

## Relationship with `passiveQueue`

`passiveQueue` is still supported for backward compatibility.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    passiveQueue: true,
  });
```

But it only affects the main queue declaration behavior.

For new infrastructure-managed deployments, prefer:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

::: tip Prefer topologyMode for new code
`topologyMode` describes ownership for the whole topology, not only the queue.
:::

---

## Queue arguments are immutable

RabbitMQ does not allow changing queue arguments after a queue already exists.

Examples of immutable queue arguments include:

- queue type
- dead-letter exchange
- dead-letter routing key
- message TTL

::: warning Local development reset
If you change queue arguments locally and get a precondition error, recreate the queue or reset the RabbitMQ volume.
:::

---

## Summary

- Use `"assert"` when Rabbit Relay owns topology
- Use `"passive"` when infrastructure owns topology
- Use `"plan-only"` for review and CI output
- Prefer `topologyMode` over `passiveQueue` for new code
- Keep topology ownership explicit per environment
