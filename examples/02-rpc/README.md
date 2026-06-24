## RPC (Basics)

This example shows **RPC-style request/response** using RabbitMQ.

A requester sends a message and waits for a typed reply from a responder.

---

### Files

- `responder.ts`  
  Handles `payments.charge` requests and returns a response.

- `requester.ts`  
  Sends one RPC request using the typed `request<TReply>()` API.

---

### Run

```bash
# terminal 1 – start the responder
npx ts-node-dev --transpile-only examples/02-rpc/responder.ts

# terminal 2 – run the requester
npx ts-node-dev --transpile-only examples/02-rpc/requester.ts
```

---

### How it works

```ts
const reply = await cli.request<Res>(
  charge(payload),
  { timeoutMs: 5000 }
);
```

Rabbit Relay creates a temporary reply queue, sets `replyTo` and `correlationId`, publishes the request, and resolves with the typed reply.

The old `meta.expectsReply` style still works for backward compatibility, but `request<TReply>()` is the recommended API for new code.
