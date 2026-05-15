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

After a problem is fixed, operators may need to replay DLQ messages.

Rabbit Relay provides `redriveDlq()`:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
});
```

Dry-run first:

```ts
const result = await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "orders.created",
  limit: 100,
  dryRun: true,
});
```

See [DLQ Redrive](/features/dlq-redrive) for details.

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
