# amqplib Escape Hatch

**What it shows:** Rabbit Relay simplifies common messaging, but still lets you access native RabbitMQ / `amqplib` options.

This example demonstrates:

- queue-level native AMQP options
- exchange-level native AMQP options
- publish options through `publish()`
- raw channel access with `withChannel()`

---

## Files

- `consumer.ts`  
  Declares a queue using native AMQP queue options.

- `publisher.ts`  
  Publishes messages with native AMQP publish options and uses raw channel access.

---

## Run

```bash
# terminal 1 – start consumer
npx ts-node-dev --transpile-only examples/07-escape-hatch/consumer.ts

# terminal 2 – start publisher
npx ts-node-dev --transpile-only examples/07-escape-hatch/publisher.ts
```

---

## What to notice

The consumer queue uses native queue arguments:

```ts
amqp: {
  queue: {
    durable: true,
    arguments: {
      "x-message-ttl": 60_000,
    },
  },
}
```

The publisher uses per-message publish options:

```ts
await pub.publish(event, {
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
      contentType: "application/json",
    },
  },
});
```

And raw channel access:

```ts
await broker.withChannel(async (ch) => {
  await ch.assertExchange("escape.audit.ex", "fanout", { durable: true });
});
```

---

## Production takeaway

Rabbit Relay is not a closed abstraction.

Use the high-level typed API for normal work, and use AMQP passthrough or `withChannel()` when you need advanced RabbitMQ behavior.
