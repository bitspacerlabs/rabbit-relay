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

If delayed retry is used, Rabbit Relay also adds:

```text
x-rabbit-relay-retry-delay-ms
```

These headers are copied into `event.meta.headers` for handlers and are visible in DLQ messages.

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

## Immediate retry

If `delayMs` is omitted, retries are immediate.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

Immediate retry is useful for quick transient failures.

---

## Delayed retry

Add `delayMs` when you want RabbitMQ to wait before retrying.

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

Delayed retry uses RabbitMQ TTL + DLX retry queues. Rabbit Relay does not hold delayed messages in Node.js memory.

See [Delayed Retry](/features/delayed-retry) for details.

---

## Retry + DLQ

The recommended production setup is:

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

## Best practices

- Keep retry attempts small
- Use DLQ after retries
- Use delayed retry when a dependency may be temporarily unavailable
- Make handlers idempotent
- Monitor retry and DLQ volume
- Do not use infinite requeue loops as a retry strategy

---

## Summary

- `onError: "retry"` enables explicit retry
- Retry attempts are tracked in headers
- Final behavior is configurable
- Delayed retry is supported with `delayMs`
- Combine retries with DLQs for production safety
