# Configuration

Rabbit Relay uses **sensible defaults** and a small set of configuration options.
Most applications only need to set a broker URL and (optionally) a connection name.

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

If not set, RabbitMQ will generate a default connection name.

---

## Performance tuning

Rabbit Relay exposes a few knobs to control throughput and backpressure.
These options are configured per consumer when calling `consume()`.

### `prefetch`

Maximum number of **unacknowledged messages** allowed on the channel.

- Controls backpressure
- Prevents consumers from being overwhelmed
- Lower values = safer, higher values = more throughput

---

### `concurrency`

Maximum number of handlers executed **in parallel**.

- Defaults to the value of `prefetch`
- Should usually be ≤ `prefetch`
- Useful when handlers perform I/O or async work

---

### `publisherConfirms`

Enable RabbitMQ **publisher confirms**.

- Uses a confirm channel
- Publisher waits for broker acknowledgements
- Safer for critical events
- Slightly lower throughput

Configured when declaring an exchange:

```ts
.exchange("my_exchange", {
  exchangeType: "topic",
  publisherConfirms: true
});
```

---

## Error handling policy

Error behavior is configured when starting a consumer.

```ts
await sub.consume({
  prefetch: 50,
  concurrency: 10,
  onError: "ack" | "requeue" | "dead-letter",
});
```

### Error modes

#### `ack` (default)

- Errors are swallowed
- Message is acknowledged
- No retry

Best for:
- non-critical events
- idempotent handlers
- logging or metrics consumers

---

#### `requeue`

- Message is negatively acknowledged
- Requeued to the same queue
- May be redelivered immediately

Best for:
- transient failures
- temporary downstream outages

⚠️ Be careful to avoid infinite retry loops.

---

#### `dead-letter`

- Message is negatively acknowledged
- Not requeued
- Routed to a **dead-letter exchange** (if configured)

Best for:
- poison messages
- validation errors
- manual inspection workflows

> **Note:** Dead-lettering requires the queue to be configured with a DLX.

---

## Notes and best practices

- RabbitMQ bindings are **persistent** — changing routing keys does not remove old bindings
- Use queue versioning or recreate queues when changing routing behavior
- Tune `prefetch` and `concurrency` together
- Enable `publisherConfirms` only when delivery guarantees matter
