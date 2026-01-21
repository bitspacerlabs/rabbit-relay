# RabbitMQBroker

`RabbitMQBroker` is the main entry point for publishing and consuming events.

---

## Creating a broker

```ts
const broker = new RabbitMQBroker("payments_service");
```

The peer name is visible in RabbitMQ management tools.

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
- binds them together
- returns a typed broker interface

---

## Exchange options

```ts
{
  exchangeType?: "topic" | "direct" | "fanout";
  routingKey?: string;
  durable?: boolean;          // default: true
  publisherConfirms?: boolean // default: false
}
```

---

## Publishing

```ts
await pub.produce(eventEnvelope);
```

Or using factories:

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
  onError: "dead-letter",
});
```

---

## Consume options

```ts
type ConsumeOptions = {
  prefetch?: number;
  concurrency?: number;
  onError?: "ack" | "requeue" | "dead-letter";
};
```

---

## Notes

- Reconnects are automatic
- Delivery is at-least-once
- Handlers should be idempotent

---

## Summary

`RabbitMQBroker` owns connection, topology, publishing, and consuming.
It exposes a small, explicit API aligned with RabbitMQ semantics.
