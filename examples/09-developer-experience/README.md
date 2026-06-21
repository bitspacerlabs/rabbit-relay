# Developer Experience

**What it shows:** several Rabbit Relay developer experience APIs in one small flow.

This example demonstrates:

- `withHeaders()`
- `withCorrelation()`
- `traceFrom()`
- local middleware with `use()`
- consumer de-duplication with `consume({ dedupe })`
- message size guard with `maxMessageBytes`
- typed RPC with `request<TReply>()`

---

## Run

```bash
# terminal 1
npx ts-node-dev --transpile-only examples/09-developer-experience/consumer.ts

# terminal 2
npx ts-node-dev --transpile-only examples/09-developer-experience/publisher.ts
```

---

## Expected behavior

The consumer shows middleware logs.

The duplicate event is skipped by `consume({ dedupe })`.

The publisher catches a typed `MessageTooLargeError`.

The RPC request receives a typed reply.

---

## Production takeaway

Use these helpers to keep service code readable while still carrying operational metadata such as headers, correlation IDs, causation IDs, and typed request/reply behavior.
