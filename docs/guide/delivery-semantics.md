# Delivery Semantics

RabbitMQ delivers messages with **at-least-once** guarantees. This document
explains exactly what that means in Rabbit Relay: when ACKs happen, what
survives a crash, when duplicates can appear, and how to build safe handlers.

---

## When a message is acknowledged

A message is ACKed (acknowledged) only after the **handler and all
middleware complete without throwing**.

```ts
sub.handle("orders.created", async (_id, event) => {
  await processOrder(event.data); // if this throws → not ACKed
});
```

If the handler throws:
- The `onError` policy fires (`"ack"`, `"requeue"`, `"dead-letter"`, or `"retry"`).
- The message is **not** silently dropped unless `onError: "ack"`.

### Schema validation failure

If the event has a registered schema and `payload.data` fails validation,
the handler is **never called**. The `invalidMessage` policy determines
what happens:

- `"dead-letter"` (default) — nack without requeue → DLQ or discard
- `"requeue"` — nack with requeue (dangerous: loops forever)
- `"ack"` — discard silently
- custom async function — you own the decision

The default assumes validation failures are bugs that should be quarantined,
not retried.

### Parse failure

If the raw AMQP content is not valid JSON, the `onError` policy decides
the outcome — same as handler errors, but the message is never hydrated
into an `EventEnvelope`.

### Duplicate suppression

