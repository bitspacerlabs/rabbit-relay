# Typed events in Rabbit Relay: why `event(name, version).of<T>()` matters

If you've ever used raw `amqplib`, you've written code like this:

```ts
channel.publish(
  "orders.exchange",
  "order.created",
  Buffer.from(JSON.stringify({
    orderId: "O-42",
    total: 99.5,
  }))
);
```

This works, but it's fragile. Nothing stops a producer from publishing `{ id: "O-42", amount: 99.5 }` while a consumer expects `{ orderId: string; total: number }`. These mismatches only surface at runtime — in production.

Rabbit Relay's typed event factories solve this at the type level.

---

## The problem with raw payloads

A message in RabbitMQ is a binary blob (`Buffer`). Any structure you impose on it is convention, not contract. Teams end up with:

- **Inconsistent payload shapes** — some services snake_case, others camelCase
- **No version tracking** — a producer changes `userId` to `customerId`, old consumers break silently
- **Manual envelope construction everywhere** — `{ id: uuid(), name: "...", v: "v1", time: Date.now(), data: {…} }` repeated in every publisher
- **Stringly-typed event names** — `"order.created"` vs `"orderCreated"` vs `"orders.create"` depending on who wrote the code

These are not theoretical problems. Every team using raw `amqplib` across multiple services hits them within weeks.

---

## The factory pattern

Rabbit Relay's `event(name, version).of<T>()` replaces manual envelope construction with a typed factory:

```ts
import { event } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  total: number;
};

const makeOrderCreated = event("orderCreated", "v1").of<OrderCreated>();
```

This one line does three things:

1. **Fixes the event name** — `"orderCreated"` is baked into the factory, not scattered across producers
2. **Fixes the version** — `"v1"` becomes part of every envelope, so consumers know what shape to expect
3. **Typifies the payload** — `of<OrderCreated>()` ties the TypeScript type to the factory

Now publishing is safe:

```ts
await pub.produce(makeOrderCreated({ orderId: "O-42", total: 99.5 }));
//                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//   TypeScript error if you pass { id: "O-42", amount: 99.5 }
```

---

## What the envelope gives you

When you call `makeOrderCreated(data)`, Rabbit Relay builds a standard envelope:

```json
{
  "id": "a1b2c3d4-...",
  "name": "orderCreated",
  "v": "v1",
  "time": 1785294000000,
  "data": {
    "orderId": "O-42",
    "total": 99.5
  }
}
```

Every event has this shape. The `id` is a UUID, `time` is auto-stamped, `name` and `v` come from the factory. Consumers get a predictable structure to parse, log, and trace.

On the consumer side, the type flows through automatically:

```ts
sub.handle("orderCreated", async (_id, ev) => {
  console.log(ev.data.total); // TypeScript knows this is `number`
});
```

No type assertions. No `JSON.parse()` in sight.

---

## Versioning is not an afterthought

Most messaging systems treat versioning as an optional convention. You add a `"v": "1"` field manually, or you don't. When a breaking change is needed, someone updates the payload and hopes nothing breaks.

Rabbit Relay makes versioning explicit:

```ts
const makeOrderCreatedV1 = event("orderCreated", "v1").of<OrderCreated>();
const makeOrderCreatedV2 = event("orderCreated", "v2").of<OrderCreatedV2>();
```

Both versions share the same event name but carry different payload types. A consumer can handle both:

```ts
sub.handle("orderCreated", async (_id, ev) => {
  if (ev.v === "v1") {
    // handle v1 shape
  } else {
    // handle v2 shape
  }
});
```

The version travels in the envelope, so routing doesn't care about versions. Producers publish incrementally — some services on v2, others still on v1 — and the system stays up.

This is not possible with raw payloads or with schema-less message formats.

---

## The `.with()` API: factories as a service contract

When a service owns multiple events, composing factories gives you a typed publish API:

```ts
const api = pub.with({
  orderCreated: makeOrderCreated,
  paymentProcessed: makePaymentProcessed,
});

await api.orderCreated({ orderId: "O-42", total: 99.5 });
await api.paymentProcessed({ orderId: "O-42", status: "paid" });
```

The object you pass to `.with()` acts as a **service contract** — it documents every event the service publishes, with its payload type. If a factory's type changes, the `.with()` callers break at compile time.

---

## Runtime safety

TypeScript types disappear at runtime. If an upstream service publishes a malformed payload, your handler will receive garbage regardless of types.

For production systems, pair factories with runtime validation:

```ts
import { z } from "zod";
import { event } from "@bitspacerlabs/rabbit-relay";

const OrderCreatedSchema = z.object({
  orderId: z.string().min(1),
  total: z.number().nonnegative(),
});

type OrderCreated = z.infer<typeof OrderCreatedSchema>;

const makeOrderCreated = event("orderCreated", "v1").of<OrderCreated>();
```

Then validate in a plugin or middleware before processing. TypeScript catches mistakes during development; Zod catches them at the boundary in production.

---

## Event name vs routing key

One common point of confusion in RabbitMQ is the difference between an event name and a routing key. The factory pattern helps here too.

The **event name** is what happened: `"orderCreated"`, `"paymentProcessed"`. It belongs in the envelope.

The **routing key** is how RabbitMQ routes the message. By default, Rabbit Relay uses the event name as the routing key. But they don't have to match:

```ts
// Binding pattern: "order.*" — the queue wants all order events
const sub = await broker.queue("orders.q").exchange("orders.ex", {
  exchangeType: "topic",
  routingKey: "order.*",
});

// Event name: "order.created" — published with routing key "order.created"
const makeOrderCreated = event("order.created", "v1").of<OrderCreated>();
await pub.produce(makeOrderCreated({ orderId: "O-42", total: 99.5 }));
```

The factory decouples the event identity (name + version) from the routing topology. You can change your exchange structure without changing your event definitions.

---

## What you get by using typed factories

- **Compile-time safety** — payload mismatches are caught before deployment
- **Standard envelopes** — every event has `id`, `name`, `v`, `time`, `data` — predictable logging and tracing
- **Explicit versioning** — no more guessing what shape a message has
- **Service contracts** — `.with()` documents what a service publishes
- **Routing decoupling** — event names are independent of routing keys
- **Zero boilerplate** — the factory stamps `id`, `name`, `v`, and `time` automatically

Typed events are a small abstraction that eliminates an entire class of production bugs. They don't hide RabbitMQ — they make the contract between services explicit, at the type level, where the compiler enforces it.

---

*Rabbit Relay is a TypeScript-first RabbitMQ framework for Node.js. [GitHub](https://github.com/bitspacerlabs/rabbit-relay) · [Documentation](https://bitspacerlabs.github.io/rabbit-relay) · [npm](https://www.npmjs.com/package/@bitspacerlabs/rabbit-relay)*
