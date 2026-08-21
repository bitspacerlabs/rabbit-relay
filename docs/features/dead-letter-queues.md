# Dead-Letter Queues

Dead-letter queues help isolate failed or unprocessable messages.

Rabbit Relay provides a built-in DLQ helper so you do not need to manually remember RabbitMQ queue arguments.

---

## Basic usage

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

This configures the main queue with:

```text
x-dead-letter-exchange = orders.dlx
x-dead-letter-routing-key = orders.dead
```

When a message is rejected with `requeue=false`, RabbitMQ routes it to the DLQ.

---

## Auto-declare mode

When `autoDeclare: true`, Rabbit Relay declares:

- the dead-letter exchange
- the dead-letter queue
- the binding from DLQ to DLX
- the main queue dead-letter arguments

```ts
deadLetter: {
  exchange: "orders.dlx",
  queue: "orders.dlq",
  routingKey: "orders.dead",
  autoDeclare: true,
}
```

---

## External infrastructure mode

If your team manages RabbitMQ topology using Terraform, Helm, or another setup process, keep `autoDeclare` false or omit it.

```ts
deadLetter: {
  exchange: "orders.dlx",
  routingKey: "orders.dead",
}
```

Rabbit Relay will configure the main queue with DLQ arguments, but it will not create the DLX/DLQ.

---

## Using DLQ with consumer errors

```ts
await sub.consume({
  onError: "dead-letter",
});
```

If the handler throws, Rabbit Relay calls:

```text
nack(requeue=false)
```

RabbitMQ then routes the message to the configured DLQ.

---

## Using DLQ after retries

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

After retries are exhausted, the message is dead-lettered.

---

## DLQ redrive

After the root cause of failures is fixed, you can replay DLQ messages back to a target exchange.

### CLI

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

### Programmatic

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
});
```

You can also call it from a broker interface:

```ts
await sub.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 50,
});
```

### Dry-run first

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

Dry-run checks queue depth without consuming, publishing, or ACKing messages.

### Result shape

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
  errors: Array<{ message: string; error?: unknown }>;
};
```

### Safety behavior

Rabbit Relay redrive is intentionally conservative:

- bounded by `limit`
- supports `dryRun`
- preserves message body and AMQP properties
- adds redrive headers
- ACKs the original DLQ message only after successful republish
- requeues the original DLQ message if republish fails

### Redrive headers

```text
x-rabbit-relay-redrive-count
x-rabbit-relay-redriven-at
x-rabbit-relay-redriven-from-queue
x-rabbit-relay-redriven-to-exchange
x-rabbit-relay-redriven-routing-key
```

These are visible in `event.meta.headers` when the redriven message is consumed.

### Recommended operation flow

1. Find and fix the root cause
2. Start the normal consumer
3. Dry-run redrive
4. Redrive a small limit
5. Watch logs and metrics
6. Increase limit gradually if needed

Consumers must still be idempotent - redrive does not guarantee the message will succeed after replay.

---

## Important note about existing queues

RabbitMQ queue arguments are immutable.

If a queue already exists without DLQ arguments, declaring it again with DLQ arguments may fail with a precondition error.

Fix by:

- deleting/recreating the queue in development
- using a new queue name/version
- managing topology externally and using `passiveQueue: true`

---

## Summary

- DLQs isolate poison messages
- Rabbit Relay can configure DLQ arguments for you
- `autoDeclare: true` creates DLX/DLQ topology
- Use DLQ with retry for production-safe failure handling
- Use `redriveDlq()` to safely replay messages after fixes