If consumer-side deduplication is enabled and the message was already seen
within the TTL window, the message is ACKed and skipped. This is a
**best-effort** optimization, not a correctness mechanism (see
[Duplicates](#when-duplicates-can-occur)).

---

## What happens when the handler throws

| `onError` | Behavior |
|---|---|
| `"ack"` (default) | ACK the message anyway. **You lose the event.** |
| `"requeue"` | NACK + requeue. Message is redelivered immediately. **Dangerous: infinite loop.** |
| `"dead-letter"` | NACK without requeue. Message is dead-lettered (or dropped if no DLQ). |
| `"retry"` | Republish the message, then ACK the original. See [Retries](#how-retries-affect-ordering). |

When `onError: "retry"` exhausts all attempts, the `retry.then` action
applies:

| `retry.then` | Behavior |
|---|---|
| `"dead-letter"` (default) | NACK without requeue → DLQ |
| `"requeue"` | NACK with requeue |
| `"ack"` | ACK the message (silently discard) |

### Non-Error throws

If a handler throws a non-`Error` value (e.g., a string, `null`, or an
object), Rabbit Relay normalises it: the error message is extracted via
`String()`, and the retry/DLQ mechanism works the same. The `lastError`
header on retried messages is truncated to 500 characters.

---

## What happens when the process crashes

Crash scenarios and their effects:

### Crash before ACK

If the process terminates **after** commiting side effects but **before**
RabbitMQ receives the ACK:

```
┌──────────┐     ┌──────────┐     ┌────────────┐
│ Deliver  │────>│ Handler  │────>│ Write DB   │
└──────────┘     └──────────┘     └──────┬─────┘
                                         │
                                   process crashes
                                         │
                                    ACK never sent
                                         ▼
                              Message redelivered
```

The message is redelivered to another consumer (or the same one after
reconnect). This is the core at-least-once property: **you will see the
message again**.

### Crash during retry

If the process crashes after the retry copy is published but before the
ACK of the original message:

```
┌────────────┐     ┌────────────────┐     ┌──────────┐
│ Handler    │────>│ Publish retry  │────>│ ACK      │
│ throws     │     │ copy           │     │ original │
└────────────┘     └───────┬────────┘     └────▲─────┘
                           │                   │
                     process crashes      retry is lost
                           │                   │
                           ▼                   ▼
                  Original remains      Duplicate possible
                  unacked →             when consumer
                  redelivered           reconnects
```

Two messages now exist: the **original** (redelivered) and the **retry
copy** (already published). The handler must be idempotent.

### Crash during shutdown

When `consumer.stop()` is called, pending (not yet processed) messages are
NACKed with requeue, so they reappear after reconnect. In-flight messages
arriving during stop are also NACKed with requeue.

### Crash during DLQ redrive

The `redriveDlq()` method ACKs the DLQ message only **after** the
republish succeeds. If the process crashes between republish and ACK, the
DLQ message is redelivered on reconnect. **DLQ redrive is at-least-once.**

---

## When duplicates can occur

| Scenario | Duplicate possible? | Why |
|---|---|---|
| Handler crash after side effect | Yes | Side effect committed, ACK never sent |
| Retry publish before ACK | Yes | Retry copy delivered, original redelivered |
| Network interruption during ACK | Yes | AMQP ACK may or may not have reached broker |
| Consumer reconnect with unacked messages | Yes | Broker redelivers unacked messages |
| Publisher confirm timeout with actual delivery | Yes | Publish may have succeeded despite timeout |
| DLQ redrive crash | Yes | Message republished, original DLQ ACK lost |
| Multiple consumers of same queue | Yes | Standard competitive consumption |
| Delayed retry | Yes | Original + retry copy coexist briefly |

Duplicates are **normal** in at-least-once messaging. The only reliable
defence is **idempotent handlers**.

### In-memory deduplication

Rabbit Relay includes a lightweight in-memory dedupe utility:

```ts
await sub.consume({
  dedupe: { ttlMs: 60000 },
});
```

This suppresses duplicates within the TTL window using the event `id`.
It is **process-local** and does not survive restarts. Use it as a
performance optimisation, not a correctness mechanism. For robust
deduplication, use a database unique constraint or an idempotency key.

---

## Publisher confirms

Publisher confirms tell you that RabbitMQ's broker has **accepted
responsibility** for the message — not that a consumer has processed it.

```ts
await pub.produce(event(data));
```

When `publisherConfirms: true`:
- The `produce()` promise resolves after the broker confirms.
- If the broker NACKs (e.g., internal error before persistence) or the
  confirm times out, the promise rejects.

### What confirms guarantee

| Statement | True? |
|---|---|
| Message reached the broker | Yes |
| Message was persisted (durable queue) | Yes, after confirm |
| Message was routed to a queue | Only if `mandatory` is used |
| Consumer processed the message | No |
| Message will not be lost after broker restart | Only if queue + message are durable |
| Publish succeeded despite timeout | No — timeout may mask a successful confirm |

### Without confirms

If `publisherConfirms: false` (default), the `produce()` promise resolves
as soon as the message is written to the socket buffer. A crash before the
broker processes it **loses the message**. The AMQP `basic.return` for
unroutable mandatory messages is still handled.

### Backpressure

When confirms are enabled and the broker is slow, the Node.js socket
buffer fills. Rabbit Relay waits for the `'drain'` event before publishing
more. This provides **bounded backpressure** — the `produce()` promise
does not resolve until the buffer drains and the broker confirms.

---

## How retries affect ordering

### Immediate retry

The retry copy is republished to the **same exchange with the same routing
key**. It arrives at the front of the queue (new publish), so ordering
with respect to other messages is **not preserved**.

```
Queue: [B] [A]     A fails, retry published
Queue: [A'] [B] [A]   ← A' is a new message at the front
```

### Delayed retry (TTL + DLX)

The retry copy is published to a dedicated retry queue with a TTL. After
the TTL expires, RabbitMQ dead-letters it back to the original exchange.
The message arrives **after** the delay, but ordering relative to other
retries is preserved per original routing key.

```
Retry queue (ttl=5000): [A'] [B']
       ↓ after 5s
Original exchange → Queue: [A'] [B']   ← same order as published
```

### What retry does NOT guarantee

- The retry copy is a **new delivery** with a new delivery tag, new
  `redelivered` flag, and new `id` in the AMQP sense (though the
  application-level `event.id` and retry headers are preserved).
- Other messages published after the failure may be consumed before the
  retried message.
- Delayed retries slow down the consumer for that specific routing key,
  but the consumer can still process unrelated events concurrently.

---

## How DLQ redrive affects message identity

When you redrive a message from a DLQ:

```ts
await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
});
```

1. The DLQ message is republished to the target exchange/routing key.
2. Only after the republish succeeds is the DLQ message ACKed.
3. The republished message is a **new AMQP delivery** — it gets a new
   delivery tag, new message ID (AMQP-level), and is marked as not
   redelivered.
4. The application-level `event.id`, headers, and correlation/causation
   IDs are **preserved**.

Redrived messages are **not duplicates** of the original — they are the
same application-level event sent again. If the original handler was not
idempotent, the redrived message will cause duplicate side effects.

### Dry-run safety

Always dry-run before redriving production DLQs:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  dryRun: true,
});
```

The dry-run shows how many messages would be redriven without actually
moving them.

---

## Summary

| Situation | Outcome |
|---|---|
| Handler succeeds | ACK sent, message consumed once |
| Handler throws, `onError: "ack"` | ACK sent, message lost |
| Handler throws, `onError: "requeue"` | NACK + requeue, redelivered (loop risk) |
| Handler throws, `onError: "dead-letter"` | NACK without requeue, dead-lettered |
| Handler throws, `onError: "retry"` | Republished, original ACKed (bounded attempts) |
| Schema validation fails | `invalidMessage` policy decides |
| Process crashes before ACK | Redelivered on reconnect |
| Process crashes during retry | Original + retry copy may coexist |
| Publisher confirm succeeds | Broker accepted the message |
| Publisher confirm fails/throws | Message may or may not have been accepted |
| DLQ redrive succeeds | Message republished, DLQ ACKed |
| DLQ redrive crashes | DLQ message redelivered |

### The one rule

**Design every handler as if it will receive every message twice.** Use
idempotency keys, database unique constraints, or idempotent business
operations (e.g., `INSERT ... ON CONFLICT DO NOTHING`, `UPDATE ... WHERE
status = 'pending'`).
