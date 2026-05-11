# Middleware

Middleware lets you add local behavior around consumer handlers.

Unlike plugins, middleware is attached to one broker interface and affects only that queue/exchange flow.

---

## Why middleware exists

Plugins are process-global.

That is useful for shared behavior like logging, tracing, and metrics.

Middleware is local.

Use middleware when a specific consumer needs behavior such as:

- local logging
- tenant checks
- validation
- timing
- custom tracing
- lightweight authorization
- per-consumer guards

---

## Basic usage

```ts
sub.use(async (ctx, next) => {
  console.log("before", ctx.event.name);

  await next();

  console.log("after", ctx.event.name);
});

sub.handle("order.created", async (_id, ev) => {
  console.log("order:", ev.data);
});

await sub.consume();
```

---

## Middleware context

```ts
type ConsumeMiddlewareContext = {
  id: string | number;
  event: EventEnvelope;
  queue: string;
};
```

| Field | Meaning |
|---|---|
| `id` | RabbitMQ delivery tag |
| `event` | Parsed Rabbit Relay event envelope |
| `queue` | Queue currently consuming the message |

---

## Execution order

Middleware wraps the handler:

```text
plugin beforeProcess
  middleware 1 before
    middleware 2 before
      handler
    middleware 2 after
  middleware 1 after
plugin afterProcess
ack
```

If middleware throws, Rabbit Relay treats it like a handler error.

The configured error policy applies:

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    then: "dead-letter",
  },
});
```

---

## Multiple middleware

Middleware runs in registration order.

```ts
sub.use(async (ctx, next) => {
  console.log("first before");
  await next();
  console.log("first after");
});

sub.use(async (ctx, next) => {
  console.log("second before");
  await next();
  console.log("second after");
});
```

Output:

```text
first before
second before
handler
second after
first after
```

---

## Local validation example

```ts
sub.use(async (ctx, next) => {
  const tenantId = ctx.event.meta?.headers?.tenantId;

  if (!tenantId) {
    throw new Error("Missing tenantId");
  }

  await next();
});
```

---

## Timing example

```ts
sub.use(async (ctx, next) => {
  const start = Date.now();

  try {
    await next();
  } finally {
    console.log(`${ctx.event.name} took ${Date.now() - start}ms`);
  }
});
```

---

## Middleware vs plugins

| Feature | Middleware | Plugins |
|---|---|---|
| Scope | Local to broker interface | Process-wide |
| Registration | `sub.use(...)` | `pluginManager.register(...)` |
| Wraps handler | Yes | Hooks around lifecycle |
| Best for | Consumer-specific behavior | Shared platform behavior |

---

## What middleware does not expose yet

The first middleware API intentionally does not expose:

- raw RabbitMQ message
- channel
- manual ack/nack

This avoids double-ack bugs and keeps the API safe.

Advanced middleware can be added later if needed.

---

## Summary

- Middleware is local and explicit
- Use it for consumer-specific behavior
- It wraps handler execution
- Errors follow normal retry/DLQ behavior
- Plugins remain the better fit for process-wide concerns
