# Retry Policy

Rabbit Relay supports explicit consumer retry using `onError: "retry"`.

Retries are useful for temporary failures such as network issues, short downstream outages, or transient database errors.

---

## Basic usage

```ts
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

---

## Behavior

When a handler throws:

1. Rabbit Relay checks the retry count
2. If attempts remain, it republishes the message
3. It increments retry headers
4. It acknowledges the original message only after the retry copy is published
5. After max attempts, it applies the final behavior

---

## Retry headers

Rabbit Relay stores retry metadata in message headers:

```text
x-rabbit-relay-retry-count
x-rabbit-relay-first-failed-at
x-rabbit-relay-last-failed-at
x-rabbit-relay-last-error
```

These headers help with debugging and DLQ inspection.

---

## Final behavior

Use `retry.then` to choose what happens after retries are exhausted.

```ts
retry: {
  attempts: 3,
  then: "dead-letter",
}
```

Supported values:

| Value | Behavior |
|---|---|
| `dead-letter` | `nack` with `requeue=false` |
| `requeue` | `nack` with `requeue=true` |
| `ack` | acknowledge and drop |

Default:

```ts
then: "dead-letter"
```

---

## Retry + DLQ

The recommended production setup is:

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

Combined with a DLQ:

```ts
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
```

After retries are exhausted, RabbitMQ routes the message to the DLQ.

---

## Immediate retry note

Rabbit Relay’s current retry policy is immediate retry.

This is useful for quick transient failures, but it can retry quickly if a dependency is down.

For long outages, prefer delayed retry queues. Delayed retry support can be added on top of the DLQ pattern.

---

## Best practices

- Keep retry attempts small
- Use DLQ after retries
- Make handlers idempotent
- Monitor retry and DLQ volume
- Do not use infinite requeue loops as a retry strategy

---

## Summary

- `onError: "retry"` enables explicit retry
- Retry attempts are tracked in headers
- Final behavior is configurable
- Combine retries with DLQs for production safety
