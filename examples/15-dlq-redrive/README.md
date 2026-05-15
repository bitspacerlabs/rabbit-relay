# DLQ Redrive

This example demonstrates Rabbit Relay DLQ redrive.

DLQ redrive moves messages from a dead-letter queue back to a target exchange/routing key after the root cause has been fixed.

---

## What it shows

- failing consumer sends a message to DLQ
- redrive dry-run checks DLQ state
- redrive republishes from DLQ to the main exchange
- original DLQ message is ACKed only after successful republish
- normal consumer processes the redriven message
- redrive headers are added

---

## Files

- `publisher.ts`  
  Publishes one successful job and one failing job.

- `consumer.fail.ts`  
  Fails `job-needs-redrive` so RabbitMQ routes it to DLQ.

- `consumer.normal.ts`  
  Processes redriven messages successfully.

- `redrive.ts`  
  Redrives messages from DLQ back to the main exchange.

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

Terminal 1 — start failing consumer:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/consumer.fail.ts
```

Terminal 2 — publish jobs:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/publisher.ts
```

The failing consumer should process `job-ok` and send `job-needs-redrive` to DLQ.

Stop the failing consumer with `Ctrl+C`.

Terminal 3 — start normal consumer:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/consumer.normal.ts
```

Terminal 4 — dry run redrive:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/redrive.ts --dry-run
```

Expected dry run result:

```text
"dryRun": true
"available": 1
"attempted": 0
```

Terminal 4 — actual redrive:

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/redrive.ts
```

Expected redrive result:

```text
"attempted": 1
"republished": 1
"acked": 1
"failed": 0
```

The normal consumer should receive and process the redriven message.

---

## Optional limit

```bash
npx ts-node-dev --transpile-only examples/15-dlq-redrive/redrive.ts --limit=5
```

---

## Redrive API

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
});
```

Dry run:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

---

## Safety behavior

- `dryRun` does not consume messages
- redrive is bounded by `limit`
- message body is preserved
- AMQP properties are preserved
- redrive headers are added
- original DLQ message is ACKed only after republish succeeds
- original DLQ message is requeued if republish fails

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

These headers help operators track replayed messages.
