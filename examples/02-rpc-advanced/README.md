# RPC - Advanced (Payments Authorization)

**What it shows:** a production-style RPC workflow built on top of RabbitMQ messaging, demonstrating concurrency control, slow responders, timeouts, partial failures, and mixed RPC / fire-and-forget messages.

This example builds on **RPC - Basics** and is intended for **advanced users**.

---

## Files

- `requester.ts`  
  Sends many concurrent RPC requests with a configurable timeout and concurrency limit.

- `responder.ts`  
  Normal payments authorization responder with simple business rules.

- `responder.slow.ts`  
  Intentionally slow responder to demonstrate backpressure, queue buildup, and requester timeouts.

- `poison.sender.ts`  
  Publishes a non-RPC “poison” message (no reply expected) to show mixed event + RPC usage.

---

## Run

### 1) Start a responder (choose one)

```bash
# normal responder
npx ts-node-dev --transpile-only examples/02-rpc-advanced/responder.ts

# OR slow responder (simulates downstream slowness)
npx ts-node-dev --transpile-only examples/02-rpc-advanced/responder.slow.ts
```

---

### 2) Run the requester

```bash
npx ts-node-dev --transpile-only examples/02-rpc-advanced/requester.ts
```

---

### 3) (Optional) Send a poison message

```bash
npx ts-node-dev --transpile-only examples/02-rpc-advanced/poison.sender.ts
```

---

## Expect

- multiple RPC requests in flight concurrently
- replies arriving **out of order**
- **timeouts when the responder is slow**
- responder may still process requests **after the requester timed out**
- successful and declined authorizations
- requester continuing safely despite partial failures
- poison messages being processed as regular events (no reply)

---

## ⚠ Important: Understanding Timeouts (Read This)

When using `responder.slow.ts`, you may see logs like:

```text
[requester] ✖ error for ord_2: Timeout waiting for reply
```

while the responder later logs:

```text
[responder.slow] approved ord_2 -> slow_xxxxx
```

This is **expected behavior**.

### What a timeout means

A timeout means:

> **“The requester stopped waiting for a reply.”**

It does **NOT** mean:

> “The responder did not receive or process the request.”

### Why this happens

- The requester sends multiple RPC requests concurrently
- The slow responder processes requests **one at a time**
- Each request takes longer than the requester’s timeout
- Replies arrive **after** the requester has given up waiting

RabbitMQ does **not cancel work** when a requester times out.

---

## Environment variables

### Requester
- `TOTAL` – total number of RPC requests to send
- `CONCURRENCY` – max in-flight requests
- `RPC_TIMEOUT_MS` – per-request timeout

### Responders
- `WORK_MS` – artificial processing delay
- `PREFETCH` – consumer prefetch count
- `FAIL_IF_AMOUNT=1` – simulate intermittent failures

---

## What this example demonstrates

- **Asynchronous RPC over messaging**
- **Backpressure** using `prefetch`
- **Timeout handling** on the requester
- **Work continuing after timeouts**
- **Partial failure tolerance**
- **Multiple responders** on the same routing key
- **Mixed RPC and fire-and-forget messages**

---

## Production notes

- This is **not synchronous HTTP**
- Timeouts do **not** cancel in-flight work
- Replies may arrive late or never
- Retrying RPC requests may cause duplicate processing
- RPC handlers **must be idempotent**
- This pattern is production-safe for internal services and workflows

For stronger guarantees (exactly-once effects), combine with:
- database unique constraints
- idempotency keys
- transactional outbox patterns

---

## Notes

- RabbitMQ does not provide built-in RPC semantics
- This implementation follows standard AMQP RPC patterns
- Temporary reply queues are process-local and cleaned up automatically
