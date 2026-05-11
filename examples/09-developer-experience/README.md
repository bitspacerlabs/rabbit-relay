# Developer Experience

**What it shows:** the Phase 2 developer experience APIs in one small flow.

This example demonstrates:

- `withHeaders()`
- `traceFrom()`
- local middleware with `use()`
- consumer `dedupe`
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
