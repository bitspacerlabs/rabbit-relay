# Exponential Backoff Retry

This example demonstrates **exponential backoff** between consumer retries:
each failed delivery waits twice as long as the previous one.

Built on the same RabbitMQ-native TTL + DLX mechanism as fixed delayed
retry — no messages are held in Node.js memory while waiting.

---

## What it shows

```text
attempt 1 fails  -> parked with TTL delayMs        (500ms)
attempt 2 fails  -> parked with TTL delayMs * 2    (1000ms)
attempt 3 fails  -> parked with TTL delayMs * 4    (2000ms)
```

This example validates:

- `retry.backoff: "exponential"`
- growing waits between attempts
- flaky job recovery
- poison job exhaustion with `then: "ack"`

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

```bash
npx tsx examples/18-exponential-backoff/consumer.ts
```

The consumer publishes its own two jobs after starting.

---

## Expected behavior

```text
[t+   22ms] flaky failure job-flaky attempt=1
[t+  108ms] poison failure job-poison attempt=1
[t+  571ms] flaky failure job-flaky attempt=2      (~500ms wait)
[t+  618ms] poison failure job-poison attempt=2
[t+ 1581ms] flaky recovered job-flaky attempt=3    (~1000ms wait)
[t+ 1626ms] poison failure job-poison attempt=3
[t+ 3634ms] poison failure job-poison attempt=4    (~2000ms wait)
[consumer] exponential backoff demo complete
```

- `job-flaky` fails twice, then recovers on attempt 3.
- `job-poison` never succeeds: it burns all retries with doubling waits,
  then the final action (`ack`) drops it.

---

## Retry configuration

```ts
await sub.consume({
  prefetch: 1,
  concurrency: 1,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 500,
    backoff: "exponential",
    then: "ack",
  },
});
```

Attempt n waits `delayMs * 2^(n-1)`. Omit `backoff` (or use `"fixed"`)
to keep every wait at `delayMs`.

---

## RabbitMQ topology

With `backoff: "exponential"`, Rabbit Relay declares **one parking
exchange/queue pair per attempt**, each with its own TTL:

```text
backoff.jobs.q.retry.a1.exchange / backoff.jobs.q.retry.a1.500.queue   (TTL 500)
backoff.jobs.q.retry.a2.exchange / backoff.jobs.q.retry.a2.1000.queue  (TTL 1000)
backoff.jobs.q.retry.a3.exchange / backoff.jobs.q.retry.a3.2000.queue  (TTL 2000)
```

Each retry queue dead-letters back to the original exchange when its TTL
expires. Topology grows with `retry.attempts`, which keeps every delay
broker-native and visible in `planTopology()` output and the CLI diff.

---

## Notes

- Immediate retry still works when `delayMs` is omitted.
- Fixed delayed retry still works when `backoff` is omitted.
- `retry.backoff` requires `retry.delayMs`.
