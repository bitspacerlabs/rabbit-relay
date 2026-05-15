# Delayed Retry

Delayed retry lets Rabbit Relay wait before retrying a failed message.

This helps avoid hammering a dependency that is temporarily unavailable.

---

## Why delayed retry matters

Immediate retry is useful for very short transient errors, but it can retry too quickly when a service is down.

Delayed retry changes this:

```text
handler fails
  -> wait
  -> retry
  -> wait
  -> retry
  -> DLQ
```

Rabbit Relay implements this with RabbitMQ TTL + DLX retry queues.

It does not use `setTimeout()` and does not hold delayed messages in Node.js memory.

---

## Usage

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

---

## Behavior

When a handler fails:

1. Rabbit Relay publishes a retry copy to a retry exchange
2. RabbitMQ holds it in a retry queue for `delayMs`
3. The retry queue expires the message
4. RabbitMQ dead-letters it back to the original exchange
5. The original queue receives it again
6. After max retry attempts, final behavior is applied

---

## Attempts meaning

`attempts` means retry copies, not total handler executions.

```ts
retry: {
  attempts: 3,
  delayMs: 5000,
}
```

This can produce:

```text
initial attempt + 3 retries = 4 total handler executions
```

---

## Retry headers

Rabbit Relay adds retry metadata in AMQP headers:

```text
x-rabbit-relay-retry-count
x-rabbit-relay-retry-delay-ms
x-rabbit-relay-first-failed-at
x-rabbit-relay-last-failed-at
x-rabbit-relay-last-error
```

RabbitMQ also adds `x-death` headers when messages expire from retry queues.

Rabbit Relay copies AMQP headers into `event.meta.headers`, so handlers can inspect them.

---

## Example handler

```ts
sub.handle("jobs.process", async (_id, ev) => {
  const retryCount = Number(
    ev.meta?.headers?.["x-rabbit-relay-retry-count"] ?? 0
  );

  console.log("retry count", retryCount);

  if (retryCount < 2) {
    throw new Error("temporary failure");
  }
});
```

---

## Queue naming

Rabbit Relay creates retry topology based on the consuming queue.

For queue:

```text
orders.q
```

Rabbit Relay creates:

```text
orders.q.retry.exchange
orders.q.retry.<delayMs>.queue
```

Example:

```text
orders.q.retry.exchange
orders.q.retry.5000.queue
```

---

## Existing queue warning

RabbitMQ queue arguments are immutable.

If you change `delayMs`, Rabbit Relay will create a different retry queue name because the delay is part of the queue name.

For local testing, you can reset RabbitMQ data:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

---

## Best practices

- Use delayed retry for downstream outages
- Keep attempts bounded
- Always combine retries with DLQ
- Make handlers idempotent
- Monitor retry and DLQ volume

---

## Summary

- `retry.delayMs` enables delayed retry
- Uses RabbitMQ TTL + DLX
- Does not hold messages in Node.js memory
- Retry metadata is visible in headers
- Works with DLQ final routing
