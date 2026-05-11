# EventEnvelope

`EventEnvelope` is the canonical message format used by Rabbit Relay.

All published and consumed messages use this shape.

---

## Type definition

```ts
type EventEnvelope<T = unknown> = {
  id: string;
  name: string;
  v: string;
  time: number;
  data: T;
  meta?: EventMeta;
};

type EventMeta = {
  corrId?: string;
  causationId?: string;
  headers?: Record<string, string>;

  expectsReply?: boolean;
  timeoutMs?: number;
};
```

---

## Fields

| Field | Meaning |
|---|---|
| `id` | Unique event ID. Useful for idempotency and de-duplication |
| `name` | Event name, also used as the default routing key |
| `v` | Event version, for example `v1` |
| `time` | Event creation time in epoch milliseconds |
| `data` | Typed payload |
| `meta` | Optional metadata for headers, tracing, and RPC |

---

## Creating envelopes

Use an event factory:

```ts
import { event } from "@bitspacerlabs/rabbit-relay";

const orderCreated = event("order.created", "v1").of<{
  orderId: string;
  amount: number;
}>();

const ev = orderCreated({
  orderId: "o-1",
  amount: 42,
});
```

Factories ensure:

- consistent envelope shape
- generated IDs
- consistent timestamps
- typed payloads

---

## Metadata helpers

Rabbit Relay provides helpers so you do not need to mutate `meta` manually.

### Add headers

```ts
import { withHeaders } from "@bitspacerlabs/rabbit-relay";

const ev = withHeaders(orderCreated({ orderId: "o-1", amount: 42 }), {
  tenantId: "tenant-1",
  source: "orders-service",
});
```

### Add metadata

```ts
import { withMeta } from "@bitspacerlabs/rabbit-relay";

const ev = withMeta(orderCreated({ orderId: "o-1", amount: 42 }), {
  corrId: "corr-123",
  headers: {
    tenantId: "tenant-1",
  },
});
```

### Add correlation or causation

```ts
import {
  withCorrelation,
  withCausation,
} from "@bitspacerlabs/rabbit-relay";

const ev1 = withCorrelation(orderCreated(data), "corr-123");
const ev2 = withCausation(orderCreated(data), "parent-event-id");
```

---

## Tracing child events

Use `traceFrom(parent)` when one event causes another event.

```ts
import { traceFrom } from "@bitspacerlabs/rabbit-relay";

const child = paymentRequested(
  {
    orderId: ev.data.orderId,
    amount: ev.data.amount,
  },
  traceFrom(ev)
);
```

This:

- preserves the parent `corrId`
- uses `parent.id` as `causationId`
- copies parent headers
- lets you add extra headers

```ts
const child = paymentRequested(data, traceFrom(ev, {
  headers: {
    source: "payments-service",
  },
}));
```

---

## RPC metadata

RPC is enabled through metadata internally.

You can still do this:

```ts
ev.meta = {
  expectsReply: true,
  timeoutMs: 5000,
};
```

But the cleaner API is:

```ts
const reply = await pub.request<Reply>(ev, {
  timeoutMs: 5000,
});
```

---

## Notes

- `EventEnvelope` is plain JSON
- Delivery remains at-least-once
- Consumers should be idempotent
- Keep payloads small and publish references for large data

---

## Summary

`EventEnvelope` is the stable contract between publishers and consumers.

Factories and helpers make it safer to create, enrich, trace, and publish events.
