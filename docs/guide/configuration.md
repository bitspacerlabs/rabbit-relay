# Configuration

Rabbit Relay uses sensible defaults and a small set of configuration options.

Most applications only need to set a broker URL and then tune publishing and consuming per use case.

---

## Environment variables

### `RABBITMQ_URL`

RabbitMQ connection URL.

```bash
export RABBITMQ_URL=amqp://user:password@localhost
```

Default:

```text
amqp://user:password@localhost
```

---

### `AMQP_CONN_NAME`

Optional human-readable connection name shown in RabbitMQ Management UI.

```bash
export AMQP_CONN_NAME=app:orders-service
```

If not set, Rabbit Relay generates a name from the process title, hostname, and process ID.

---

## Broker-level options

Broker defaults are passed to the constructor.

```ts
const broker = new RabbitMQBroker("orders-service", {
  exchangeType: "topic",
  durable: true,
  publisherConfirms: false,
  maxMessageBytes: 256 * 1024,
});
```

These defaults can be overridden when declaring an exchange or publishing a message.

---

## Topology options

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    durable: true,
  });
```

Common options:

| Option | Description |
|---|---|
| `exchangeType` | `topic`, `direct`, `fanout`, or `headers` |
| `routingKey` | Binding key used between queue and exchange |
| `durable` | Whether queue/exchange should survive broker restarts |
| `publisherConfirms` | Whether publishes wait for broker confirmation |
| `passiveQueue` | Check queue exists instead of declaring it |
| `queueArgs` | RabbitMQ queue arguments |
| `maxMessageBytes` | Maximum serialized event size |
| `deadLetter` | Built-in DLQ helper |
| `amqp` | Native `amqplib` passthrough options |

---

## Consumer tuning

```ts
await sub.consume({
  prefetch: 50,
  concurrency: 10,
});
```

### `prefetch`

Maximum number of unacknowledged messages RabbitMQ can deliver.

### `concurrency`

Maximum number of handlers Rabbit Relay runs in parallel.

Use both together to protect:

- database pools
- APIs
- CPU
- memory

---

## Consumer de-duplication

```ts
await sub.consume({
  dedupe: {
    enabled: true,
    ttlMs: 60_000,
    maxKeys: 100_000,
  },
});
```

Duplicate messages are acknowledged and skipped.

---

## Error handling policy

```ts
await sub.consume({
  onError: "ack" | "requeue" | "dead-letter" | "retry",
});
```

Recommended production pattern:

```ts
await sub.consume({
  prefetch: 20,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Dead-letter queues

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

---

## Message size guard

Set a max serialized message size:

```ts
const broker = new RabbitMQBroker("orders-service", {
  maxMessageBytes: 256 * 1024,
});
```

Override per publish:

```ts
await pub.publish(orderCreated(data), {
  maxMessageBytes: 64 * 1024,
});
```

---

## Native amqplib passthrough

```ts
await broker
  .queue("orders.q", {
    amqp: {
      queue: {
        arguments: {
          "x-queue-type": "quorum",
        },
      },
    },
  })
  .exchange("orders.ex", {
    exchangeType: "topic",
    amqp: {
      exchange: {
        alternateExchange: "orders.alt",
      },
    },
  });
```

---

## Health and shutdown

```ts
const health = await broker.health();
```

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Notes and best practices

- RabbitMQ bindings are persistent
- Queue arguments are immutable
- Tune `prefetch` and `concurrency` together
- Use retries with DLQs instead of infinite requeue loops
- Enable `publisherConfirms` for critical event boundaries
- Keep handlers idempotent
- Keep messages small
