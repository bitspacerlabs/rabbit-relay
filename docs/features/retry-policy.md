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

Add `delayMs` when you want RabbitMQ to wait before retrying a failed message. This avoids hammering a dependency that is temporarily unavailable.

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

### Behavior

When a handler fails:

1. Rabbit Relay publishes a retry copy to a retry exchange
2. RabbitMQ holds it in a retry queue for `delayMs`
3. The retry queue expires the message
4. RabbitMQ dead-letters it back to the original exchange
5. The original queue receives it again
6. After max retry attempts, the final behavior is applied

### Attempts meaning

`attempts` means retry copies, not total handler executions.

```text
initial attempt + 3 retries = 4 total handler executions
```

### Retry queue naming

Rabbit Relay creates retry topology based on the consuming queue.

For queue `orders.q`, Rabbit Relay creates:

```text
orders.q.retry.exchange
orders.q.retry.<delayMs>.queue
```

For example, with `delayMs: 5000`:

```text
orders.q.retry.exchange
orders.q.retry.5000.queue
```

### Inspecting retry state

Handlers can read the retry count from headers:

```ts
sub.handle("jobs.process", async (_id, ev) => {
  const retryCount = Number(
    ev.meta?.headers?.["x-rabbit-relay-retry-count"] ?? 0
  );

  if (retryCount < 2) {
    throw new Error("temporary failure");
  }
});
```

RabbitMQ also adds `x-death` headers when messages expire from retry queues. These are copied into `event.meta.headers`.

### Changing `delayMs`

RabbitMQ queue arguments are immutable. Because the delay is part of the retry queue name, changing `delayMs` creates a different retry queue. To reset during development:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

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
