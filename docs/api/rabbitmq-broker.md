# RabbitMQBroker

`RabbitMQBroker` is the main entry point for publishing and consuming events.

It owns RabbitMQ connection handling, topology declaration, publishing, consuming, reconnect behavior, shutdown, health checks, lifecycle hooks, topology inspection, topology validation, and DLQ redrive.

---

## Creating a broker

```ts
const broker = new RabbitMQBroker("payments_service");
```

The peer name identifies this broker in Rabbit Relay health output and lifecycle events.

You can also set broker-level defaults:

```ts
const broker = new RabbitMQBroker("orders_service", {
  exchangeType: "topic",
  durable: true,
  publisherConfirms: true,
  maxMessageBytes: 256 * 1024,
});
```

---

## Declaring topology

```ts
const pub = await broker
  .queue("payments_queue")
  .exchange("payments_exchange", {
    exchangeType: "topic",
  });
```

This:

- asserts the queue
- asserts the exchange
- binds the queue to the exchange
- returns a typed broker interface

---

## Exchange options

```ts
{
  exchangeType?: "topic" | "direct" | "fanout" | "headers";
  routingKey?: string;
  durable?: boolean;
  publisherConfirms?: boolean;
  passiveQueue?: boolean;
  queueArgs?: Record<string, unknown>;
  maxMessageBytes?: number;
  deadLetter?: DeadLetterConfig;
  amqp?: {
    exchange?: Options.AssertExchange;
    queue?: Options.AssertQueue;
    bind?: Record<string, unknown>;
  };
}
```

---

## Publishing

For normal publishing:

```ts
await pub.produce(eventEnvelope);
```

For per-message options:

```ts
await pub.publish(eventEnvelope, {
  maxMessageBytes: 64 * 1024,
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
    },
  },
});
```

Using factories:

```ts
const api = pub.with({ orderCreated });
await api.orderCreated({ id: "o-1" });
```

---

## Typed RPC request

Use `request<TReply>()` for request/reply flows.

```ts
type ChargeReply = {
  ok: boolean;
  transactionId?: string;
};

const reply = await pub.request<ChargeReply>(
  charge({
    orderId: "o-1",
    amount: 42,
  }),
  {
    timeoutMs: 5000,
  }
);
```

The old `meta.expectsReply` style still works for backward compatibility.

---

## Consuming

```ts
sub.handle("orderCreated", async (_id, ev) => {
  console.log(ev.data);
});

await sub.consume({
  prefetch: 50,
  concurrency: 10,
});
```

---

## Consume options

```ts
type ConsumeOptions = {
  prefetch?: number;
  concurrency?: number;
  requeueOnError?: boolean;
  onError?: "ack" | "requeue" | "dead-letter" | "retry";
  retry?: {
    attempts: number;
    delayMs?: number;
    then?: "ack" | "requeue" | "dead-letter";
  };
  dedupe?: Dedupe | {
    enabled?: boolean;
    ttlMs?: number;
    maxKeys?: number;
    keyOf?: (event: unknown) => string | undefined;
  };
  amqp?: {
    consume?: Options.Consume;
  };
};
```

---

## Local middleware

Use middleware for local, queue-specific processing behavior.

```ts
sub.use(async (ctx, next) => {
  console.log("before", ctx.event.name);
  await next();
  console.log("after", ctx.event.name);
});
```

Middleware wraps the handler for this broker interface only.

It is different from plugins, which are process-global.

---

## Lifecycle hooks

Lifecycle hooks expose operational events from the broker instance.

```ts
broker.on("consumer.started", (event) => {
  console.log(event.queue);
});

broker.on("retry.scheduled", (event) => {
  console.log(event.retryCount, event.delayMs);
});

broker.on("publish.failed", (event) => {
  console.error(event.error);
});
```

Returned broker interfaces also support `on(...)`.

```ts
sub.on("consumer.started", (event) => {
  console.log(event.queue);
});
```

---

## Topology planner

`planTopology()` returns the topology Rabbit Relay intends to declare.

```ts
const plan = broker.planTopology();
const subPlan = sub.planTopology();
```

It is read-only and does not contact RabbitMQ.

---

## Topology validation

`validateTopology()` checks whether planned exchanges and queues exist using passive AMQP checks.

```ts
const result = await broker.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

Bindings are included in the plan but are not passively validated through `amqplib`.

---

## DLQ redrive

`redriveDlq()` moves messages from a DLQ back to a target exchange/routing key.

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
});
```

Dry-run:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

Safety behavior:

- bounded by `limit`
- dry-run does not consume messages
- original DLQ message is acknowledged only after successful republish
- original DLQ message is requeued if republish fails
- message body and AMQP properties are preserved

---

## Raw channel access

```ts
await broker.withChannel(async (ch) => {
  await ch.assertExchange("custom.ex", "headers", {
    durable: true,
  });
});
```

You can also call `withChannel()` on the returned broker interface.

---

## Health checks

```ts
const health = await broker.health();
```

Health includes:

- connection status
- channel status
- confirm channel status
- reconnect status
- registered consumers
- prefetch/concurrency state
- retry configuration

---

## Graceful shutdown

```ts
await broker.close();
```

Use it during process shutdown:

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Notes

- Reconnects are automatic
- Delivery is at-least-once
- Handlers should be idempotent
- `broker.close()` closes the shared Rabbit Relay connection in the current process

---

## Summary

`RabbitMQBroker` exposes a small, explicit API aligned with RabbitMQ semantics while still allowing advanced `amqplib` access when needed.
