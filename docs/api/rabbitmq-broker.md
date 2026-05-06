# RabbitMQBroker

`RabbitMQBroker` is the main entry point for publishing and consuming events.

It owns the RabbitMQ connection, topology declaration, publishing, consuming, reconnect behavior, shutdown, and health checks.

---

## Creating a broker

```ts
const broker = new RabbitMQBroker("payments_service");
```

The peer name identifies this broker in Rabbit Relay health output.

---

## Declaring topology

```ts
const pub = await broker
  .queue("payments_queue")
  .exchange("payments_exchange", {
    exchangeType: "topic",
  });
```

This:

- asserts the queue
- asserts the exchange
- binds the queue to the exchange
- returns a typed broker interface

---

## Exchange options

```ts
{
  exchangeType?: "topic" | "direct" | "fanout" | "headers";
  routingKey?: string;
  durable?: boolean;
  publisherConfirms?: boolean;
  passiveQueue?: boolean;
  queueArgs?: Record<string, unknown>;
  deadLetter?: DeadLetterConfig;
  amqp?: {
    exchange?: Options.AssertExchange;
    queue?: Options.AssertQueue;
    bind?: Record<string, unknown>;
  };
}
```

---

## Queue options

```ts
broker.queue("orders.q", {
  amqp: {
    queue: {
      durable: true,
      arguments: {
        "x-queue-type": "quorum",
      },
    },
  },
});
```

---

## Publishing

For normal publishing:

```ts
await pub.produce(eventEnvelope);
```

For per-message AMQP options:

```ts
await pub.publish(eventEnvelope, {
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
    },
  },
});
```

Using factories:

```ts
const api = pub.with({ orderCreated });
await api.orderCreated({ id: "o-1" });
```

---

## Consuming

```ts
sub.handle("orderCreated", async (_id, ev) => {
  console.log(ev.data);
});

await sub.consume({
  prefetch: 50,
  concurrency: 10,
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Consume options

```ts
type ConsumeOptions = {
  prefetch?: number;
  concurrency?: number;
  requeueOnError?: boolean;
  onError?: "ack" | "requeue" | "dead-letter" | "retry";
  retry?: {
    attempts: number;
    then?: "ack" | "requeue" | "dead-letter";
  };
  amqp?: {
    consume?: Options.Consume;
  };
};
```

---

## Raw channel access

```ts
await broker.withChannel(async (ch) => {
  await ch.assertExchange("custom.ex", "headers", {
    durable: true,
  });
});
```

You can also call `withChannel()` on the returned broker interface.

---

## Health checks

```ts
const health = await broker.health();
```

Health includes:

- connection status
- channel status
- confirm channel status
- reconnect status
- registered consumers
- prefetch/concurrency state
- retry configuration

---

## Graceful shutdown

```ts
await broker.close();
```

This stops active consumers and closes RabbitMQ resources.

Use it during process shutdown:

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Notes

- Reconnects are automatic
- Delivery is at-least-once
- Handlers should be idempotent
- `broker.close()` closes the shared Rabbit Relay connection in the current process

---

## Summary

`RabbitMQBroker` exposes a small, explicit API aligned with RabbitMQ semantics while still allowing advanced `amqplib` access when needed.
