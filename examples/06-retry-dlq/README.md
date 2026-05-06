# Retry + DLQ

**What it shows:** bounded consumer retries followed by dead-lettering.

This example demonstrates the production pattern:

```text
handler fails -> retry a few times -> send to DLQ
```

---

## Files

- `publisher.ts`  
  Publishes normal, flaky, and poison jobs.

- `consumer.retry.ts`  
  Processes jobs with `onError: "retry"` and `retry.attempts`.

- `consumer.dlq.ts`  
  Reads messages that exhausted retries.

---

## Topology

```text
retry.jobs.exchange -> retry.jobs.queue
retry.jobs.dlx      -> retry.jobs.dlq
```

---

## Run

```bash
# terminal 1 – start retry consumer
npx ts-node-dev --transpile-only examples/06-retry-dlq/consumer.retry.ts

# terminal 2 – start DLQ consumer
npx ts-node-dev --transpile-only examples/06-retry-dlq/consumer.dlq.ts

# terminal 3 – publish jobs
npx ts-node-dev --transpile-only examples/06-retry-dlq/publisher.ts
```

---

## Expected behavior

- `job-ok` succeeds immediately
- `job-flaky` fails once or twice, then succeeds
- `job-poison` fails every time and is sent to DLQ

Retry metadata is stored in headers:

```text
x-rabbit-relay-retry-count
x-rabbit-relay-first-failed-at
x-rabbit-relay-last-failed-at
x-rabbit-relay-last-error
```

---

## Consumer configuration

```ts
await sub.consume({
  prefetch: 5,
  concurrency: 2,
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Important note

Current retry behavior is immediate retry.

This is good for quick transient failures. For long downstream outages, delayed retry queues are usually better.

---

## Production takeaways

- Avoid infinite requeue loops
- Keep retry attempts bounded
- Use DLQ after retries
- Make handlers idempotent
- Monitor DLQ depth and retry volume
