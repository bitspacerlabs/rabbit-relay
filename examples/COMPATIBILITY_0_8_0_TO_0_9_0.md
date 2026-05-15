# Compatibility Check: 0.8.0 -> 0.9.0

Use this checklist to make sure existing Rabbit Relay `0.8.0` users can upgrade to `0.9.0` without changing their code.

---

## Goal

Rabbit Relay `0.9.0` adds operations features while keeping existing `0.8.0` usage valid.

These existing APIs should still work:

- `produce()`
- `produceMany()`
- `publish(event, options)`
- `request<TReply>()`
- `consume()`
- `consume({ prefetch, concurrency })`
- `consume({ onError: "retry" })`
- immediate retry without `delayMs`
- `.with({ eventFactory })`
- `publisherConfirms`
- RPC using `meta.expectsReply`
- plugins
- middleware
- metadata helpers
- TTL dedupe
- message size guard
- native `amqplib` passthrough options
- `withChannel()`
- `broker.health()`
- `broker.close()`
- manual `queueArgs`
- built-in `deadLetter` helper

---

## New in 0.9.0

`0.9.0` adds:

- lifecycle hooks
- OpenTelemetry lifecycle adapter
- topology planner
- topology validation mode
- DLQ redrive helper
- fixed delayed retry with `retry.delayMs`

These are additive features.

Existing users do not need to change their code unless they want to use the new APIs.

---

## Before testing

Start clean:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
npm run build
```

---

## 1. Package usage

Run:

```bash
npm run test:package
```

Expected:

- ESM import works
- CommonJS require works
- TypeScript consumer API types compile
- operations exports are available
- old and new public APIs are type-safe

---

## 2. Developer Experience APIs from 0.8.0

Run consumer:

```bash
npx ts-node-dev --transpile-only examples/09-developer-experience/consumer.ts
```

Run publisher:

```bash
npx ts-node-dev --transpile-only examples/09-developer-experience/publisher.ts
```

Expected:

- middleware logs appear
- metadata helpers work
- correlation/tracing metadata works
- duplicate message is skipped
- typed RPC reply is received
- message size guard throws `MessageTooLargeError`

---

## 3. RPC still works

Run responder:

```bash
npx ts-node-dev --transpile-only examples/02-rpc/responder.ts
```

Run requester:

```bash
npx ts-node-dev --transpile-only examples/02-rpc/requester.ts
```

Expected:

- requester receives a reply
- old RPC style still works through `meta.expectsReply`

Old RPC style:

```ts
ev.meta = {
  expectsReply: true,
  timeoutMs: 5000,
};

const reply = await pub.produce(ev);
```

New recommended RPC style:

```ts
const reply = await pub.request<Reply>(ev, {
  timeoutMs: 5000,
});
```

Both should remain valid.

---

## 4. Immediate retry remains valid

Run retry + DLQ example:

```bash
npx ts-node-dev --transpile-only examples/06-retry-dlq/consumer.retry.ts
npx ts-node-dev --transpile-only examples/06-retry-dlq/publisher.ts
```

Expected:

- retry without `delayMs` still works
- retry count headers are added
- final failure goes to DLQ

Existing retry config remains valid:

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

`delayMs` is optional and additive.

---

## 5. Delayed retry is additive

Run delayed retry consumer:

```bash
npx ts-node-dev --transpile-only examples/10-delayed-retry/consumer.retry-delayed.ts
```

Run publisher:

```bash
npx ts-node-dev --transpile-only examples/10-delayed-retry/publisher.ts
```

Expected:

- `job-ok` succeeds
- `job-flaky` recovers after delayed retries
- `job-poison` reaches final failure and DLQ
- retry headers include `x-rabbit-relay-retry-delay-ms`

New delayed retry config:

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 3000,
    then: "dead-letter",
  },
});
```

---

## 6. Publisher confirms still work

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.with.ts
```

Expected:

- messages are confirmed after RabbitMQ ACK

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.without.ts
```

