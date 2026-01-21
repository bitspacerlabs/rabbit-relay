# RPC (Request–Reply)

Rabbit Relay supports a **request–reply (RPC) pattern** on top of RabbitMQ.

RPC allows a publisher to **send a request and wait for a single reply** from a consumer, using standard AMQP semantics (`replyTo`, `correlationId`, timeouts).

RPC is **opt-in per message** and does not affect normal fire-and-forget events.

---

## When to use RPC

Use RPC only when a workflow **requires a synchronous response**.

If a workflow can be modeled as **events**, prefer events.
RPC introduces tighter coupling and should be used deliberately.

---

## Making an RPC request

Any event can become an RPC request by setting metadata on its envelope.

```ts
const req = makePriceLookup({ sku: "SKU-1" });

req.meta = {
  expectsReply: true,
  timeoutMs: 5000,
};
```

Publishing the event now **returns a promise that resolves with the reply**:

```ts
const reply = await pub.produce(req);
```

- If a reply arrives → the promise resolves
- If no reply arrives before `timeoutMs` → the promise rejects
- If the responder throws → the promise resolves with `null`

---

## Handling an RPC request (consumer)

On the consumer side, **the handler return value becomes the reply**.

```ts
sub.handle("price.lookup", async (_id, ev) => {
  return { price: 42 };
});
```

If the handler:
- returns a value → it is sent back as the reply
- throws an error → a reply is still sent, with `null`

Consumers **do not need to know** whether a message is RPC or not.

---

## Timeouts and errors

- Default timeout: **5000 ms**
- Timeouts throw on the caller side
- Handler errors do **not** throw on the caller side — they return `null`

```ts
try {
  const reply = await pub.produce(req);
  if (reply === null) {
    // responder failed
  }
} catch (err) {
  // timeout or publish failure
}
```

---

## What Rabbit Relay manages for you

When `meta.expectsReply = true`, Rabbit Relay automatically:

- creates a temporary, exclusive reply queue
- sets `replyTo` and `correlationId`
- matches replies to requests
- enforces the timeout
- cleans up resources

---

## What RPC does *not* guarantee

RPC does **not** provide:
- exactly-once delivery
- transactional semantics across services
- consumer-side success guarantees

---

## Best practices

- Prefer events over RPC where possible
- Use RPC for **queries**, not workflows
- Avoid long-running handlers
- Keep replies small and bounded

---

## Summary

- RPC is opt-in per message
- Enabled via `meta.expectsReply`
- Handler return value becomes the reply
- Timeouts and failures are explicit
- Built on standard RabbitMQ semantics
