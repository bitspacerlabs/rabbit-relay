# Dead Letter Queue (DLQ) – Basics

**What it shows:** how failed messages are routed to a Dead Letter Queue (DLQ) instead of being retried forever.

This example demonstrates Rabbit Relay's built-in `deadLetter` helper, which configures RabbitMQ DLQ arguments for you.

---

## Files

- `publisher.ts`  
  Publishes normal and poison messages.

- `consumer.fail.ts`  
  Consumes messages from the main queue and intentionally fails on poison messages,
  causing them to be dead-lettered.

- `consumer.dlq.ts`  
  Consumes messages from the Dead Letter Queue for inspection or recovery.

---

## Topology

Rabbit Relay declares:

```text
orders.exchange  -> orders.queue
orders.dlx       -> orders.dlq
```

Main messages use:

```text
exchange:    orders.exchange
queue:       orders.queue
routing key: order.created
```

Failed messages are routed to:

```text
exchange:    orders.dlx
queue:       orders.dlq
routing key: orders.dead
```

---

## Run

```bash
# terminal 1 – start the failing consumer
npx ts-node-dev --transpile-only examples/03-dlq/consumer.fail.ts

# terminal 2 – start the DLQ consumer
npx ts-node-dev --transpile-only examples/03-dlq/consumer.dlq.ts

# terminal 3 – publish messages
npx ts-node-dev --transpile-only examples/03-dlq/publisher.ts
```

---

## Expect

- normal messages are processed successfully
- poison messages cause handler errors
- poison messages are routed to the DLQ
- no infinite retry loops
- DLQ consumer receives failed messages

---

## How it works

The main queue is declared with:

```ts
deadLetter: {
  exchange: "orders.dlx",
  queue: "orders.dlq",
  routingKey: "orders.dead",
  autoDeclare: true,
}
```

When the consumer throws and uses:

```ts
await sub.consume({
  onError: "dead-letter",
});
```

Rabbit Relay calls `nack(requeue=false)`, and RabbitMQ routes the message to the DLQ.

---

## Important note

RabbitMQ queue arguments are immutable.

If you previously ran the old DLQ example with the same queue names, RabbitMQ may reject the updated declaration with a precondition error.

For local development, delete the old queues/exchanges or reset the Docker volume:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

---

## Production notes

- Always monitor DLQ depth
- DLQs are a safety mechanism, not a normal workflow
- Investigate and fix poison messages
- Combine DLQs with bounded retries for transient failures
- Keep handlers idempotent

---

## Summary

- Rabbit Relay configures DLQ topology with `deadLetter`
- Consumers choose when to dead-letter using `onError: "dead-letter"`
- Failed messages are isolated instead of lost