Expected:

- messages are sent without waiting for confirms

---

## 7. Dedupe still works

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/consumer.dedupe.ts
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/publisher.dupes.ts
```

Expected:

- first message is processed
- duplicate message is skipped
- duplicate message is acknowledged

---

## 8. Plugins still work

Run:

```bash
npx ts-node-dev --transpile-only examples/04-plugins/consumer.ts
npx ts-node-dev --transpile-only examples/04-plugins/publisher.ts
```

Expected:

- plugin logs appear
- metrics appear
- consumer receives messages

---

## 9. amqplib escape hatch still works

Run:

```bash
npx ts-node-dev --transpile-only examples/07-escape-hatch/service.ts
```

Expected:

- native queue options work
- native exchange options work
- native publish options work
- raw channel access works

---

## 10. Health and shutdown still work

Run:

```bash
npx ts-node-dev --transpile-only examples/08-health-shutdown/service.ts
```

Expected:

- health output appears
- `broker.close()` closes consumers/channels/connection
- process shuts down cleanly on `Ctrl+C`

---

## 11. Lifecycle hooks are additive

Run:

```bash
npx ts-node-dev --transpile-only examples/11-lifecycle-hooks/service.ts
```

Expected:

- `topology.asserted` is emitted
- `consumer.started` is emitted
- `retry.scheduled` is emitted
- `consumer.stopped` is emitted on shutdown
- `broker.closed` is emitted on shutdown

Existing users do not need lifecycle hooks unless they want operational visibility.

---

## 12. OpenTelemetry adapter is optional

Run:

```bash
npx ts-node-dev --transpile-only examples/12-opentelemetry/service.ts
```

Expected:

- spans are created using the fake tracer
- retry exception is recorded
- no OpenTelemetry dependency is required by Rabbit Relay itself

Existing users do not need to install OpenTelemetry unless they want to use it.

---

## 13. Topology planner is read-only

Run:

```bash
npx ts-node-dev --transpile-only examples/13-topology-planner/service.ts
```

Expected:

- `sub.planTopology()` prints interface topology
- `broker.planTopology()` prints merged broker topology
- no extra RabbitMQ changes are made by calling `planTopology()`

---

## 14. Topology validation is passive

Run:

```bash
npx ts-node-dev --transpile-only examples/14-topology-validation/service.ts
```

Expected:

- exchanges and queues are passively checked
- result is valid when resources exist
- `binding_not_validated` appears as informational
- RabbitMQ topology is not modified by validation

---

## 15. DLQ redrive is additive

Run failing consumer:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/consumer.fail.ts
```

Run publisher:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/publisher.ts
```

Stop the failing consumer.

Run normal consumer:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/consumer.normal.ts
```

Dry-run redrive:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/redrive.ts --dry-run
```

Actual redrive:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/redrive.ts
```

Expected:

- dry-run reports available DLQ message
- actual redrive republishes the message
- original DLQ message is ACKed after republish
- normal consumer receives the redriven message
- redrive headers are visible

---

## 16. Manual queueArgs still work

Old manual queue argument configuration should still be supported:

```ts
.exchange("orders.exchange", {
  exchangeType: "topic",
  routingKey: "order.created",
  queueArgs: {
    "x-dead-letter-exchange": "orders.dlq.exchange",
  },
});
```

Expected:

- `queueArgs` are still passed to RabbitMQ
- new `deadLetter` helper remains additive
- topology planner includes queue arguments

---

## Compatibility result

If all checks pass, `0.9.0` is safe for common `0.8.0` usage patterns.

Release note:

```md
Rabbit Relay 0.9.0 is backward compatible with 0.8.0 public APIs.

Existing usage of produce, produceMany, publish, request, consume, with, publisher confirms, RPC metadata, plugins, middleware, metadata helpers, TTL dedupe, message size guard, amqplib passthrough options, health checks, shutdown, and manual queueArgs continues to work.

New operations APIs are additive.
```
