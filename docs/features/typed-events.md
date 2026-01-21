# Typed Events & Factories

Strong typing is a core idea in Rabbit Relay. You describe the **shape of your event payloads** in TypeScript, then use small **event factories** to produce envelopes that are **type-safe**, **versioned**, and **easy to work with**—for both publishers and consumers.

This page explains how to define factories, publish events (with or without helpers), consume events with typing, and apply versioning and runtime validation when needed.

---

## TL;DR

```ts
import { RabbitMQBroker, event } from "rabbit-relay";

// 1) Define the payload
type OrderCreated = {
  orderId: string;
  total: number;
};

// 2) Create the event factory (name + version + typing)
const makeOrderCreated = event("orderCreated", "v1").of<OrderCreated>();

async function produce() {
  // 3) Create a broker
  const broker = new RabbitMQBroker("orders.publisher");

  // 4) Create queue + exchange
  const pub = await broker.queue("orders.publisher.q")
    .exchange("orders.exchange", {
      exchangeType: "topic",
    });

  // 5) Publish the event
  await pub.produce(
    makeOrderCreated({
      orderId: "A-42",
      total: 99.5,
    })
  );

  console.log("OrderCreated published");
}

produce().catch(console.error);
```

---

## Event envelope (conceptual)

Rabbit Relay wraps your payload in a plain JSON envelope:

```ts
export interface EventEnvelope<T = unknown> {
  id: string;          // globally unique (idempotency key)
  name: string;        // event name / routing key
  version: string;     // e.g. "v1"
  time?: number;       // epoch ms
  data: T;             // your typed payload
  meta?: {
    headers?: Record<string, string>;
    corrId?: string;
    expectsReply?: boolean;
    timeoutMs?: number;
  };
}
```

> The envelope is a plain object (no methods), so it serializes cleanly and is easy to log and trace.

---

## Defining factories

Factories are created with `event(name, version).of<T>()`. They stamp envelope fields and enforce the payload type.

```ts
import { event } from "rabbit-relay";

type PaymentProcessed = {
  orderId: string;
  status: "paid" | "failed";
  txnId?: string;
};

export const makePaymentProcessed =
  event("paymentProcessed", "v1").of<PaymentProcessed>();
```

Use factories anywhere you need to produce events—services, jobs, or tests.

---

## Producing typed events

### Option A: Produce directly

```ts
import { RabbitMQBroker } from "rabbit-relay";
import { makePaymentProcessed } from "./events";

const broker = new RabbitMQBroker("payments_service");

const iface = await broker
  .queue("payments_publish_queue")
  .exchange("payments_exchange", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

await iface.produce(
  makePaymentProcessed({ orderId: "O-1", status: "paid", txnId: "txn_123" })
);
```

### Option B: Compose factories with `.with()` (recommended)

`.with()` creates a small, typed publish API from your factories.

```ts
import { event, RabbitMQBroker } from "rabbit-relay";

type ShippingStarted = { orderId: string; trackingId: string };
const makeShippingStarted = event("shippingStarted", "v1").of<ShippingStarted>();

const broker = new RabbitMQBroker("shipping_service");
const pub = await broker
  .queue("shipping_publish_queue")
  .exchange("shipping_exchange", { exchangeType: "topic", publisherConfirms: true });

const api = pub.with({ shippingStarted: makeShippingStarted });

await api.shippingStarted({ orderId: "O-1", trackingId: "TRACK-001" });
```

Use this style when a service **owns** a set of events and publishes them frequently.

---

## Consuming typed events

Handlers are keyed by the **event name**. The payload is typed inside the handler.

```ts
import type { EventEnvelope } from "rabbit-relay";

type OrderCreated = { orderId: string; total: number };

const sub = await broker
  .queue("orders_queue")
  .exchange<{ orderCreated: EventEnvelope<OrderCreated> }>(
    "orders_exchange",
    { exchangeType: "topic", routingKey: "#" }
  );

sub.handle("orderCreated", async (_id, ev) => {
  console.log("Order total =", ev.data.total); // number
});

await sub.consume({ prefetch: 50, concurrency: 10 });
```

> Tip: Use `sub.handle("*", ...)` for a catch-all handler.

---

## Versioning events

Versioning decouples producers and consumers.

**Rules of thumb**
- Never break an existing version’s payload.
- Backward-compatible additions are OK.
- Breaking changes → publish a new version.

```ts
const makeOrderCreatedV1 =
  event("orderCreated", "v1").of<{ orderId: string; total: number }>();

const makeOrderCreatedV2 =
  event("orderCreated", "v2").of<{ orderId: string; total: number; currency: "USD" | "EUR" }>();
```

Consumers can handle one or multiple versions as needed.

---

## Metadata & headers

You can attach metadata before producing:

```ts
const e = makePaymentProcessed({ orderId: "O-1", status: "paid" });
e.meta = {
  headers: { source: "payments", region: "eu-west-1" },
  corrId: "req-123",
};
await iface.produce(e);
```

Plugins can also inject metadata automatically.

---

## Runtime validation (optional)

TypeScript types disappear at runtime. For runtime safety, validate in plugin hooks.

```ts
import { z } from "zod";
import { event } from "rabbit-relay";

export const OrderCreatedSchema = z.object({
  orderId: z.string().min(1),
  total: z.number().nonnegative(),
});
export type OrderCreated = z.infer<typeof OrderCreatedSchema>;

export const makeOrderCreated = event("orderCreated", "v1").of<OrderCreated>();
```

---

## Naming & routing keys

By default, Rabbit Relay publishes with the **event name as the routing key**.

- Topic exchanges support patterns (e.g. `order.*`).
- Direct exchanges require an exact match.

You can also set a custom routing key on the exchange:

```ts
await broker.queue("q").exchange("ex", {
  exchangeType: "direct",
  routingKey: "my.custom.key",
});
```

---

## Factory module pattern

Group factories per domain and export a single object:

```ts
import { event } from "rabbit-relay";

export type OrderCreated = { orderId: string; total: number };
export type PaymentProcessed = { orderId: string; status: "paid" | "failed"; txnId?: string };

export const Events = {
  orderCreated: event("orderCreated", "v1").of<OrderCreated>(),
  paymentProcessed: event("paymentProcessed", "v1").of<PaymentProcessed>(),
};
```

Compose once and publish everywhere:

```ts
const api = pub.with(Events);
await api.paymentProcessed({ orderId: "O-1", status: "paid", txnId: "TXN-1" });
```

---

## FAQ

**Do I need factories?**  
Factories aren’t required, but they provide consistency, typing, and less boilerplate.

**Where should factories live?**  
In a small module per service or domain (e.g. `src/events/orders.ts`).

**How big should payloads be?**  
Prefer lean payloads (IDs + essential fields). Fetch heavy data at the consumer if needed.

**What version format should I use?**  
Versions are opaque strings. Keep it simple: `v1`, `v2`, `v3` (or `v1.1` if you need minor bumps).

---

## What you get

- **Safety**: compile-time typing with optional runtime validation
- **Clarity**: standardized envelope structure and routing
- **Ergonomics**: small helpers and a clean `.with()` API
- **Predictability**: no hidden behavior—RabbitMQ remains explicit
