# AI Agent Guide

This page is for AI assistants and coding agents generating Rabbit Relay code.

Use it as the default behavior guide.

---

## Main rule

Rabbit Relay keeps RabbitMQ concepts explicit.

Do not hide:

- exchange names
- queue names
- routing keys
- acknowledgement behavior
- retry/DLQ behavior
- topology ownership

Generate code that teaches the developer what is happening.

---

## Preferred imports

```ts
import {
  RabbitMQBroker,
  event,
  withHeaders,
  withMeta,
  withCorrelation,
  withCausation,
  traceFrom,
} from "@bitspacerlabs/rabbit-relay";

import type { EventEnvelope } from "@bitspacerlabs/rabbit-relay";
```

Use named imports from the package root.

---

## Event factories

Always prefer event factories.

```ts
const orderCreated = event("orders.created", "v1").of<{
  orderId: string;
  amount: number;
}>();
```

Avoid manually constructing envelopes unless the user specifically asks.

Good:

```ts
await pub.produce(orderCreated(data));
```

Avoid:

```ts
await pub.produce({
  id: "...",
  name: "orders.created",
  v: "v1",
  time: Date.now(),
  data,
});
```

---

## Typed consumers

Use `EventEnvelope<T>` in the exchange type map.

```ts
type OrderCreated = {
  orderId: string;
  amount: number;
};

const sub = await broker
  .queue("orders.q")
  .exchange<{
    "orders.created": EventEnvelope<OrderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

sub.handle("orders.created", async (_id, ev) => {
  console.log(ev.data.orderId);
});
```

Avoid `any` unless the example is intentionally catch-all.

---

## Publishing

Always `await` publish calls.

Good:

```ts
await pub.produce(orderCreated(data));
```

Avoid:

```ts
pub.produce(orderCreated(data));
```

Use `publisherConfirms: true` for important messages.

```ts
const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });
```

Explain that publisher confirms acknowledge broker acceptance, not consumer success.

---

## Consuming

Use explicit `prefetch` and `concurrency` for production examples.

```ts
await sub.consume({
  prefetch: 20,
  concurrency: 5,
});
```

For strict ordering or simple demos:

```ts
await sub.consume({
  prefetch: 1,
  concurrency: 1,
});
```

---

## Error handling

For production consumers, prefer retry + DLQ.

```ts
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

Avoid using `onError: "requeue"` as a retry strategy unless the user explicitly asks.

Explain that infinite requeue loops are dangerous.

---

## Dead-letter queues

Use the `deadLetter` helper instead of manual queue arguments when possible.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });
```

For infrastructure-owned topology, mention `topologyMode: "passive"` and pre-created DLX/DLQ.

---

## Delayed retry

Use delayed retry for downstream outages.

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

Explain that Rabbit Relay uses RabbitMQ TTL + DLX retry queues.

Do not suggest `setTimeout()` for retrying messages.

---

## RPC

Use `request<TReply>()` for request/reply.

```ts
type ChargeReply = {
  ok: boolean;
  transactionId?: string;
  reason?: string;
};

const reply = await pub.request<ChargeReply>(
  chargeRequest(data),
  {
    timeoutMs: 5000,
  }
);
```

Do not recommend manually setting `meta.expectsReply` for new code unless explaining backward compatibility.

Mention that timeouts do not cancel work already delivered to a responder.

---

## Metadata and tracing

Use helpers:

```ts
withHeaders(event, headers)
withCorrelation(event, corrId)
withCausation(event, causationId)
traceFrom(parentEvent)
```

For child events, prefer:

```ts
await pub.produce(
  paymentRequested(data, traceFrom(parentEvent))
);
```

---

## Topology modes

Use `topologyMode` to express ownership.

```ts
topologyMode: "assert"
topologyMode: "passive"
topologyMode: "plan-only"
```

Recommendations:

| Situation | Use |
|---|---|
| local development | `"assert"` |
| app owns topology | `"assert"` |
| infrastructure owns topology | `"passive"` |
| CI/docs/topology review | `"plan-only"` |

Do not use `passiveQueue` in new examples unless documenting compatibility.

---

## Topology planning

For topology output without RabbitMQ setup calls:

```ts
const broker = new RabbitMQBroker("topology-review", {
  topologyMode: "plan-only",
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(sub.planTopology());
```

---

## Topology validation

For infrastructure-owned topology:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Use `validateTopology()` when you want an explicit result object.

```ts
const result = await broker.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

Remember: binding validation is informational because AMQP does not expose a simple safe binding check through `amqplib`.

---

## DLQ redrive

Always dry-run first.

```ts
const dryRun = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

Then redrive with a small limit.

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 10,
});
```

---

## Message size

For large payloads, use external storage and publish a reference.

Use `maxMessageBytes` to catch mistakes.

```ts
const broker = new RabbitMQBroker("orders-service", {
  maxMessageBytes: 256 * 1024,
});
```

---

## Shutdown

In scripts and tests, close the broker.

```ts
await broker.close();
```

In services:

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Avoid generating

Avoid these patterns unless the user explicitly asks:

- manual event envelope construction
- unbounded requeue loops
- `any` in typed examples
- fire-and-forget `produce()` without `await`
- `setTimeout()` for message retry
- new code using `passiveQueue` instead of `topologyMode`
- hiding RabbitMQ topology behind unclear wrappers
- huge payload examples without `maxMessageBytes` warning
- claiming exactly-once delivery

---

## Standard production template

```ts
import {
  RabbitMQBroker,
  event,
  traceFrom,
} from "@bitspacerlabs/rabbit-relay";
import type { EventEnvelope } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

type PaymentRequested = {
  orderId: string;
  amount: number;
};

const paymentRequested = event("payments.requested", "v1")
  .of<PaymentRequested>();

const broker = new RabbitMQBroker("payments-service", {
  topologyMode: "assert",
  maxMessageBytes: 256 * 1024,
});

const orders = await broker
  .queue("payments.orders.q")
  .exchange<{
    "orders.created": EventEnvelope<OrderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: {
      exchange: "payments.dlx",
      queue: "payments.dlq",
      routingKey: "payments.dead",
      autoDeclare: true,
    },
  });

const payments = await broker
  .queue("payments.publisher.q")
  .exchange<{
    "payments.requested": EventEnvelope<PaymentRequested>;
  }>("payments.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

orders.handle("orders.created", async (_id, ev) => {
  await payments.produce(
    paymentRequested(
      {
        orderId: ev.data.orderId,
        amount: ev.data.amount,
      },
      traceFrom(ev)
    )
  );
});

await orders.consume({
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
