# Backpressure – End‑to‑End Flow Control

**What this example shows:** how Rabbit Relay naturally applies **backpressure**
when consumers are slow, preventing runaway publishers and unbounded memory usage.

This is a **real production concern** in microservices systems.

---

## Why backpressure matters

In real systems:
- producers may be **much faster** than consumers
- consumers may slow down due to DB latency, APIs, or CPU pressure
- without backpressure, publishers can **OOM or crash**

This example proves that:
- publishers **automatically slow down**
- consumer capacity dictates throughput
- no custom throttling logic is required

---

## Files

```
examples/05-backpressure/
├─ publisher.fast.ts      # publishes messages aggressively
├─ consumer.slow.ts       # slow consumer (simulates real processing)
├─ consumer.fast.ts       # fast consumer for comparison
└─ README.md
```

Topology (auto‑created):
- Exchange: `bp.demo` (topic)
- Queue: `bp.q`
- Routing key: `bp.msg`

---

## How it works (high level)

There are **two layers of flow control** working together:

### 1️⃣ Consumer‑side backpressure (RabbitMQ QoS)
- `prefetch` limits how many messages a consumer can handle at once
- slow handlers → messages pile up in the queue
- protects consumers from overload

### 2️⃣ Publisher‑side backpressure (TCP / Node streams)
- when RabbitMQ’s socket buffer fills,
  `channel.publish()` returns `false`
- Rabbit Relay **waits for the `'drain'` event**
- publisher pauses safely instead of flooding memory

---

## Run the demo

### 1) Start a slow consumer

```bash
PREFETCH=10 SLOW_MS=200 \
npx ts-node-dev --transpile-only examples/05-backpressure/consumer.slow.ts
```

Expected:
- messages processed slowly
- queue backlog grows
- publisher eventually pauses

---

### 2) Start the publisher

```bash
BP_MSG_SIZE=256000 PUBLISH_INTERVAL_MS=10 \
npx ts-node-dev --transpile-only examples/05-backpressure/publisher.fast.ts
```

Watch for logs like:

```
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
BP_MSG_SIZE=256000       # payload size in bytes
PUBLISH_INTERVAL_MS=10  # delay between sends (0 = tight loop)
PUBLISHER_CONFIRMS=false
```

### Consumer
```bash
PREFETCH=10
CONCURRENCY=10
SLOW_MS=200             # slow consumer only
```

---

## Observing queue backlog

```bash
rabbitmqctl list_queues name messages_ready messages_unacknowledged
```

- `messages_ready` grows when consumer is slow
- drains once consumer catches up
- publisher memory remains bounded

---

## What this proves

✅ Automatic publisher throttling  
✅ End‑to‑end flow control  
✅ No unbounded memory growth  
✅ Throughput adapts to consumer capacity  
✅ Safe for production workloads  

---

## Production takeaways

- Always **await `produce()`**
- Tune `prefetch` to real processing capacity
- Prefer smaller messages where possible
- Backpressure is **a feature**, not a problem
- Combine with:
  - DLQ for failures
  - idempotent consumers
  - metrics plugins for observability

---

## FAQ

**Is this a RabbitMQ feature?**  
Partially. RabbitMQ handles consumer QoS; TCP backpressure comes from Node streams.
Rabbit Relay ties them together safely.

**Do I need publisher confirms?**  
No. Confirms add stronger guarantees but also slower pacing.
This demo disables confirms to highlight pure backpressure behavior.

**Is this production‑ready?**  
Yes. This is how robust message‑driven systems stay stable under load.
