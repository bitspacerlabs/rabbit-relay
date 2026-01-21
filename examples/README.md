# Examples index

This directory contains runnable examples that demonstrate Rabbit Relay behavior
using real RabbitMQ patterns. Each folder focuses on **one concept**.

---

## Bring up RabbitMQ locally

```bash
docker compose -f examples/docker-compose.yml up -d
# RABBITMQ_URL defaults to amqp://user:password@localhost
```

---

## Run an example

```bash
npx ts-node-dev --transpile-only <path-to-example>
```

Most examples require **multiple terminals** (publisher + consumer).

---

## Example index

### 00 — Basics

Foundational routing patterns.

- `direct/` — routing by key  
- `fanout/` — broadcast to all  
- `topic-microservices/` — simple multi-service flow  

---

### 01 — Publisher Confirms

Reliable publishing with broker acknowledgements.

- confirm publishing
- consumer-side de-duplication

---

### 02 — RPC

Request / reply over RabbitMQ.

- request/reply pattern
- prefetch & concurrency

---

### 03 — Dead Letter Queues (DLQ)

Failure handling using RabbitMQ primitives.

- pure RabbitMQ DLQ behavior

---

### 04 — Plugins

Extending behavior without touching business logic.

- plugin definition
- lifecycle hooks

---

### 05 — Backpressure

What happens when publishers are faster than consumers.

- fast publisher
- slow consumer
- observable queue growth
- natural RabbitMQ flow control

This example demonstrates **healthy overload behavior**, not failure.

---

## Housekeeping

Useful commands while experimenting.

### List queues

```bash
docker exec -it rabbitmq   rabbitmqctl list_queues name messages_ready messages_unacknowledged arguments
```

### Delete a specific queue (example)

```bash
docker exec -it rabbitmq   rabbitmqctl delete_queue direct.q.alpha.1
```
