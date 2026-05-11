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

Most examples require **multiple terminals**.

---

## Example index

### 00 — Basics

- `direct/` — routing by key
- `fanout/` — broadcast to all
- `topic-microservices/` — simple multi-service flow

### 01 — Publisher Confirms + Dedupe

- confirm publishing
- consumer-side de-duplication with `consume({ dedupe })`

### 02 — RPC

- typed `request<TReply>()`
- timeouts
- prefetch and concurrency

### 03 — Dead Letter Queues

- failed messages
- DLX/DLQ topology
- `onError: "dead-letter"`

### 04 — Plugins

- global lifecycle hooks
- logging, metrics, headers, tracing

### 05 — Backpressure

- fast publisher
- slow consumer
- RabbitMQ flow control

### 06 — Retry + DLQ

- `onError: "retry"`
- retry metadata headers
- final `then: "dead-letter"`

### 07 — amqplib Escape Hatch

- queue/exchange passthrough options
- publish options
- raw channel access

### 08 — Health + Shutdown

- `broker.health()`
- `broker.close()`
- shutdown signal handling

### 09 — Developer Experience

- `request<TReply>()`
- `withHeaders()`
- `traceFrom()`
- local middleware with `use()`
- `consume({ dedupe })`
- `maxMessageBytes`
- `MessageTooLargeError`

---

## Housekeeping

### Reset local RabbitMQ data

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

### List queues

```bash
docker exec -it rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged arguments
```
