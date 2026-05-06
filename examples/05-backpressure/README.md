# Backpressure – End-to-End Flow Control

**What this example shows:** how Rabbit Relay naturally applies **backpressure**
when consumers are slow, preventing runaway publishers and unbounded memory usage.

This is a **real production concern** in microservices systems.

---

## Why backpressure matters

In real systems:

- producers may be much faster than consumers
- consumers may slow down due to DB latency, APIs, or CPU pressure
- without backpressure, publishers can OOM or crash

This example proves that:

- publishers automatically slow down
- consumer capacity dictates throughput
- no custom throttling logic is required

---

## Files

```text
examples/05-backpressure/
├─ publisher.fast.ts
├─ consumer.slow.ts
├─ consumer.fast.ts
└─ README.md
```

Topology:

- Exchange: `bp.demo`
- Queue: `bp_queue`
- Routing key: `bp.msg`

---

## How it works

There are two layers of flow control working together.

### 1. Consumer-side backpressure

- `prefetch` limits how many messages RabbitMQ can deliver without ACKs
- `concurrency` limits how many handlers Rabbit Relay runs at once
- slow handlers make messages pile up in the queue instead of app memory

### 2. Publisher-side backpressure

- when RabbitMQ's socket buffer fills, `channel.publish()` returns `false`
- Rabbit Relay waits for the `drain` event
- publisher pauses safely instead of flooding memory

---

## Run the demo

### 1) Start a slow consumer

```bash
PREFETCH=10 BP_SLOW_MS=200 \
npx ts-node-dev --transpile-only examples/05-backpressure/consumer.slow.ts
```

Expected:

- messages processed slowly
- queue backlog grows
- publisher eventually pauses

---

### 2) Start the publisher

```bash
BP_MSG_SIZE=256000 \
npx ts-node-dev --transpile-only examples/05-backpressure/publisher.fast.ts
```

Watch for logs like:

```text
[amqp] publish backpressure: waiting for 'drain'
[amqp] drain resolved after 327ms
```

These lines mean **backpressure is active**.

---

### 3) Switch to a fast consumer

```bash
PREFETCH=100 \
npx ts-node-dev --transpile-only examples/05-backpressure/consumer.fast.ts
```

Result:

- backpressure logs largely disappear
- throughput increases automatically

---

## Tuning knobs

### Publisher

```bash
BP_MSG_SIZE=256000
BP_TOTAL=50000
```

### Consumer

```bash
PREFETCH=10
CONCURRENCY=10
BP_SLOW_MS=200
```

---

## Observing queue backlog

```bash
docker exec -it rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
```

---

## Production takeaways

- Always await `produce()`
- Tune `prefetch` and `concurrency` to real processing capacity
- Prefer smaller messages where possible
- Backpressure is a feature, not a problem
- Combine with DLQ, retries, idempotent consumers, and metrics
