# Headers & Tracing

Rabbit Relay provides small helpers for adding metadata, headers, correlation IDs, and causation IDs to events.

These helpers keep event code clean and avoid repetitive manual `meta` mutation.

---

## Why metadata matters

In event-driven systems, a single business action often creates multiple events.

Example:

```text
order.created
  -> payment.requested
  -> payment.processed
  -> shipping.started
```

To debug this flow, events should share a correlation ID.

Each child event should also point to the event that caused it.

---

## Event metadata

Rabbit Relay event metadata supports:

```ts
type EventMeta = {
  corrId?: string;
  causationId?: string;
  headers?: Record<string, string>;
  expectsReply?: boolean;
  timeoutMs?: number;
};
```

---

## Add headers

```ts
import { withHeaders } from "@bitspacerlabs/rabbit-relay";

const ev = withHeaders(orderCreated(data), {
  tenantId: "tenant-1",
  source: "orders-service",
});
```

Headers are also copied into AMQP publish headers.

---

## Add metadata

```ts
import { withMeta } from "@bitspacerlabs/rabbit-relay";

const ev = withMeta(orderCreated(data), {
  corrId: "corr-123",
  headers: {
    tenantId: "tenant-1",
  },
});
```

`withMeta()` preserves existing metadata and merges headers.

---

## Correlation and causation helpers

```ts
import {
  withCorrelation,
  withCausation,
} from "@bitspacerlabs/rabbit-relay";

const ev = withCorrelation(orderCreated(data), "corr-123");

const child = withCausation(paymentRequested(data), ev.id);
```

---

## Trace from parent event

Use `traceFrom()` when creating a child event from a parent event.

```ts
import { traceFrom } from "@bitspacerlabs/rabbit-relay";

sub.handle("order.created", async (_id, ev) => {
  await pub.produce(
    paymentRequested(
      {
        orderId: ev.data.orderId,
        amount: ev.data.amount,
      },
      traceFrom(ev)
    )
  );
});
```

`traceFrom(parent)`:

- preserves `parent.meta.corrId` if present
- otherwise uses `parent.id` as the correlation ID
- sets `causationId` to `parent.id`
- copies parent headers

---

## Add extra metadata while tracing

```ts
const child = paymentRequested(
  data,
  traceFrom(parent, {
    headers: {
      source: "payments-service",
    },
  })
);
```

Parent headers and child headers are merged.

---

## Recommended usage

At the start of a flow:

```ts
const ev = withCorrelation(
  withHeaders(orderCreated(data), {
    tenantId: "tenant-1",
    source: "orders-service",
  }),
  "corr-123"
);
```

Inside consumers:

```ts
const next = paymentRequested(data, traceFrom(ev));
```

---

## Relationship with plugins

Plugins are still useful for process-wide tracing behavior.

Helpers are useful when you want explicit metadata in application code.

They work well together.

---

## Summary

- Use `withHeaders()` for application headers
- Use `withMeta()` for full metadata control
- Use `withCorrelation()` for root correlation
- Use `traceFrom()` for child events
- Correlation and causation make event chains easier to debug
