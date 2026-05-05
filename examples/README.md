# Examples index

This directory contains runnable examples that demonstrate Rabbit Relay behavior
using real RabbitMQ patterns. Each folder focuses on **one concept**.

---

## Bring up RabbitMQ locally

```bash
docker compose -f examples/docker-compose.yml up -d
# RABBITMQ_URL defaults to amqp://user:password@localhost
```

RabbitMQ Management UI:

```text
http://localhost:15672
user / password
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

### 01 — Publisher Confirms + Dedupe

Reliable publishing with broker acknowledgements.

- confirm publishing
- consumer-side de-duplication

---

### 02 — RPC

Request / reply over RabbitMQ.

- request/reply pattern
- timeouts
- prefetch and concurrency

---

### 03 — Dead Letter Queues (DLQ)

Immediate failure routing using the built-in `deadLetter` helper.

- failed messages
- DLX/DLQ topology
- `onError: "dead-letter"`

---

### 04 — Plugins

Extending behavior without touching business logic.

- plugin definition
- lifecycle hooks
- logging, metrics, headers, tracing

---

### 05 — Backpressure

What happens when publishers are faster than consumers.

- fast publisher
- slow consumer
- observable queue growth
- natural RabbitMQ flow control

This example demonstrates **healthy overload behavior**, not failure.

---

### 06 — Retry + DLQ

Bounded retries before dead-lettering.

- `onError: "retry"`
- retry metadata headers
- final `then: "dead-letter"`

---

### 07 — amqplib Escape Hatch

Native RabbitMQ / `amqplib` access when needed.

- queue passthrough options
- exchange passthrough options
- publish options
- raw channel access

---

### 08 — Health + Shutdown

Production lifecycle APIs.

- `broker.health()`
- `broker.close()`
- shutdown signal handling

---

## Housekeeping

Useful commands while experimenting.

### List queues

```bash
docker exec -it rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged arguments
```

### List exchanges

```bash
docker exec -it rabbitmq rabbitmqctl list_exchanges name type durable
```

### Delete a specific queue

```bash
docker exec -it rabbitmq rabbitmqctl delete_queue orders.queue
```

### Reset local RabbitMQ data

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```
