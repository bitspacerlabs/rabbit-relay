# Plugins

Plugins let you add **cross‑cutting behavior**—logging, metrics, tracing, headers, guards—without touching business logic.

They are small async hooks that run at **well‑defined points** during publishing and consuming.

This page focuses on **how to use plugins**, not full implementations.

---

## What plugins are for

Use plugins when you want to apply the same behavior to **all messages** in a service:

- add or read headers (correlation IDs, source, trace IDs)
- log publish / consume activity
- emit metrics
- integrate tracing
- enforce lightweight guards or checks

Plugins run automatically for every publish and consume operation.

---

## Lifecycle overview

**Publish**
```
beforeProduce → publish → afterProduce
```

**Consume**
```
beforeProcess → handler → afterProcess
```

- Hooks run **sequentially**, in registration order
- Hooks are awaited
- If a hook throws, the error is logged and execution continues

---

## Plugin interface

A plugin is a plain object with optional async hooks.

```ts
import type { EventEnvelope } from "rabbit-relay";

export interface Plugin {
  beforeProduce?(event: EventEnvelope): Promise<void>;
  afterProduce?(event: EventEnvelope, result: unknown): Promise<void>;

  beforeProcess?(
    id: string | number,
    event: EventEnvelope
  ): Promise<void>;

  afterProcess?(
    id: string | number,
    event: EventEnvelope,
    result: unknown
  ): Promise<void>;
}
```

All hooks must be `async` and return `Promise<void>`.

---

## Registering plugins

Plugins are registered **once at process startup**.

```ts
import { pluginManager } from "rabbit-relay";
import { loggerPlugin } from "./loggerPlugin";

pluginManager.register(loggerPlugin());
```

- Registration order matters
- Plugins are **process‑global**
- Register before creating brokers or starting consumers

---

## Minimal plugin example

```ts
import type { Plugin } from "rabbit-relay";

export function loggerPlugin(): Plugin {
  return {
    async beforeProduce(evt) {
      console.log("Producing", evt.name, evt.id);
    },
    async beforeProcess(_id, evt) {
      console.log("Handling", evt.name, evt.id);
    },
  };
}
```

That’s enough to hook into every publish and consume call.

---

## Modifying metadata

Plugins commonly read or write `evt.meta`.

```ts
async beforeProduce(evt) {
  evt.meta = {
    ...(evt.meta ?? {}),
    headers: {
      ...(evt.meta?.headers ?? {}),
      source: "payments_service",
      ts: Date.now(),
    },
  };
}
```

Prefer adding fields rather than overwriting existing ones.

---

## Error behavior

- Plugin errors are **logged**
- They do **not** stop publishing or consuming
- Handlers are still invoked

Plugins should be fast and non‑blocking.

---

## Best practices

- Keep hooks lightweight (they run on the hot path)
- Avoid heavy I/O inside hooks
- Be idempotent (messages may be re‑delivered)
- Register plugins once, early in process startup
- Use plugins for cross‑cutting concerns only

---

## What plugins do not do

Plugins do **not**:
- change RabbitMQ delivery guarantees
- retry messages
- manage topology
- replace application‑level logic

They are an extension mechanism, not middleware.

---

## Summary

- Plugins add reusable behavior across publishers and consumers
- Hooks are explicit and predictable
- Registration is process‑wide and ordered
- No hidden behavior or magic

Simple, flexible, and production‑safe.
