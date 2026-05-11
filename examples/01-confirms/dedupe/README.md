# Consumer De-duplication – Basics

**What it shows:** consumer-side de-duplication using the Phase 2 `consume({ dedupe })` option.

---

## Run

```bash
# terminal 1
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/consumer.dedupe.ts

# terminal 2
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/publisher.dupes.ts
```

---

## Expect

- the first delivery of an event ID is processed
- repeated deliveries of the same ID within the TTL are acknowledged and skipped
- duplicate messages do not reach the handler

---

## Consumer option

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 10,
  dedupe: {
    enabled: true,
    ttlMs: 60_000,
    maxKeys: 100_000,
  },
});
```

---

## Production notes

This pattern is useful, but it is not exactly-once delivery.

For cross-instance, restart-safe, or exactly-once-like guarantees, use a database unique constraint, Redis-backed de-duplication, or an outbox pattern.
