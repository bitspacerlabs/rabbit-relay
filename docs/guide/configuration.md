# Configuration

Rabbit Relay uses **sensible defaults** and a small set of configuration options.
Most applications only need to set a broker URL and then tune publishing and consuming per use case.

---

## Environment variables

Rabbit Relay reads configuration from environment variables at runtime.

### `RABBITMQ_URL`

The RabbitMQ connection URL.

- **Default:** `amqp://user:password@localhost`
- Used by all publishers and consumers unless overridden

```bash
export RABBITMQ_URL=amqp://user:password@localhost
```

---

### `AMQP_CONN_NAME`

Optional human-readable connection name shown in the RabbitMQ Management UI.

This is useful when:

- running multiple services
- debugging connections
- inspecting clients in production

```bash
export AMQP_CONN_NAME=app:dev
```

If not set, Rabbit Relay generates a connection name from the Node.js process and hostname.

---

## Broker-level options

Broker defaults are passed to the constructor.

```ts
const broker = new RabbitMQBroker("orders-service", {
  exchangeType: "topic",
  durable: true,
  publisherConfirms: false,
});
```

These defaults can be overridden when declaring an exchange.

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
| `deadLetter` | Built-in DLQ helper |
| `amqp` | Native `amqplib` passthrough options |

---

## Performance tuning

Rabbit Relay exposes two main consumer controls: `prefetch` and `concurrency`.

```ts
await sub.consume({
  prefetch: 50,
  concurrency: 10,
});
```

### `prefetch`

Maximum number of **unacknowledged messages** RabbitMQ can deliver to this consumer.

- Controls RabbitMQ delivery pressure
- Prevents unlimited unacked messages
- Lower values are safer
- Higher values may improve throughput

### `concurrency`

Maximum number of handlers Rabbit Relay runs **in parallel**.

- Defaults to `prefetch`
- Should usually be less than or equal to `prefetch`
- Protects database pools, APIs, CPU, and memory

---

## Publisher confirms

Enable RabbitMQ **publisher confirms** when your application must know that RabbitMQ accepted the message.

```ts
const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });
```

With confirms enabled:

- Rabbit Relay publishes through a confirm channel
- publish calls wait for broker acknowledgement
- failures are surfaced to the caller

Use this for critical event boundaries.

---

## Error handling policy

Error behavior is configured when starting a consumer.

```ts
await sub.consume({
  onError: "ack" | "requeue" | "dead-letter" | "retry",
});
```

### `ack`

Default. Errors are logged and the message is acknowledged.

### `requeue`

The message is negatively acknowledged and requeued.

Use carefully because this can create infinite retry loops.

### `dead-letter`

The message is negatively acknowledged with `requeue=false`.

RabbitMQ routes it to a DLQ if the queue has dead-letter configuration.

### `retry`

Rabbit Relay republishes the message for a bounded number of attempts.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Dead-letter queues

Rabbit Relay can configure dead-letter routing for a queue.

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

With `autoDeclare: true`, Rabbit Relay declares the DLX, DLQ, and binding.

If your infrastructure manages RabbitMQ topology, omit `autoDeclare` and create DLQ resources externally.

---

## Native amqplib passthrough

Rabbit Relay does not block native RabbitMQ features.

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

Use this for advanced queue, exchange, binding, publish, or consume options.

---

## Health and shutdown

Use `health()` for operational checks.

```ts
const health = await broker.health();
```

Use `close()` during shutdown.

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Notes and best practices

- RabbitMQ bindings are persistent; changing routing keys does not remove old bindings
- Queue arguments are immutable; changing DLQ or quorum settings may require queue recreation
- Tune `prefetch` and `concurrency` together
- Use retries with DLQs instead of infinite requeue loops
- Enable `publisherConfirms` for critical event boundaries
- Keep handlers idempotent because RabbitMQ delivery is at-least-once
