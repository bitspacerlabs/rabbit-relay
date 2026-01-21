# EventEnvelope

`EventEnvelope` is the **canonical message format** used by Rabbit Relay.
All events published and consumed by the framework conform to this shape.

---

## Type definition

```ts
type EventEnvelope<T = unknown> = {
  id: string;          // unique identifier (used for idempotency & de-duplication)
  name: string;        // event name (e.g. "scheduler.scheduleTask")
  version?: string;   // optional semantic version (e.g. "v1")
  time?: number;      // epoch timestamp (ms)
  data: T;            // typed payload
  meta?: EventMeta;   // optional metadata
};

type EventMeta = {
  headers?: Record<string, unknown>;
  corrId?: string;        // correlation id
  expectsReply?: boolean; // RPC
  timeoutMs?: number;     // RPC timeout
};
```

---

## Creating envelopes

You normally don’t create envelopes manually.
Instead, use an **event factory**:

```ts
const scheduleTask =
  event("scheduler.scheduleTask", "v1")
    .of<{ id: string; when: number }>();

const ev = scheduleTask({
  id: "task-1",
  when: Date.now(),
});
```

Factories ensure:
- correct event name
- consistent versioning
- typed payloads

---

## Metadata usage

Metadata is optional and additive.

```ts
ev.meta = {
  corrId: "req-123",
  headers: { source: "scheduler" },
};
```

Metadata is commonly used for:
- tracing
- RPC
- cross-service correlation

---

## Notes

- `id` is generated automatically by the factory
- delivery semantics remain **at-least-once**
- consumers should be idempotent

---

## Summary

`EventEnvelope` is the stable contract between publishers and consumers.
Factories help you create envelopes safely and consistently.
