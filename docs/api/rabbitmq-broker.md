# RabbitMQBroker

`RabbitMQBroker` is the main entry point for Rabbit Relay.

It creates queue/exchange interfaces, publishes events, consumes events, exposes lifecycle hooks, and provides operational helpers such as health checks, topology planning, topology validation, and DLQ redrive.

---

## Creating a broker

```ts
import { RabbitMQBroker } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("orders-service");
```

The first argument is the peer/service name. It is used in lifecycle events, health output, and operational visibility.

---

## Broker configuration

```ts
const broker = new RabbitMQBroker("orders-service", {
  exchangeType: "topic",
  routingKey: "#",
  durable: true,
  publisherConfirms: false,
  topologyMode: "assert",
  maxMessageBytes: 256 * 1024,
});
```

Supported broker-level options are the same as exchange-level defaults.

Exchange-level options override broker-level options.

---

## Creating a queue/exchange interface

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

This creates a broker interface bound to:

- one queue
- one exchange
- one routing key pattern

By default, Rabbit Relay asserts the exchange, queue, and binding.

---

## Exchange options

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    durable: true,
    publisherConfirms: true,
    topologyMode: "assert",
    passiveQueue: false,
    maxMessageBytes: 256 * 1024,
    queueArgs: {
      "x-queue-type": "quorum",
    },
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
    amqp: {
      exchange: {},
      queue: {},
      bind: {},
    },
  });
```

| Option | Description |
|---|---|
| `exchangeType` | RabbitMQ exchange type: `topic`, `direct`, `fanout`, or `headers` |
| `routingKey` | Binding routing key. Defaults to `#` |
| `durable` | Whether declared exchange/queue should be durable. Defaults to `true` |
| `publisherConfirms` | Use a confirm channel for publishing |
| `topologyMode` | Controls topology behavior: `assert`, `passive`, or `plan-only` |
| `passiveQueue` | Backward-compatible queue-only passive check |
| `maxMessageBytes` | Maximum serialized event size |
| `queueArgs` | Queue arguments passed to RabbitMQ |
| `deadLetter` | Built-in dead-letter topology helper |
| `amqp` | Native amqplib escape hatch options |

---

## Topology modes

`topologyMode` controls what Rabbit Relay does when `.exchange(...)` is called.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    topologyMode: "passive",
  });
```

Supported values:

| Mode | Behavior | Use when |
|---|---|---|
| `"assert"` | Declare exchange, queue, binding, configured DLQ topology, and delayed retry topology | the app owns RabbitMQ topology |
| `"passive"` | Check required exchanges and queues exist without declaring them | infrastructure owns RabbitMQ topology |
| `"plan-only"` | Build the topology plan but skip topology setup calls | CI/docs/DevOps review |

Default:

```ts
topologyMode: "assert"
```

Use `topologyMode: "passive"` for infrastructure-managed topology.

Use `topologyMode: "plan-only"` when you want to inspect topology without creating RabbitMQ resources.

See [Topology Modes](/features/topology-modes).

---

## passiveQueue compatibility

`passiveQueue` is still supported for backward compatibility.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    passiveQueue: true,
  });
```

`passiveQueue` only affects the main queue declaration behavior.

For new infrastructure-managed deployments, prefer:

```ts
topologyMode: "passive"
```

This makes ownership clearer because it applies to topology behavior as a whole.

---

## Producing events

```ts
await sub.produce(orderCreated({ id: "o-1" }));
```

You can publish multiple events sequentially:

```ts
await sub.produceMany(
  orderCreated({ id: "o-1" }),
  orderCreated({ id: "o-2" })
);
```

Use `publish()` when you need per-message options:

```ts
await sub.publish(orderCreated({ id: "o-1" }), {
  routingKey: "orders.created",
  maxMessageBytes: 256 * 1024,
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
    },
  },
});
```

---

## Consuming events

```ts
sub.handle("order.created", async (_id, event) => {
  console.log(event.data);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

Supported consume options include:

| Option | Description |
|---|---|
| `prefetch` | Maximum unacknowledged messages |
| `concurrency` | Maximum parallel handler executions |
| `onError` | Error behavior: `ack`, `requeue`, `dead-letter`, or `retry` |
| `retry` | Retry settings when `onError: "retry"` |
| `dedupe` | Consumer-side duplicate suppression |
| `amqp.consume` | Native amqplib consume options |

---

## Delayed retry topology

When delayed retry is configured, Rabbit Relay may need retry exchanges and retry queues.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

Delayed retry follows `topologyMode`:

| Mode | Delayed retry behavior |
|---|---|
| `"assert"` | Declare retry exchange, retry queue, and binding |
| `"passive"` | Check retry exchange and retry queue exist |
| `"plan-only"` | Skip retry topology setup |

---

## RPC request

Use `request()` when you want a typed reply.

```ts
const reply = await sub.request<{ ok: boolean }>(
  orderCreated({ id: "o-1" }),
  { timeoutMs: 5000 }
);
```

---

## Middleware

```ts
sub.use(async (ctx, next) => {
  console.log(ctx.queue, ctx.event.name);
  await next();
});
```

Middleware wraps handler execution for one broker interface.

---

## Lifecycle hooks

```ts
sub.on("consumer.started", (event) => {
  console.log(event.queue, event.prefetch, event.concurrency);
});
```

Broker-level hooks are also supported:

```ts
broker.on("broker.closed", (event) => {
  console.log(event.peerName);
});
```

---

## Topology planner

`planTopology()` returns Rabbit Relay's known topology plan.

It does not contact RabbitMQ.

```ts
const plan = sub.planTopology();
```

Broker-level plan:

```ts
const fullPlan = broker.planTopology();
```

See [Topology Planner](/features/topology-planner).

---

## Topology validation

`validateTopology()` checks planned exchanges and queues using passive AMQP checks.

It does not declare or modify RabbitMQ resources.

```ts
const result = await sub.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

Broker-level validation:

```ts
const result = await broker.validateTopology();
```

See [Topology Validation](/features/topology-validation).

---

## DLQ redrive

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

The original DLQ message is acknowledged only after republish succeeds.

---

## Health

```ts
const health = await broker.health();
```

Health includes connection/channel state and consumer state.

---

## withChannel escape hatch

Use `withChannel()` for advanced amqplib operations.

```ts
await broker.withChannel(async (channel) => {
  const info = await channel.checkQueue("orders.q");
  console.log(info.messageCount);
});
```

---

## Close

```ts
await broker.close();
```

This stops active consumers, closes Rabbit Relay resources, and clears lifecycle hooks.

---

## Summary

- `RabbitMQBroker` is the main runtime API
- `.queue(...).exchange(...)` creates a typed broker interface
- `topologyMode` controls topology ownership behavior
- `planTopology()` is read-only
- `validateTopology()` is passive and non-mutating
- `redriveDlq()` safely republishs DLQ messages
