# TTL De‑duplication

TTL de‑duplication is a **consumer-side safeguard** that helps suppress duplicate messages
within a short time window, while keeping **at‑least‑once delivery** semantics.

Rabbit Relay provides a small **in-memory helper** for this purpose.
It is optional and intentionally simple.

---

## What it does

TTL de‑duplication remembers message IDs for a limited time (TTL).

If the same ID is seen again within that window:
- the message is considered a duplicate
- your handler can safely skip processing

This is a **best‑effort optimization**, not a delivery guarantee.

---

## When to use it

Use TTL de‑duplication when:
- retries or reconnects may deliver the same message again
- occasional duplicates are expected
- you want a lightweight guard without external storage

Do **not** rely on it as your only correctness mechanism.
Handlers should still be idempotent when possible.

---

## Basic usage

```ts
import { makeMemoryDedupe } from "rabbit-relay";

const dedupe = makeMemoryDedupe({
  ttlMs: 5 * 60_000, // remember IDs for 5 minutes
});
```

Use it inside a consumer handler:

```ts
sub.handle("orderCreated", async (_id, ev) => {
  if (!dedupe.checkAndRemember(ev)) {
    // duplicate within TTL → skip
    return;
  }

  // safe to process
  console.log("Process order", ev.data.id);
});
```

---

## How duplicates are detected

By default, the helper uses the **event envelope ID**.

You can customize what “duplicate” means by providing a custom key extractor:

```ts
const dedupe = makeMemoryDedupe({
  keyOf: (e) => e.data.orderId, // domain-level id
});
```

This treats repeated events for the same order as duplicates within the TTL window.

---

## Important limitations

TTL de‑duplication is **in-memory**:

- duplicates across process restarts are not detected
- duplicates across multiple instances are not shared
- memory is bounded by a soft max size

For cross-instance or long-lived guarantees, use:
- idempotent database writes
- Redis / external stores
- application-level keys

---

## Best practices

- Keep TTL short (minutes, not hours)
- Choose a stable key (envelope ID or domain ID)
- Combine with publisher confirms for better protection
- Treat de‑duplication as a guard, not a guarantee

---

## Summary

- TTL de‑duplication suppresses repeated messages within a short window
- It is consumer-side and optional
- It does not replace idempotent handlers
- Simple, explicit, and easy to reason about
