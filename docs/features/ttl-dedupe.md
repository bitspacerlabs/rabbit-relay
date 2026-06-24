# TTL De‑duplication

TTL de‑duplication is a consumer-side safeguard that helps suppress duplicate messages within a short time window, while keeping at-least-once delivery semantics.

Rabbit Relay supports de-duplication in two ways:

1. `consume({ dedupe })` - recommended for most consumers
2. `makeMemoryDedupe()` - lower-level helper for manual control

---

## Recommended usage

Use the `dedupe` consume option:

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 5,
  dedupe: {
    enabled: true,
    ttlMs: 60_000,
    maxKeys: 100_000,
  },
});
```

When a duplicate message is detected:

- the message is acknowledged
- the handler is skipped
- retry/DLQ behavior is not triggered

A duplicate is not treated as a processing failure.

---

## Custom dedupe key

By default, Rabbit Relay uses the event envelope ID.

You can customize the key:

```ts
await sub.consume({
  dedupe: {
    enabled: true,
    keyOf: (ev) => ev.data.orderId,
    ttlMs: 5 * 60_000,
  },
});
```

This treats repeated messages for the same order ID as duplicates within the TTL window.

---

## Disable dedupe

```ts
await sub.consume({
  dedupe: {
    enabled: false,
  },
});
```

Or simply omit `dedupe`.

---

## Using a dedupe instance

You can still create and pass your own dedupe instance.

```ts
import { makeMemoryDedupe } from "@bitspacerlabs/rabbit-relay";

const dedupe = makeMemoryDedupe({
  ttlMs: 60_000,
});

await sub.consume({
  dedupe,
});
```

---

## Manual helper usage

For advanced cases, use the helper directly.

```ts
const dedupe = makeMemoryDedupe({
  ttlMs: 5 * 60_000,
});

sub.handle("order.created", async (_id, ev) => {
  if (!dedupe.checkAndRemember(ev)) {
    return;
  }

  console.log("Process order", ev.data.orderId);
});
```

---

## Important limitations

The built-in dedupe is in-memory:

- duplicates across process restarts are not detected
- duplicates across multiple instances are not shared
- memory is bounded by TTL and `maxKeys`

For stronger guarantees, use:

- database unique constraints
- Redis or another shared store
- idempotent writes
- transactional outbox patterns

---

## Best practices

- Keep TTL short
- Use a stable key
- Prefer envelope ID for transport-level duplicates
- Use domain ID for business-level duplicates
- Do not rely on in-memory dedupe as your only correctness mechanism

---

## Summary

- `consume({ dedupe })` is the recommended API
- duplicates are acknowledged and skipped
- the built-in helper is process-local and in-memory
- handlers should still be idempotent
