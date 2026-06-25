---
title: "Rabbit Relay 1.0: Type-safe RabbitMQ for Node.js without hiding RabbitMQ"
description: "Rabbit Relay 1.0 is a TypeScript-first RabbitMQ framework for Node.js that keeps RabbitMQ concepts explicit while making messaging safer and cleaner."
date: "2026-06-25"
tags:
  - rabbitmq
  - nodejs
  - typescript
  - backend
  - opensource
---

# Rabbit Relay 1.0: Type-safe RabbitMQ for Node.js without hiding RabbitMQ

I just released Rabbit Relay `1.0.0`, the first stable release of a TypeScript-first RabbitMQ framework for Node.js.

Rabbit Relay is built on top of `amqplib`.

The main idea is simple:

> Keep RabbitMQ explicit, but make it safer and cleaner to use in TypeScript services.

It keeps real RabbitMQ concepts visible:

- exchanges
- queues
- bindings
- routing keys
- acknowledgements
- retries
- dead-letter queues
- publisher confirms
- topology ownership

It is not trying to turn RabbitMQ into magic function calls.

It is trying to make RabbitMQ easier to use correctly.

---

## Why I built it

`amqplib` is powerful, but it is low-level.

In real services, teams often repeat the same boilerplate again and again:

- create connection
- create channel
- assert exchanges
- assert queues
- bind queues
- serialize messages
- publish messages
- consume messages
- ACK/NACK messages
- handle retries
- configure DLQs
- add correlation IDs
- add health checks
- decide who owns topology

That logic can become inconsistent across services.

One service handles retries one way.  
Another forgets publisher confirms.  
Another requeues forever.  
Another uses routing keys differently.

Rabbit Relay is my attempt to make this layer consistent without hiding the RabbitMQ model.

---

## A typed event

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const orderCreated = event("order.created", "v1").of<OrderCreated>();

const broker = new RabbitMQBroker("orders.publisher");

const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

await pub.produce(
  orderCreated({
    orderId: "o-1",
    amount: 42,
  })
);

await broker.close();
```

The RabbitMQ concepts are still visible:

```text
orders.ex = exchange
orders.publisher.q = queue
topic = exchange type
publisherConfirms = wait for RabbitMQ broker acknowledgement
```

Rabbit Relay just gives this a cleaner TypeScript API.

---

## Typed event contracts

Messaging systems often fail when message contracts become tribal knowledge.

Someone knows `order.created` has an `orderId`.  
Someone else knows `payment.processed` has a `transactionId`.

But unless those contracts are visible in code, they are easy to break.

Rabbit Relay event factories make the event name, version, and payload type explicit:

```ts
const paymentProcessed = event("payment.processed", "v1").of<{
  orderId: string;
  transactionId: string;
  status: "paid";
}>();
```

Then publishing is type-checked:

```ts
await pub.produce(
  paymentProcessed({
    orderId: "o-1",
    transactionId: "txn-123",
    status: "paid",
  })
);
```

This does not replace schema validation or contract testing.

But it makes the common TypeScript workflow much safer.

---

## A typed publish API

Rabbit Relay can also build a small typed publish API from event factories:

```ts
const send = event("send", "v1").of<{ message: string }>();

const api = pub.with({ send });

await api.send({
  message: "hello world",
});
```

The generated methods create the event and publish it.

So they are async publish methods and should be awaited.

---

## Routing keys stay explicit

RabbitMQ topic routing is powerful, but easy to confuse.

In topic exchanges, values like `order.*` or `#` are usually binding patterns.

They are useful when binding a queue.

But they are usually not what you want to publish as the message routing key.

Rabbit Relay keeps this behavior explicit.

By default, Rabbit Relay publishes with the event name as the routing key:

```ts
const makeOrderCreated = event("order.created", "v1").of<OrderCreated>();

await pub.produce(
  makeOrderCreated({
    orderId: "o-1",
    amount: 42,
  })
); // routing key: "order.created"
```

If a concrete routing key is configured, Rabbit Relay can use it when publishing.

But if the configured routing key is a topic wildcard pattern like `#` or `order.*`, Rabbit Relay treats it as a binding pattern and continues publishing with the event name.

You can still override the publish routing key explicitly:

```ts
await pub.publish(eventEnvelope, {
  routingKey: "custom.key",
});
```

---

## Consuming events

```ts
import { RabbitMQBroker, type EventEnvelope } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const broker = new RabbitMQBroker("orders.consumer");

const sub = await broker
  .queue("orders.q")
  .exchange<{
    "order.created": EventEnvelope<OrderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    routingKey: "order.*",
  });

sub.handle("order.created", async (_id, ev) => {
  console.log(ev.data.orderId);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

The mental model stays the same:

```text
producer -> exchange -> binding -> queue -> consumer
```

---

## Production failure handling

The happy path is not enough.

Consumers fail.  
Downstream services go down.  
Databases timeout.  
Messages can be delivered more than once.  
Poison messages can block processing if failure handling is not designed carefully.

Rabbit Relay supports:

- ACK on success
- NACK and requeue
- NACK and dead-letter
- bounded retry
- delayed retry
- DLQ redrive

Example:

```ts
await sub.consume({
  prefetch: 10,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

This avoids two dangerous patterns:

1. Losing failed messages silently.
2. Requeueing forever and creating an infinite failure loop.

---

## Operations features

Rabbit Relay `1.0.0` also includes:

- lifecycle hooks
- health checks
- OpenTelemetry adapter
- topology planning
- topology validation
- DLQ redrive

For example:

```ts
const plan = broker.planTopology();

console.log(plan);
```

Topology validation can passively check existing RabbitMQ infrastructure without modifying it.

That is useful when infrastructure owns the RabbitMQ topology and applications should only validate that required exchanges and queues exist.

---

## Why not hide RabbitMQ?

Some libraries try to make messaging look like normal function calls.

That can be nice at first, but it often hides important operational details.

RabbitMQ concepts matter:

- exchange type matters
- routing key matters
- queue durability matters
- prefetch matters
- ACK/NACK behavior matters
- DLQs matter
- publisher confirms matter
- topology ownership matters

Rabbit Relay is designed around the idea that developers should understand these concepts, not avoid them.

The library should reduce boilerplate, not remove the mental model.

---

## Install

```bash
npm i @bitspacerlabs/rabbit-relay
```

GitHub:

```text
https://github.com/bitspacerlabs/rabbit-relay
```

Docs:

```text
https://bitspacerlabs.github.io/rabbit-relay/
```

npm:

```text
https://www.npmjs.com/package/@bitspacerlabs/rabbit-relay
```

---

## Final thought

RabbitMQ is already powerful.

Rabbit Relay is not trying to replace it.

It is trying to make RabbitMQ easier to use correctly in Node.js and TypeScript services, while keeping the real messaging concepts visible.

That is the core idea:

> Type-safe RabbitMQ for Node.js, without hiding RabbitMQ.
