# Acknowledgements

RabbitMQ uses acknowledgements to know whether a delivered message has been handled successfully.

A consumer receives a message. After processing, it either acknowledges it or rejects it.

Rabbit Relay maps that behavior to handler success and explicit `onError` settings.

---

## The basic idea

```text
RabbitMQ delivers message
  -> consumer handles message
  -> consumer ACKs or NACKs
```

| Term | Meaning |
|---|---|
| `ACK` | The message was handled and RabbitMQ can remove it from the queue |
| `NACK requeue=true` | The message was rejected and should be put back on the queue |
| `NACK requeue=false` | The message was rejected and should not be requeued |
| Dead-letter | RabbitMQ routes a rejected message to a configured DLQ |

::: tip Rabbit Relay default
If a handler succeeds, Rabbit Relay ACKs the message.
If a handler throws, Rabbit Relay follows the `onError` policy.
:::

---

## Rabbit Relay mapping

| Rabbit Relay behavior | RabbitMQ behavior |
|---|---|
| handler succeeds | `ACK` |
| `onError: "ack"` | `ACK` even after handler error |
| `onError: "requeue"` | `NACK requeue=true` |
| `onError: "dead-letter"` | `NACK requeue=false` |
| `onError: "retry"` | publish retry copy, then `ACK` original |

```ts
await sub.consume({
  onError: "retry", // [!code focus]
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Handler success

When the handler completes successfully, Rabbit Relay acknowledges the message.

```ts
sub.handle("orders.created", async (_id, ev) => {
  await saveOrder(ev.data);
});
```

```text
handler succeeds -> ACK -> message removed from queue
```

---

## Handler failure with `ack`

```ts
await sub.consume({
  onError: "ack",
});
```

Behavior:

```text
handler throws -> ACK -> message removed from queue
```

Use this for non-critical messages where failure should not block the queue.

::: warning Data loss risk
`onError: "ack"` drops failed messages. Use it only when that is acceptable.
:::

---

## Handler failure with `requeue`

```ts
await sub.consume({
  onError: "requeue",
});
```

Behavior:

```text
handler throws -> NACK requeue=true -> RabbitMQ can redeliver immediately
```

::: danger Infinite loop risk
Do not use `requeue` as your main retry strategy. If the error is not transient, the same message can be delivered repeatedly forever.
:::

---

## Handler failure with `dead-letter`

```ts
await sub.consume({
  onError: "dead-letter",
});
```

Behavior:

```text
handler throws -> NACK requeue=false -> RabbitMQ routes to DLQ
```

This is useful for poison messages, validation failures, and messages that need inspection.

---

## Handler failure with `retry`

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

Behavior:

```text
handler throws
  -> Rabbit Relay publishes retry copy
  -> original message is ACKed after republish succeeds
  -> retry copy is delivered later
  -> after attempts are exhausted, final behavior runs
```

::: tip Production default
For production consumers, prefer bounded retry followed by DLQ.
:::

---

## Why Rabbit Relay ACKs the original after retry publish

When retry is enabled, Rabbit Relay does not leave the original message unacked forever.

Instead:

1. It republishes a retry copy with retry headers
2. It ACKs the original only after the retry copy is published
3. RabbitMQ later delivers the retry copy

This avoids infinite immediate redelivery loops and keeps retry metadata explicit.

---

## At-least-once delivery

RabbitMQ delivery remains at-least-once.

A message can be delivered more than once if:

- a consumer crashes before ACK
- the connection drops during processing
- a retry or redrive publishes another copy
- a publisher retries after an uncertain failure

::: warning Design handlers to be idempotent
Use stable IDs, unique constraints, de-duplication, or idempotent writes where duplicate processing would be harmful.
:::

---

## Summary

- ACK means RabbitMQ can remove the message
- NACK with requeue puts the message back
- NACK without requeue sends it to DLQ when configured
- Rabbit Relay maps handler success/failure to explicit `onError` behavior
- Prefer retry + DLQ for production consumers
