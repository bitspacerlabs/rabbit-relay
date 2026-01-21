# Dead Letter Queue (DLQ) – Basics

**What it shows:** how failed messages are routed to a Dead Letter Queue (DLQ) instead of being retried forever.

This example demonstrates **pure RabbitMQ DLQ behavior** using queue configuration and consumer error handling.

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

1. The main queue is declared with:
   - `x-dead-letter-exchange`
   - `x-dead-letter-routing-key`
2. The consumer throws an error for poison messages.
3. The broker `nack`s the message with `requeue=false`.
4. RabbitMQ routes the message to the Dead Letter Exchange.
5. The message appears in the DLQ.

---

## Key points

- DLQ behavior is configured **on the queue**, not in application logic
- Consumers decide whether to:
  - acknowledge (`ack`)
  - retry (`requeue`)
  - dead-letter (`requeue=false`)
- Dead-lettered messages are **not lost**
- DLQs enable debugging, alerting, and safe recovery

---

## Production notes

- Always monitor DLQ depth
- DLQs are a safety mechanism, not a normal workflow
- Investigate and fix poison messages
- Consider adding:
  - retry limits
  - delayed retries
  - DLQ reprocessors

---

## Notes

- RabbitMQ does not retry messages automatically
- DLQ is a RabbitMQ feature, not a library feature
- This example uses standard AMQP behavior
