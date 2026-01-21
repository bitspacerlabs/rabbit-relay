# RPC – Basics

**What it shows:** request/response (RPC-style) communication built on top of RabbitMQ messaging using temporary reply queues and correlation IDs.

This demonstrates how to perform **asynchronous RPC over RabbitMQ** with timeouts, concurrency, and safe failure handling.

---

**Files**
- `responder.ts` – RPC server that handles requests and returns replies
- `requester.single.ts` – sends a single RPC request and awaits a reply
- `requester.load.ts` *(optional)* – sends many concurrent RPC requests to demonstrate throughput and backpressure

---

**Run**
```bash
# terminal 1 – start the RPC responder
npx ts-node-dev --transpile-only examples/rpc/responder.ts

# terminal 2 – send a single RPC request
npx ts-node-dev --transpile-only examples/rpc/requester.single.ts

# (optional) terminal 3 – run concurrent RPC load
npx ts-node-dev --transpile-only examples/rpc/requester.load.ts
```

---

**Expect**
- the requester publishes a request message with a temporary reply queue
- the responder processes the request and sends a reply
- the requester resolves with the responder’s response
- if the responder throws, the requester receives `null`
- if the responder is slow or unavailable, the requester times out

---

**How it works**
- the requester publishes a message with:
  - `replyTo` set to a temporary, exclusive queue
  - a unique `correlationId`
- the responder processes the message and publishes a reply to `replyTo`
- the requester listens on the temporary queue and matches replies by `correlationId`
- the temporary queue is deleted after the reply or timeout

---

**Environment variables**
- `TIMEOUT_MS` – how long the requester waits for a reply (default: 3–5s)
- `CONCURRENCY` – max in-flight requests (load test)
- `N` – total number of requests to send (load test)
- `SLOW_MS` – artificial delay in the responder (for testing)
- `FAIL_IF_AMOUNT=1` – simulate responder failures

---

**Production notes**

- This is **asynchronous RPC over messaging**, not synchronous HTTP
- Requests may timeout even if the responder eventually processes them
- Retries may result in duplicate processing
- Handlers should be **idempotent**
- This pattern is production-safe for internal services and workflows

For stronger guarantees (exactly-once effects), combine with:
- database constraints
- idempotency keys
- transactional outbox patterns

---

**Notes**
- RabbitMQ does not provide built-in RPC semantics; this is an application-level pattern
- This implementation follows standard AMQP RPC best practices
- Temporary reply queues are process-local and cleaned up automatically
