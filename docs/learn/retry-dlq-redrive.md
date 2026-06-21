# Retry, DLQ, and Redrive

Production messaging needs a safe failure path.

Rabbit Relay supports the common RabbitMQ pattern:

```text
handler fails
  -> retry
  -> retry again
  -> dead-letter queue
  -> fix root cause
  -> redrive
```

---

## Why this matters

Consumers fail for many reasons:

- database timeout
- downstream API outage
- validation bug
- poison message
- temporary network issue
- bad deployment

A production consumer should not retry forever and should not silently drop important messages.

---

## Retry

Retry means processing the message again.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

This means:

```text
try the handler
if it fails, retry up to 3 times
after that, dead-letter the message
```

---

## Retry attempts

`attempts` means retry copies, not total handler executions.

```ts
retry: {
  attempts: 3,
}
```

This can result in:

```text
initial attempt + 3 retries = 4 total handler executions
```

---

## Delayed retry

Delayed retry waits before retrying.

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

Use delayed retry when a dependency may be temporarily unavailable.

Example:

```text
payment provider is down
  -> wait 5 seconds
  -> retry
  -> wait 5 seconds
  -> retry
  -> send to DLQ
```

Rabbit Relay uses RabbitMQ TTL + DLX retry queues for delayed retry.

It does not use `setTimeout()` to hold messages in Node.js memory.

---

## Retry headers

Rabbit Relay adds retry metadata to headers:

```text
x-rabbit-relay-retry-count
x-rabbit-relay-retry-delay-ms
x-rabbit-relay-first-failed-at
x-rabbit-relay-last-failed-at
x-rabbit-relay-last-error
```

Handlers can read these headers through:

```ts
ev.meta?.headers
```

Example:

```ts
sub.handle("jobs.process", async (_id, ev) => {
  const retryCount = Number(
    ev.meta?.headers?.["x-rabbit-relay-retry-count"] ?? 0
  );

  console.log("retry count", retryCount);
});
```

---

## Dead-letter queue

A dead-letter queue stores messages that could not be processed.

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
```

If a message fails after retries, it goes to the DLQ.

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

## What belongs in a DLQ?

A DLQ is for messages that need investigation.

Examples:

- poison messages
- repeated validation failures
- downstream outage that lasted too long
- messages affected by a bug
- messages that need manual support review

A DLQ is not a normal business workflow.

Monitor it.

---

## Redrive

Redrive means moving messages from a DLQ back to a target exchange after the root cause is fixed.

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

Always dry-run first.

Then redrive with a small limit:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 10,
});
```

---

## Redrive safety

Rabbit Relay redrive is conservative:

- bounded by `limit`
- supports `dryRun`
- preserves message body
- preserves AMQP properties
- adds redrive headers
- ACKs the original DLQ message only after successful republish
- requeues the original DLQ message if republish fails

---

## Redrive headers

Rabbit Relay adds:

```text
x-rabbit-relay-redrive-count
x-rabbit-relay-redriven-at
x-rabbit-relay-redriven-from-queue
x-rabbit-relay-redriven-to-exchange
x-rabbit-relay-redriven-routing-key
```

These help operators understand replay history.

---

## Recommended production flow

```text
1. Handler fails
2. Retry a bounded number of times
3. Delayed retry if dependency outage is likely
4. Send exhausted messages to DLQ
5. Alert on DLQ depth
6. Fix the root cause
7. Dry-run redrive
8. Redrive in small batches
```

---

## Common mistakes

### Infinite requeue

Avoid using `onError: "requeue"` as a retry strategy.

It can create a hot loop.

### No DLQ

If messages matter, configure a DLQ.

### Redrive before fixing the bug

If the consumer is still broken, redrive only fails again.

### Large redrive without dry-run

Always dry-run and start with a small limit.

---

## Summary

- Retry handles temporary failures
- Delayed retry protects downstream dependencies
- DLQ isolates exhausted or poison messages
- Redrive replays DLQ messages after the root cause is fixed
- Consumers must still be idempotent
