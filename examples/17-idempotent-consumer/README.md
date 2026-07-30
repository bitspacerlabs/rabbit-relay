# Idempotent Consumer

**What it shows:** How to handle at-least-once delivery by making
consumers idempotent using the event `id` as an idempotency key.

The consumer checks whether an event ID has been processed before running
business logic. If it has, the event is acknowledged and skipped.

This is the only reliable defence against duplicate side effects in a
distributed messaging system.

---

## Files

| File | Purpose |
|---|---|
| `publisher.ts` | Publishes order.created events, including an intentional duplicate (same event ID) |
| `consumer.idempotent.ts` | Consumes events with idempotency-check logic |

---

## Run

Start RabbitMQ first:

```bash
docker compose -f examples/docker-compose.yml up -d
```

**Terminal 1 — start the consumer:**

```bash
npx tsx examples/17-idempotent-consumer/consumer.idempotent.ts
```

**Terminal 2 — publish events:**

```bash
npx tsx examples/17-idempotent-consumer/publisher.ts
```

---

## Expect

The publisher sends 4 messages: 3 unique + 1 duplicate (same event ID).

The consumer logs:

```
Listening on queue 'idempotent.demo.q'
  ✓ PROCESS <event-id-1> ...
  ✓ PROCESS <event-id-2> ...
  ✓ PROCESS <event-id-3> ... (original)
  ↳ SKIP  <event-id-3> ... (duplicate — same id!)
  ✓ PROCESS <event-id-4> ...
```

The duplicate is acknowledged without running business logic a second time.

---

## Production notes

- **Database-backed is the only real option.** The in-memory `Set` in this
  example does not survive restarts or scale across instances.

- **Use a UNIQUE constraint** on the event ID column. This is the
  correctness mechanism — not the application-level check.

- **Wrap business logic and the processed-IDs insert in the same
  transaction.** If you insert before the business logic and crash after,
  the transaction rolls back and the message is processed fresh. If you
  insert after the business logic but the insert fails, the transaction
  rolls back and the message is processed fresh.

- **Publisher confirms** are recommended for important messages. They
  guarantee the broker accepted the message, not that a consumer
  processed it — but they reduce the window for false-positive
  duplicates caused by producer-side retries.

- **Combine with DLQ + retry.** If processing fails, the event is
  dead-lettered rather than requeued in an infinite loop. Redrive from
  the DLQ after fixing the issue.

- **Do not rely on in-memory dedupe** (`consume({ dedupe: ... })`) for
  correctness. It is a performance optimisation for noisy duplicate
  bursts within a short TTL window.
