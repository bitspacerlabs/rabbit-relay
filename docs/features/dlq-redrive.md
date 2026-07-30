# DLQ Redrive

DLQ redrive moves messages from a dead-letter queue back to a target exchange/routing key.

Use it after the root cause of failures has been fixed.

---

## CLI

The `rabbit-relay` CLI provides DLQ commands for inspection, peeking, and redriving:

```bash
# Inspect queue depth
rabbit-relay dlq inspect orders.dlq --url amqp://localhost

# Peek at messages without consuming them
rabbit-relay dlq peek orders.dlq --limit 5 --url amqp://localhost

# Dry-run redrive (safety check)
rabbit-relay dlq redrive orders.dlq orders.ex --dry-run --url amqp://localhost

# Redrive with a limit
rabbit-relay dlq redrive orders.dlq orders.ex --limit 50 --url amqp://localhost
```

The `inspect` command shows queue depth and consumer count:

```json
{ "queue": "orders.dlq", "messageCount": 42, "consumerCount": 0 }
```

The `peek` command shows message headers, routing metadata, and body
without removing messages from the queue. Messages are returned to the
queue when the peek consumer is cancelled.

---

## Basic usage

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
});
```

---

## Dry-run first

Always dry-run before redriving in production.

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

Dry-run:

- checks queue depth
- does not consume messages
- does not publish messages
- does not ACK messages

---

## Result shape

```ts
type DlqRedriveResult = {
  fromQueue: string;
  toExchange: string;
  routingKey?: string;
  dryRun: boolean;
  available: number;
  attempted: number;
  republished: number;
  acked: number;
  failed: number;
  empty: boolean;
  errors: Array<{
    message: string;
    error?: unknown;
  }>;
};
```

Example:

```json
{
  "fromQueue": "orders.dlq",
  "toExchange": "orders.ex",
  "routingKey": "orders.created",
  "dryRun": false,
  "available": 1,
  "attempted": 1,
  "republished": 1,
  "acked": 1,
  "failed": 0,
  "empty": true,
  "errors": []
}
```

---

## Safety behavior

Rabbit Relay redrive is intentionally conservative:

- bounded by `limit`
- supports `dryRun`
- preserves message body
- preserves AMQP properties
- adds redrive headers
- ACKs original DLQ message only after successful republish
- requeues original DLQ message if republish fails

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

These headers are visible in `event.meta.headers` when the redriven message is consumed.

---

## Using from a broker interface

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex");

await sub.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 50,
});
```

---

## Recommended operation flow

1. Find and fix the root cause
2. Start the normal consumer
3. Dry-run redrive
4. Redrive a small limit
5. Watch logs and metrics
6. Increase limit gradually if needed

---

## Important notes

- Redrive does not guarantee the message will succeed after replay
- Consumers must still be idempotent
- Use small limits in production
- Use DLQ inspection before large redrive operations
- Make sure the failing consumer is not still failing before redrive

---

## Summary

- `redriveDlq()` replays DLQ messages safely
- Dry-run is supported
- ACK happens only after successful republish
- Headers show redrive history
- Useful for production support workflows
