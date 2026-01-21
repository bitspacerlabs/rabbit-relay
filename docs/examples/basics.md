# Basics

This example demonstrates the **most fundamental RabbitMQ pattern** used in Rabbit Relay:
a **direct exchange** with explicit routing keys.

It is the best place to start if you want to understand how publishers and consumers
are wired together without abstractions.


## What this example shows

- One **publisher**
- Two **consumers**
- A **direct exchange**
- Messages routed explicitly using routing keys:
  - `alpha`
  - `beta`

Each consumer receives **only** the messages matching its routing key.


## How it works

1. The publisher sends messages alternately using routing keys `alpha` and `beta`
2. Each consumer binds its queue to the exchange using a single routing key
3. RabbitMQ delivers each message to the matching consumer only

This makes message routing **explicit, predictable, and easy to reason about**.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/00-basics/direct

```bash
# terminal 1
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.alpha.ts

# terminal 2
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.beta.ts

# terminal 3
npx ts-node-dev --transpile-only examples/00-basics/direct/publisher.ts
```


## Expected behavior

- `consumer.alpha` logs only messages published with `alpha`
- `consumer.beta` logs only messages published with `beta`

This confirms correct routing and isolation between consumers.

## More examples

Now that you understand direct routing, continue with:

- **[Fanout](https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/00-basics/fanout)** – Broadcast messages to all consumers
- **[Topic Microservices](https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/00-basics/topic-microservices)** – Pattern-based routing across services