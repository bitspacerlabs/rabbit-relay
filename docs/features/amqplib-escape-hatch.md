# amqplib Escape Hatch

Rabbit Relay gives you a clean TypeScript API for common RabbitMQ patterns, but it does **not** block access to native RabbitMQ / `amqplib` features.

The goal is simple:

> Use Rabbit Relay for safe defaults, and drop down to native AMQP options whenever you need advanced behavior.

---

## Why this exists

RabbitMQ has many advanced features:

- quorum queues
- priority queues
- message TTL
- queue TTL
- alternate exchanges
- dead-letter exchanges
- custom headers
- mandatory publishing
- exclusive consumers
- custom binding arguments

Rabbit Relay should not hide or reimplement all of RabbitMQ. Instead, it provides an **escape hatch**.

---

## Queue options

Pass native `amqplib` queue options when declaring a queue.

```ts
const sub = await broker
  .queue("orders.q", {
    amqp: {
      queue: {
        durable: true,
        arguments: {
          "x-queue-type": "quorum",
          "x-message-ttl": 60_000,
        },
      },
    },
  })
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

These options are passed to `channel.assertQueue()`.

---

## Exchange options

Pass native exchange options through `amqp.exchange`.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    amqp: {
      exchange: {
        durable: true,
        alternateExchange: "orders.alt",
      },
    },
  });
```

These options are passed to `channel.assertExchange()`.

---

## Binding arguments

Pass native binding arguments through `amqp.bind`.

```ts
await broker
  .queue("tenant.orders.q")
  .exchange("tenant.events", {
    exchangeType: "headers",
    routingKey: "",
    amqp: {
      bind: {
        "x-match": "all",
        tenantId: "tenant-1",
      },
    },
  });
```

---

## Publish options

Use `publish()` when you need per-message AMQP options.

```ts
await pub.publish(orderCreated(data), {
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
      expiration: "30000",
      contentType: "application/json",
    },
  },
});
```

Use `produce()` for the common case:

```ts
await pub.produce(orderCreated(data));
```

Use `publish()` when you need native publish options.

---

## Consume options

Pass native consume options through `consume()`.

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 5,
  amqp: {
    consume: {
      exclusive: false,
      priority: 10,
    },
  },
});
```

These options are passed to `channel.consume()`.

---

## Raw channel access

For advanced cases, use `withChannel()`.

```ts
await broker.withChannel(async (ch) => {
  await ch.assertExchange("custom.headers.ex", "headers", {
    durable: true,
  });
});
```

You can also use it from the returned broker interface:

```ts
await sub.withChannel(async (ch) => {
  await ch.bindQueue("orders.q", "custom.headers.ex", "", {
    "x-match": "all",
    tenantId: "tenant-1",
  });
});
```

---

## Recommended approach

Use Rabbit Relay defaults first.

Reach for the escape hatch when you need:

- advanced RabbitMQ arguments
- custom topology
- special publish properties
- custom consume behavior
- migration from existing `amqplib` code

---

## Summary

- Rabbit Relay simplifies common RabbitMQ usage
- Native `amqplib` options remain available
- Advanced RabbitMQ features are not blocked
- `withChannel()` gives full control when needed
