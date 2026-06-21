# Acknowledgements

Acknowledgements are how a consumer tells RabbitMQ what happened to a delivered message.

This is one of the most important RabbitMQ concepts.

---

## Why acknowledgements matter

RabbitMQ delivers a message to a consumer.

The consumer processes it.

Then the consumer must tell RabbitMQ what to do with that message.

The choices are:

```text
ACK    -> processing is done
NACK   -> processing failed
REJECT -> processing failed
```

Rabbit Relay manages ACK/NACK behavior based on handler success and `consume()` options.

---

## Handler success

If the handler succeeds, Rabbit Relay acknowledges the message.

```ts
sub.handle("orders.created", async (_id, ev) => {
  await saveOrder(ev.data);
});

await sub.consume();
```

Flow:

```text
message delivered
  -> handler succeeds
  -> ACK
  -> RabbitMQ removes message from queue
```

---

## Handler failure

If the handler throws, Rabbit Relay looks at `onError`.

```ts
await sub.consume({
  onError: "retry",
});
```

The error behavior is explicit.

---

## Error behavior mapping

| Rabbit Relay option | RabbitMQ behavior | Meaning |
|---|---|---|
| `onError: "ack"` | ACK | drop the failed message |
| `onError: "requeue"` | NACK with `requeue=true` | put it back in the queue |
| `onError: "dead-letter"` | NACK with `requeue=false` | route to DLQ if configured |
| `onError: "retry"` | publish retry copy, then ACK original | bounded retry flow |

Default behavior is:

```ts
onError: "ack"
```

For production consumers, prefer bounded retry plus DLQ.

---

## ACK

ACK means:

```text
I processed this message. Remove it from the queue.
```

Rabbit Relay sends ACK when:

- the handler succeeds
- `onError: "ack"` is used after handler failure
- a retry copy is successfully published for `onError: "retry"`

---

## NACK with requeue=true

Requeue means:

```text
Processing failed. Put this message back in the queue.
```

```ts
await sub.consume({
  onError: "requeue",
});
```

Be careful.

If the error is not temporary, the message may fail forever and create a hot loop.

---

## NACK with requeue=false

Dead-lettering usually starts with:

```text
NACK requeue=false
```

```ts
await sub.consume({
  onError: "dead-letter",
});
```

If the queue has dead-letter settings, RabbitMQ routes the message to the DLQ.

If no DLQ is configured, the message may be dropped.

---

## Retry behavior

Retry is different from simple requeue.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

Flow:

```text
handler fails
  -> Rabbit Relay publishes retry copy
  -> retry headers are incremented
  -> original message is ACKed only after retry publish succeeds
```

This avoids infinite immediate requeue loops.

---

## Delayed retry

Delayed retry waits before the next attempt.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

Rabbit Relay uses RabbitMQ TTL + DLX retry queues.

It does not keep delayed messages in Node.js memory.

---

## Prefetch and unacknowledged messages

`prefetch` limits how many messages RabbitMQ can deliver without ACKs.

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

This means RabbitMQ can deliver up to 10 unacknowledged messages.

Rabbit Relay runs up to 5 handlers at once.

---

## Common mistake: infinite requeue loops

This can be dangerous:

```ts
await sub.consume({
  onError: "requeue",
});
```

If a poison message always fails, it can be redelivered forever.

Prefer this:

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

---

## Common mistake: assuming exactly once

RabbitMQ delivery is at-least-once.

A message can be delivered more than once.

Your handlers should be idempotent.

Use:

- database unique constraints
- idempotency keys
- `consume({ dedupe })` for local duplicate suppression
- transactional outbox patterns when needed

---

## Summary

- ACK removes a message from the queue
- NACK with requeue can redeliver it
- NACK without requeue can route it to a DLQ
- Rabbit Relay maps handler success/failure to ACK/NACK behavior
- Prefer retry + DLQ for production consumers
- Consumers should be idempotent
