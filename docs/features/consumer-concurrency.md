# Consumer Concurrency

Rabbit Relay separates **RabbitMQ prefetch** from **handler concurrency**.

This gives you better control over throughput and service pressure.

---

## Prefetch vs concurrency

```ts
await sub.consume({
  prefetch: 50,
  concurrency: 10,
});
```

This means:

- RabbitMQ can deliver up to **50 unacknowledged messages**
- Rabbit Relay runs at most **10 handlers in parallel**
- Remaining delivered messages wait in memory until a handler finishes

---

## Why this matters

Without a concurrency limit, a consumer can overload:

- database pools
- downstream APIs
- CPU-heavy workers
- memory
- third-party services

`prefetch` controls RabbitMQ delivery pressure.

`concurrency` controls application execution pressure.

---

## Defaults

If `concurrency` is not set, it defaults to `prefetch`.

```ts
await sub.consume({
  prefetch: 20,
});
```

This allows up to 20 concurrent handlers.

If neither is set, both default to 1.

---

## Recommended settings

For I/O-heavy handlers:

```ts
await sub.consume({
  prefetch: 50,
  concurrency: 10,
});
```

For CPU-heavy handlers:

```ts
await sub.consume({
  prefetch: 5,
  concurrency: 2,
});
```

For strict sequential processing:

```ts
await sub.consume({
  prefetch: 1,
  concurrency: 1,
});
```

---

## Warning: concurrency greater than prefetch

If `concurrency` is greater than `prefetch`, RabbitMQ still cannot deliver more than `prefetch` unacknowledged messages.

```ts
await sub.consume({
  prefetch: 5,
  concurrency: 20,
});
```

Rabbit Relay will warn because practical concurrency is limited by prefetch.

---

## Summary

- `prefetch` controls unacknowledged messages from RabbitMQ
- `concurrency` controls parallel handler execution
- Use both together for predictable throughput
- Keep handlers idempotent because delivery is still at-least-once
