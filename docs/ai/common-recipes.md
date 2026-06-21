# Common Recipes

This page gives copy-paste Rabbit Relay recipes.

Use these as starting points for applications and AI-generated code.

---

## Publish an event

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const broker = new RabbitMQBroker("orders.publisher");

const orderCreated = event("orders.created", "v1").of<OrderCreated>();

const pub = await broker
  .queue("orders.publisher.q")
  .exchange<{
    "orders.created": ReturnType<typeof orderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

await pub.produce(
  orderCreated({
    orderId: "o-1",
    amount: 42,
  })
);

await broker.close();
```

---

## Consume an event

```ts
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
    routingKey: "orders.*",
  });

sub.handle("orders.created", async (_id, ev) => {
  console.log("order", ev.data.orderId);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

---

## Publish with headers

```ts
import {
  RabbitMQBroker,
  event,
  withHeaders,
  withCorrelation,
} from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const orderCreated = event("orders.created", "v1").of<OrderCreated>();

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

sub.handle("orders.created", async (_id, ev) => {
  await payments.produce(
    paymentRequested(
      {
        orderId: ev.data.orderId,
        amount: ev.data.amount,
      },
      traceFrom(ev, {
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
    deadLetter: {
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
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Delayed retry consumer

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

Use delayed retry for temporary downstream outages.

---

## RPC request

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

type ChargeRequest = {
  orderId: string;
  amount: number;
};

type ChargeReply = {
  ok: boolean;
  transactionId?: string;
  reason?: string;
};

const charge = event("payments.charge", "v1").of<ChargeRequest>();

const reply = await pub.request<ChargeReply>(
  charge({
    orderId: "o-1",
    amount: 42,
  }),
  {
    timeoutMs: 5000,
  }
);

console.log(reply);
```

---

## RPC responder

```ts
import type { EventEnvelope } from "@bitspacerlabs/rabbit-relay";

type ChargeRequest = {
  orderId: string;
  amount: number;
};

type ChargeReply = {
  ok: boolean;
  transactionId?: string;
  reason?: string;
};

const sub = await broker
  .queue("payments.rpc.q")
  .exchange<{
    "payments.charge": EventEnvelope<ChargeRequest>;
  }>("payments.rpc.ex", {
    exchangeType: "topic",
    routingKey: "payments.charge",
  });

sub.handle("payments.charge", async (_id, ev): Promise<ChargeReply> => {
  if (ev.data.amount <= 0) {
    return {
      ok: false,
      reason: "invalid amount",
    };
  }

  return {
    ok: true,
    transactionId: `txn_${Date.now()}`,
  };
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

---

## Topology plan-only

```ts
const broker = new RabbitMQBroker("topology-review", {
  topologyMode: "plan-only",
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
      autoDeclare: true,
    },
  });

console.log(JSON.stringify(sub.planTopology(), null, 2));
console.log(JSON.stringify(broker.planTopology(), null, 2));
```

This does not require RabbitMQ topology setup calls.

---

## Passive topology startup

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

Use this when Terraform, Helm, RabbitMQ definitions, or DevOps scripts create topology.

---

## Validate topology

```ts
const result = await broker.validateTopology();

if (!result.valid) {
  console.error(result.issues);
  throw new Error("RabbitMQ topology is not ready");
}
```

`binding_not_validated` issues are informational.

---

## DLQ redrive dry-run

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});

console.log(result);
```

---

## DLQ redrive

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 10,
});

console.log(result);
```

Start small and monitor the consumer.

---

## Health endpoint

```ts
app.get("/health/rabbitmq", async (_req, res) => {
  const health = await broker.health();

  if (!health.connected || !health.channelOpen || health.reconnecting) {
    return res.status(503).json(health);
  }

  return res.json(health);
});
```

---

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Message size guard

```ts
const broker = new RabbitMQBroker("orders-service", {
  maxMessageBytes: 256 * 1024,
});

await pub.publish(orderCreated(data), {
  maxMessageBytes: 64 * 1024,
});
```

If the event is too large, Rabbit Relay throws `MessageTooLargeError`.

---

## OpenTelemetry adapter

```ts
import {
  RabbitMQBroker,
  attachOpenTelemetry,
} from "@bitspacerlabs/rabbit-relay";
import { trace } from "@opentelemetry/api";

const broker = new RabbitMQBroker("orders-service");

const otel = attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "orders-service",
});

// later
otel.detach();
```

---

## Raw channel access

```ts
await broker.withChannel(async (channel) => {
  const info = await channel.checkQueue("orders.q");
  console.log(info.messageCount);
});
```

Use this for advanced `amqplib` operations.
