# Delayed Retry

This example demonstrates **fixed delayed retry** using RabbitMQ TTL + DLX.

Unlike immediate retry, delayed retry waits before sending the message back to the original queue.

---

## What it shows

```text
handler fails
  -> Rabbit Relay publishes to retry exchange
  -> retry queue holds message for delayMs
  -> RabbitMQ dead-letters it back to original exchange
  -> consumer receives it again
```

This example validates:

- `retry.delayMs`
- retry headers
- delayed retry queue behavior
- flaky job recovery
- poison job final DLQ routing

---

## Files

- `consumer.retry-delayed.ts`  
  Main consumer using delayed retry.

- `consumer.dlq.ts`  
  DLQ consumer for exhausted messages.

- `publisher.ts`  
  Publishes three jobs:
  - `job-ok`
  - `job-flaky`
  - `job-poison`

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Terminal 1:

```bash
npx ts-node-dev --transpile-only examples/10-delayed-retry/consumer.retry-delayed.ts
```

Terminal 2:

```bash
npx ts-node-dev --transpile-only examples/10-delayed-retry/consumer.dlq.ts
```

Terminal 3:

```bash
npx ts-node-dev --transpile-only examples/10-delayed-retry/publisher.ts
```

---

## Expected behavior

### `job-ok`

Succeeds immediately.

```text
[consumer] handling job-ok kind=ok attempt=1
[consumer] success job-ok
```

### `job-flaky`

Fails twice, waits between retries, then succeeds.

```text
[consumer] handling job-flaky kind=flaky attempt=1
[consumer] flaky failure job-flaky attempt=1

... waits about delayMs ...

[consumer] handling job-flaky kind=flaky attempt=2
[consumer] flaky failure job-flaky attempt=2

... waits about delayMs ...

[consumer] handling job-flaky kind=flaky attempt=3
[consumer] flaky recovered job-flaky attempt=3
```

### `job-poison`

Keeps failing until retries are exhausted, then goes to DLQ.

```text
[consumer] handling job-poison kind=poison attempt=1
[consumer] poison failure job-poison attempt=1

... retries with delay ...

[dlq] exhausted message: ...
```

---

## Retry configuration

```ts
await sub.consume({
  prefetch: 5,
  concurrency: 2,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 3000,
    then: "dead-letter",
  },
});
```

Important: `attempts: 3` means **3 retry copies**.

So total handler executions can be:

```text
initial attempt + 3 retries = 4 total attempts
```

---

## RabbitMQ topology

Rabbit Relay creates delayed retry topology for the consuming queue:

```text
delayed.jobs.q.retry.exchange
delayed.jobs.q.retry.3000.queue
```

The retry queue uses:

```text
x-message-ttl = delayMs
x-dead-letter-exchange = original exchange
```

When the TTL expires, RabbitMQ routes the message back to the original exchange.

---

## Clean reset

If you change retry queue arguments such as `delayMs`, RabbitMQ may reject redeclaration of the same queue.

Reset local RabbitMQ data:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

---

## Notes

- This uses RabbitMQ-native TTL + DLX behavior.
- No messages are held in Node.js memory while waiting.
- This is safer than `setTimeout`-based retry.
- Immediate retry still works when `delayMs` is omitted.
