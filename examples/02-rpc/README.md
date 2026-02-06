## RPC (Basics)

This example shows **RPC-style request/response** using RabbitMQ.

A requester sends a message and waits for a reply from a responder.

---

### Files

- `responder.ts`  
  Handles `payments.charge` requests and returns a response.

- `requester.ts`  
  Sends one RPC request and waits for the reply.

---

### Run

```bash
# terminal 1 – start the responder
npx ts-node-dev --transpile-only examples/02-rpc/responder.ts

# terminal 2 – run the requester
npx ts-node-dev --transpile-only examples/02-rpc/requester.ts
```

---

### Expected Output

**Requester**
```
[Requester] sending charge request
[Requester] reply: { ok: true, transactionId: "txn_ab12cd" }
```

**Responder**
```
[Responder] waiting for payments.charge
[Responder] charging 42 USD for o-1001
```

---

### How it works

1. The requester publishes a message with:
   - `expectsReply: true`
   - a timeout

2. The library:
   - creates a temporary reply queue
   - sets `replyTo` and `correlationId`

3. The responder:
   - processes the request
   - returns a value

4. The requester:
   - receives the reply
   - resolves the promise

---

### Takeaway

- This is **messaging-based RPC**, not HTTP
- Replies are normal messages
- Timeouts are expected
- Use this pattern for internal service communication
