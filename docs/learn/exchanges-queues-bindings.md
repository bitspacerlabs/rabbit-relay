# Exchanges, Queues, and Bindings

RabbitMQ routing is based on three core resources:

```text
exchange -> binding -> queue
```

A producer publishes to an exchange.

RabbitMQ uses bindings to decide which queues should receive the message.

A consumer reads from a queue.

---

## Mental model

```text
producer
  -> exchange
    -> binding
      -> queue
        -> consumer
```

Rabbit Relay keeps this model explicit:

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

This means:

| Code | RabbitMQ concept |
|---|---|
| `"orders.ex"` | exchange |
| `"orders.q"` | queue |
| `"orders.*"` | binding routing key |
| `exchangeType: "topic"` | exchange type |

---

## Exchange

An exchange receives published messages.

The producer does not publish directly to a queue.

It publishes to an exchange.

```ts
.exchange("orders.ex", {
  exchangeType: "topic",
});
```

Common exchange types:

| Exchange type | Meaning |
|---|---|
| `topic` | route by pattern matching |
| `direct` | route by exact key |
| `fanout` | broadcast to all bound queues |
| `headers` | route using headers |

Most Rabbit Relay examples use `topic`.

---

## Queue

A queue stores messages until a consumer receives them.

```ts
.queue("orders.q")
```

A queue can have one or more consumers.

If no consumer is running, messages can wait in the queue.

---

## Binding

A binding connects an exchange to a queue.

The binding can include a routing key.

```ts
.exchange("orders.ex", {
  routingKey: "orders.*",
});
```

This tells RabbitMQ:

```text
send messages from orders.ex to orders.q
when the routing key matches orders.*
```

---

## Routing key

The routing key is the label RabbitMQ uses to route a message.

By default, Rabbit Relay uses the event name as the publish routing key.

```ts
const orderCreated = event("orders.created", "v1").of<OrderCreated>();

await pub.produce(orderCreated(data));
```

Default routing key:

```text
orders.created
```

If the queue binding is:

```text
orders.*
```

then `orders.created` matches and the message goes to the queue.

---

## Topic exchange matching

Topic exchanges support patterns.

| Pattern | Matches |
|---|---|
| `orders.created` | only `orders.created` |
| `orders.*` | `orders.created`, `orders.paid` |
| `orders.#` | `orders.created`, `orders.payment.failed`, etc. |
| `#` | everything |

Use specific patterns when possible.

Use `#` only when you intentionally want broad consumption.

---

## Fanout exchange

Fanout exchanges ignore routing keys.

Every bound queue receives the message.

```ts
await broker
  .queue("audit.q")
  .exchange("events.broadcast", {
    exchangeType: "fanout",
  });
```

This is useful for broadcast-style events.

---

## Direct exchange

Direct exchanges use exact routing-key matching.

```ts
await broker
  .queue("payments.q")
  .exchange("commands.ex", {
    exchangeType: "direct",
    routingKey: "payments.authorize",
  });
```

This is useful for command-like routing.

---

## Common mistake: publishing to a queue

In RabbitMQ, producers publish to exchanges, not queues.

Rabbit Relay still asks for a queue because one broker interface combines the publishing and consuming shape.

For publisher-only code, the queue can be a publisher interface queue.

```ts
const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
  });
```

The important part for publishing is the exchange.

---

## Common mistake: wrong routing key

If a message is published but no consumer receives it, check:

- the event name
- the publish routing key
- the binding routing key
- the exchange type

Example:

```ts
event("orders.created", "v1")
```

with binding:

```ts
routingKey: "payments.*"
```

does not match.

---

## Summary

- Producers publish to exchanges
- Queues store messages for consumers
- Bindings connect exchanges to queues
- Routing keys decide where messages go
- Rabbit Relay maps `.queue(...).exchange(...)` directly to RabbitMQ topology
