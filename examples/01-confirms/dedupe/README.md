# Consumer De-duplication – Basics

**What it shows:** a consumer that drops duplicate deliveries of the same logical event using an **in-memory, TTL-based de-duplication window**.

This demonstrates how to safely handle **at-least-once delivery** without doing work twice.

---

**Files**
- `consumer.dedupe.ts` – consumes events and drops duplicates by event ID
- `publisher.dupes.ts` – intentionally publishes the *same event ID twice*
- `publisher.loop.ts` *(optional)* – publishes unique events for comparison

---

**Run**
```bash
# terminal 1 – start the de-dupe consumer
npx ts-node-dev --transpile-only examples/dedupe/consumer.dedupe.ts

# terminal 2 – publish duplicate pairs (same id twice)
npx ts-node-dev --transpile-only examples/dedupe/publisher.dupes.ts

# (optional) terminal 3 – publish normal unique events
npx ts-node-dev --transpile-only examples/dedupe/publisher.loop.ts
```

---

**Expect**
- the first delivery of an event ID logs `OK`
- repeated deliveries of the same ID within the TTL log `DROP duplicate`
- messages are still ACKed (no requeue storms)
- de-duplication is **process-local** and resets on restart

---

**Environment variables**
- `DEDUPE_TTL_MS` – how long an event ID is remembered (default: 60s)
- `DEDUPE_MAX_KEYS` – max IDs kept in memory (default: 100k)
- `PREFETCH` – consumer prefetch count
- `CONCURRENCY` – parallel handler executions

---

**Production notes**

- This pattern is **production-safe for at-least-once delivery**
- De-duplication is **in-memory and per-process**
- Suitable for retry-tolerant workflows and idempotent handlers
- De-duplication state is lost on process restart

For **cross-instance**, **restart-safe**, or **exactly-once–like** guarantees,
replace the in-memory de-duplication with:
- a database unique constraint
- a Redis-backed de-duplication store
- or an outbox / transactional pattern

---

**Notes**
- This implements **consumer-side idempotency**, not exactly-once delivery
- RabbitMQ may legally deliver the same message more than once
- This example demonstrates how to handle that safely and explicitly
