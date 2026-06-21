# Decision Guide

Use this page to decide which Rabbit Relay feature to use.

It is optimized for developers and AI coding agents.

---

## Quick decisions

| Need | Use |
|---|---|
| Publish typed events | `event(...).of<T>()` + `produce()` |
| Need broker acknowledgement | `publisherConfirms: true` |
| Need request/reply | `request<TReply>()` |
| Handler can fail temporarily | `onError: "retry"` |
| Dependency outage | delayed retry with `delayMs` |
| Poison messages | DLQ |
| Replay DLQ messages | `redriveDlq()` |
| Avoid duplicate local processing | `consume({ dedupe })` |
| Limit payload size | `maxMessageBytes` |
| Add headers/correlation | `withHeaders()`, `withCorrelation()`, `traceFrom()` |
| Add local consumer behavior | `sub.use(...)` middleware |
| Add process-wide message hooks | plugins |
| Add broker operations visibility | lifecycle hooks |
| Add tracing spans | `attachOpenTelemetry()` |
| Infra owns RabbitMQ topology | `topologyMode: "passive"` |
| CI wants topology output | `topologyMode: "plan-only"` |
| Need native AMQP feature | `amqp` options or `withChannel()` |

---

## Should I use publisher confirms?

Use publisher confirms when the publisher must know RabbitMQ accepted the message.

```ts
const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    publisherConfirms: true,
  });
```

Use for:

- critical domain events
- commands
- outbox dispatchers
- workflows where lost messages are unacceptable

You may skip confirms for:

- low-value metrics
- high-volume telemetry
- disposable messages

Publisher confirms do not mean the consumer processed the message.

They only mean RabbitMQ accepted the publish.

---

## Should I use retry?

Use retry when a handler failure might be temporary.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

Use retry for:

- short database issues
- temporary network problems
- intermittent downstream failures

Do not use retry for:

- permanent validation errors
- messages with invalid schema
- bugs that always fail

Those should go to DLQ for inspection.

---

## Should I use delayed retry?

Use delayed retry when retrying immediately would make things worse.

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

Use delayed retry for:

- downstream outage
- rate limits
- external API instability
- temporary service unavailability

Rabbit Relay uses RabbitMQ TTL + DLX retry queues.

Do not use `setTimeout()` for message retry.

---

## Should I use DLQ?

Use a DLQ when failed messages matter and need inspection.

```ts
deadLetter: {
  exchange: "orders.dlx",
  queue: "orders.dlq",
  routingKey: "orders.dead",
  autoDeclare: true,
}
```

Use DLQ for:

- poison messages
- exhausted retries
- support workflows
- operational debugging

Do not treat DLQ as a normal business queue.

Monitor DLQ depth.

---

## Should I use redrive?

Use redrive after the root cause of DLQ messages is fixed.

```ts
await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 10,
});
```

Always dry-run first:

```ts
await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

Use small limits in production.

---

## Should I use RPC?

Use RPC when the caller needs a direct reply.

```ts
const reply = await pub.request<Reply>(requestEvent, {
  timeoutMs: 5000,
});
```

Good RPC use cases:

- authorization decision
- inventory check
- short calculation
- internal query

Prefer events when:

- the workflow can be asynchronous
- multiple services react
- the caller does not need an immediate answer

RPC increases coupling.

Timeouts do not cancel work already delivered to the responder.

---

## Should I use dedupe?

Use `consume({ dedupe })` to suppress duplicate deliveries inside one process.

```ts
await sub.consume({
  dedupe: {
    enabled: true,
    ttlMs: 60_000,
  },
});
```

Use for:

- local duplicate protection
- reducing repeated handler work
- demo or simple duplicate suppression

Do not rely on in-memory dedupe for correctness across:

- restarts
- multiple service instances
- long time windows

For stronger guarantees, use database constraints, Redis, idempotency keys, or outbox patterns.

---

## Should I use topologyMode assert, passive, or plan-only?

Use this table:

| Situation | Use |
|---|---|
| local development | `"assert"` |
| app creates RabbitMQ resources | `"assert"` |
| Terraform/Helm/DevOps creates resources | `"passive"` |
| CI wants topology output | `"plan-only"` |
| docs/demo without RabbitMQ topology setup | `"plan-only"` |

Examples:

```ts
new RabbitMQBroker("orders-service", {
  topologyMode: "assert",
});
```

```ts
new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

```ts
new RabbitMQBroker("topology-review", {
  topologyMode: "plan-only",
});
```

Prefer `topologyMode` over `passiveQueue`.

---

## Should I use middleware or plugins?

Use middleware for local behavior on one broker interface.

```ts
sub.use(async (ctx, next) => {
  console.log(ctx.event.name);
  await next();
});
```

Use plugins for process-wide message hooks.

```ts
pluginManager.register(loggerPlugin());
```

| Need | Use |
|---|---|
| one consumer flow | middleware |
| all messages in process | plugins |
| message lifecycle hooks | plugins |
| broker operations events | lifecycle hooks |

---

## Should I use lifecycle hooks or OpenTelemetry?

Use lifecycle hooks when you want direct custom handling.

```ts
broker.on("retry.scheduled", (event) => {
  console.log(event);
});
```

Use OpenTelemetry when you want tracing spans.

```ts
attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
});
```

OpenTelemetry is built on lifecycle hooks.

---

## Should I use `publish()` or `produce()`?

Use `produce()` for normal event publishing.

```ts
await pub.produce(orderCreated(data));
```

Use `publish()` when you need per-message options.

```ts
await pub.publish(orderCreated(data), {
  routingKey: "orders.created",
  maxMessageBytes: 64 * 1024,
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
    },
  },
});
```

Use `request<TReply>()` for RPC.

---

## Should I use native amqplib options?

Use Rabbit Relay defaults first.

Use `amqp` options when you need RabbitMQ-specific features.

```ts
await broker
  .queue("orders.q", {
    amqp: {
      queue: {
        arguments: {
          "x-queue-type": "quorum",
        },
      },
    },
  })
  .exchange("orders.ex", {
    amqp: {
      exchange: {
        alternateExchange: "orders.unrouted.ex",
      },
    },
  });
```

Use `withChannel()` when the API does not model what you need.

---

## Should I store large payloads in RabbitMQ?

Usually no.

RabbitMQ works best with reasonably small messages.

Prefer:

```text
store large payload externally
publish ID/reference in RabbitMQ
consumer fetches payload when needed
```

Use `maxMessageBytes` to enforce this.

---

## Production default recommendation

For a reliable production consumer:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
  maxMessageBytes: 256 * 1024,
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
    },
  });

await sub.consume({
  prefetch: 20,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

Use `autoDeclare: true` only when the app owns DLQ topology.

---

## Summary

- Use typed event factories by default
- Use publisher confirms for critical publishing
- Use retry + DLQ for production failure handling
- Use delayed retry for downstream outages
- Use redrive only after fixing the root cause
- Use topology modes to make ownership explicit
- Keep handlers idempotent
