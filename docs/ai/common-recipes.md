# Common Recipes

This page gives copy-paste Rabbit Relay recipes for developers and coding agents.

::: tip Agent usage
When generating application code, prefer these recipes over inventing new patterns.
:::

---

## Publish and consume an event

::: code-group

```ts [publisher.ts]
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const broker = new RabbitMQBroker("orders.publisher");

const orderCreated = event("orders.created", "v1")
  .of<OrderCreated>();

const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true, // [!code focus]
  });

await pub.produce(
  orderCreated({
    orderId: "o-1",
    amount: 42,
  })
);

await broker.close();
```

```ts [consumer.ts]
import { RabbitMQBroker } from "@bitspacerlabs/rabbit-relay";
import type { EventEnvelope } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const broker = new RabbitMQBroker("orders.consumer");

const sub = await broker
  .queue("orders.q")
  .exchange<{
    "orders.created": EventEnvelope<OrderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*", // [!code focus]
  });

sub.handle("orders.created", async (_id, ev) => {
  console.log("order", ev.data.orderId);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

:::

---

## Publish with headers and correlation

```ts
import {
  event,
  withHeaders,
  withCorrelation,
} from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const orderCreated = event("orders.created", "v1")
  .of<OrderCreated>();

const ev = withCorrelation(
  withHeaders(
    orderCreated({
      orderId: "o-1",
      amount: 42,
    }),
    {
      tenantId: "tenant-1",
      source: "orders-service",
    }
  ),
  "corr-123"
);

await pub.produce(ev);
```

---

## Create a child event with tracing

```ts
import { event, traceFrom } from "@bitspacerlabs/rabbit-relay";

type PaymentRequested = {
  orderId: string;
  amount: number;
};

const paymentRequested = event("payments.requested", "v1")
  .of<PaymentRequested>();

sub.handle("orders.created", async (_id, ev) => {
  await payments.produce(
    paymentRequested(
      {
        orderId: ev.data.orderId,
        amount: ev.data.amount,
      },
      traceFrom(ev, { // [!code focus]
        headers: {
          source: "payments-service",
        },
      })
    )
  );
});
```

---

## Retry + DLQ consumer

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: { // [!code focus]
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });

sub.handle("orders.created", async (_id, ev) => {
  await processOrder(ev.data);
});

await sub.consume({
  prefetch: 20,
  concurrency: 5,
  onError: "retry", // [!code focus]
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

::: tip Production default
Use bounded retry followed by DLQ for production consumers.
:::

---

## Delayed retry

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000, // [!code focus]
    then: "dead-letter",
  },
});
```

::: warning Retry topology
Delayed retry uses RabbitMQ TTL + DLX retry queues. In `topologyMode: "passive"`, infrastructure must create those retry resources ahead of time.
:::

---

## RPC request/reply

::: code-group

```ts [requester.ts]
type Reply = {
  approved: boolean;
  reason?: string;
};

const reply = await pub.request<Reply>(
  paymentAuthorize({
    orderId: "o-1",
    amount: 42,
  }),
  {
    timeoutMs: 5000, // [!code focus]
  }
);
```

```ts [responder.ts]
sub.handle("payments.authorize", async (_id, ev) => {
  if (ev.data.amount > 500) {
    return {
      approved: false,
      reason: "amount over limit",
    };
  }

  return {
    approved: true,
  };
});
```

:::

::: warning Use RPC deliberately
Prefer normal events unless the caller truly needs an immediate reply.
:::

---

## Topology plan-only

```ts
const broker = new RabbitMQBroker("topology-review", {
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

Use this for CI, docs, and DevOps review.

---

## Passive topology startup

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive", // [!code focus]
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

Use this when Terraform, Helm, RabbitMQ definitions, or DevOps scripts own topology.

---

## DLQ redrive

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true, // [!code focus]
});

console.log(result);
```

::: tip Always dry-run first
Use `dryRun: true` before redriving production DLQ messages.
:::

---

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Summary

- Use event factories for typed messages
- Use `produce()` for normal publishing
- Use `publish()` for per-message AMQP options
- Use `request<TReply>()` for RPC
- Use retry + DLQ for production consumers
- Use `topologyMode: "passive"` for infra-owned topology
- Use `topologyMode: "plan-only"` for topology review
- Always close brokers in scripts and tests
