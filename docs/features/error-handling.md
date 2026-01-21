# Error Handling & Dead-Letter Queues (DLQ)

Rabbit Relay makes error handling **explicit and predictable**.
When a consumer handler throws, you choose exactly what happens to the message.

This page focuses on **behavior and usage**, not full infrastructure setups.

---

## Error handling modes

Error behavior is configured when starting a consumer.

```ts
await sub.consume({
  onError: "ack" | "requeue" | "dead-letter",
});
```

### `ack` (default)

- The error is swallowed
- The message is acknowledged
- No retry occurs

Use when:
- handlers are idempotent
- failures are acceptable
- the event is informational (logs, metrics, signals)

---

### `requeue`

- The message is negatively acknowledged
- Requeued to the **same queue**
- May be redelivered immediately

Use when:
- failures are transient
- downstream dependencies may recover

⚠️ Be careful: this can create infinite retry loops.

---

### `dead-letter`

- The message is negatively acknowledged
- Requeue is disabled
- RabbitMQ routes the message to the queue’s **Dead‑Letter Exchange (DLX)**, if configured

Use when:
- the message is invalid or poisoned
- retries are exhausted
- failures require manual inspection

---

## Dead‑Letter Queues (DLQ)

A DLQ is a normal queue that receives messages that were rejected or expired.

Rabbit Relay does **not** create DLQs automatically.
RabbitMQ handles routing to DLQs based on **queue arguments**.

At runtime, Rabbit Relay simply:
- `ack`s on success
- `nack`s with `requeue=false` when `onError: "dead-letter"` is set

---

## Retry vs DLQ (mental model)

- **Retry** → send the message back for another attempt
- **DLQ** → park the message for later inspection

Common patterns:
- retry once or twice, then DLQ
- retry with delay (TTL), then DLQ
- DLQ immediately for validation errors

Rabbit Relay leaves retry strategy **explicitly in your control**.

---

## Recommended practices

- Prefer `dead-letter` over infinite requeue loops
- Keep handlers idempotent
- Track attempts (in memory or storage) if retries are needed
- Monitor DLQs and treat them as operational signals

---

## What Rabbit Relay does not do

Rabbit Relay intentionally does **not**:
- auto-retry forever
- guess retry delays
- manage DLQ topology
- hide RabbitMQ semantics

This keeps failure behavior visible and predictable.

---

## Summary

- Error handling is explicit and opt-in
- `ack`, `requeue`, and `dead-letter` map directly to RabbitMQ behavior
- DLQs are configured at the queue level
- Retry strategies are application-driven

Simple, explicit, and production-safe.
