# Error Handling

Rabbit Relay makes consumer failure behavior explicit.

When a handler throws, you choose what happens to the message.

---

## Error modes

```ts
await sub.consume({
  onError: "ack" | "requeue" | "dead-letter" | "retry",
});
```

---

## `ack` default

```ts
await sub.consume({
  onError: "ack",
});
```

Behavior:

- handler errors are logged
- message is acknowledged
- no retry occurs

Use for non-critical events, logs, metrics, or handlers where failure should not block the queue.

---

## `requeue`

```ts
await sub.consume({
  onError: "requeue",
});
```

Behavior:

- message is negatively acknowledged
- message is requeued
- RabbitMQ may redeliver it immediately

Use carefully. This can create infinite loops if the error is not transient.

---

## `dead-letter`

```ts
await sub.consume({
  onError: "dead-letter",
});
```

Behavior:

- message is negatively acknowledged
- requeue is disabled
- RabbitMQ routes the message to the configured DLQ

Use for poison messages, validation errors, and failures that need inspection.

---

## `retry`

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

Behavior:

- Rabbit Relay republishes the message for another attempt
- retry metadata is stored in headers
- after max attempts, the final behavior is applied

Common final behavior:

```ts
then: "dead-letter"
```

---

## Recommended production pattern

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });

await sub.consume({
  prefetch: 20,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

This gives you:

- bounded retries
- no infinite requeue loop
- failed messages isolated in a DLQ
- visible retry metadata

---

## Summary

- `ack` drops failed messages
- `requeue` sends them back immediately
- `dead-letter` parks them in a DLQ
- `retry` retries a bounded number of times
- Prefer retry + DLQ for production consumers
