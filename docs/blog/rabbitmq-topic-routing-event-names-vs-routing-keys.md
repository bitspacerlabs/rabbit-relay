---
title: "RabbitMQ Topic Routing: Event Names vs Routing Keys"
description: "A practical explanation of RabbitMQ topic routing, binding patterns, routing keys, and why event-driven Node.js apps should keep them explicit."
date: "2026-06-26"
tags:
  - rabbitmq
  - nodejs
  - typescript
  - backend
  - messaging
---

# RabbitMQ Topic Routing: Event Names vs Routing Keys

RabbitMQ topic routing is powerful, but it is also one of the easiest parts to misunderstand.

The confusion usually starts with this question:

> Is `order.*` the routing key I publish with, or the pattern my queue binds with?

In most topic-exchange designs, values like `order.*` and `#` are **binding patterns**.

The message itself is usually published with a concrete routing key like:

```text
order.created
```

That difference matters.

If you mix up event names, publish routing keys, and binding patterns, messages can route in surprising ways.

This post explains the difference and shows how Rabbit Relay handles it while still keeping RabbitMQ concepts explicit.

---

## The basic RabbitMQ routing model

A simple RabbitMQ flow looks like this:

```text
producer -> exchange -> binding -> queue -> consumer
```

The producer does not publish directly to a queue.

It publishes a message to an exchange.

The exchange then decides which queues should receive the message based on bindings.

For a topic exchange, the important pieces are:

```text
publish routing key
binding routing pattern
queue
```

Example:

```text
message routing key: order.created
binding pattern:     order.*
queue:               orders.q
```

The message matches the binding pattern, so RabbitMQ routes the message to the queue.

---

## Concrete routing keys

A concrete routing key describes the message being published.

Examples:

```text
order.created
order.cancelled
payment.processed
invoice.generated
user.registered
```

These are usually event-like names.

They describe what happened.

For example:

```ts
const orderCreated = event("order.created", "v1").of<{
  orderId: string;
  amount: number;
}>();
```

When this event is published, a natural routing key is:

```text
order.created
```

That is concrete.

It does not contain wildcards.

---

## Topic binding patterns

Topic exchanges support wildcard patterns when queues bind to exchanges.

The two special wildcards are:

```text
* = exactly one word
# = zero or more words
```

So these bindings behave differently:

```text
order.*       matches order.created and order.cancelled
order.#       matches order.created, order.payment.failed, and order
#.created     matches order.created and invoice.created
#             matches everything
```

These are useful when a queue wants to receive a group of related events.

Example:

```text
queue: orders.q
binding pattern: order.*
```

That queue receives:

```text
order.created
order.cancelled
```

But not:

```text
payment.processed
order.payment.failed
```

because `order.payment.failed` has more words than `order.*` allows.

---

## The common mistake

The mistake is treating the binding pattern as the publish routing key.

For example:

```text
binding pattern: order.*
publish key:     order.*
```

That is usually not what you want.

If you publish a message with routing key `order.*`, RabbitMQ treats `order.*` as the actual routing key string for that message.

It does not mean “publish this message to all order events.”

The wildcard behavior belongs to the binding pattern.

So this is usually better:

```text
binding pattern: order.*
publish key:     order.created
```

Now the exchange can compare:

```text
order.created matches order.*
```

and route the message correctly.

---

## Event name vs routing key

In many event-driven systems, the event name and routing key are the same.

Example:

```text
event name:   order.created
routing key:  order.created
```

That is simple and predictable.

But they do not have to be the same.

You may choose a different publish routing key for infrastructure reasons:

```text
event name:   order.created
routing key:  internal.orders.created
```

That can be valid.

The important thing is to keep the difference clear:

```text
event name = what happened
routing key = how RabbitMQ routes the message
binding pattern = what a queue wants to receive
```

---

## How this looks in Rabbit Relay

Rabbit Relay keeps the RabbitMQ model visible.

A publisher may look like this:

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

By default, Rabbit Relay publishes using the event name as the routing key:

```text
order.created
```

That works naturally with topic bindings like:

```text
order.*
```

---

## Binding a consumer with a pattern

A consumer can bind to a topic pattern:

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

Here:

```text
orders.ex = exchange
orders.q = queue
order.* = binding pattern
order.created = event name and publish routing key
```

The queue subscribes to a pattern.

The message is still published with a concrete event-like key.

---

## What about `#`?

A binding pattern of `#` means:

```text
match everything
```

This is common for logging, debugging, audit, or demo consumers.

Example:

```text
binding pattern: #
publish key:     demo.tick
```

The queue receives `demo.tick` because `#` matches everything.

But you usually do not want to publish messages with `#` as the routing key.

The message should still have a real routing key like:

```text
demo.tick
```

---

## Explicit routing key overrides

Sometimes you really do want to publish with a custom routing key.

Rabbit Relay allows that explicitly:

```ts
await pub.publish(eventEnvelope, {
  routingKey: "internal.orders.created",
});
```

This is useful when the event name and the infrastructure routing key are intentionally different.

The important word is intentionally.

The override should be obvious in code.

---

## Why Rabbit Relay treats wildcards carefully

In Rabbit Relay `1.0.0`, routing-key behavior is designed around this distinction:

- concrete configured `routingKey` values can be used when publishing
- topic wildcard patterns like `#` and `order.*` are treated as binding patterns
- explicit publish options still override the routing key

That means this binding stays safe:

```ts
.exchange("orders.ex", {
  exchangeType: "topic",
  routingKey: "order.*",
});
```

Rabbit Relay does not publish messages with `order.*` just because the binding pattern is `order.*`.

It continues publishing event messages with concrete event names like:

```text
order.created
```

This avoids turning binding patterns into publish routing keys by accident.

---

## A simple rule of thumb

Use this mental model:

```text
event name:
  what happened

publish routing key:
  how this message enters RabbitMQ routing

binding pattern:
  what this queue wants to receive
```

In many apps:

```text
event name = publish routing key
```

Example:

```text
order.created
```

And queues bind with patterns:

```text
order.*
```

That is a simple and maintainable default.

---

## Final thought

RabbitMQ topic routing is not complicated once the roles are clear.

The main thing is to avoid mixing up these three ideas:

```text
event name
publish routing key
binding pattern
```

A concrete event like:

```text
order.created
```

is a good publish routing key.

A pattern like:

```text
order.*
```

is usually a good binding pattern.

Keeping that distinction clear makes RabbitMQ systems easier to reason about, easier to debug, and safer to operate.

That is also the philosophy behind Rabbit Relay:

> Keep RabbitMQ explicit, but make it safer and cleaner to use in TypeScript services.

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

Launch post:

```text
https://bitspacerlabs.github.io/rabbit-relay/blog/rabbit-relay-1-0
```
