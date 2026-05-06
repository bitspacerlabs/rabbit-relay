# Graceful Shutdown

Rabbit Relay supports graceful shutdown through `broker.close()`.

This is important for tests, Docker, Kubernetes, and production deploys.

---

## Basic usage

```ts
const broker = new RabbitMQBroker("orders-service");

process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## What close does

`broker.close()` attempts to:

- stop active consumers
- cancel consumer subscriptions
- stop reconnect attempts
- close the normal channel
- close the confirm channel
- close the RabbitMQ connection

---

## Why it matters

Graceful shutdown helps prevent:

- hanging Node.js processes
- abandoned consumers
- duplicate work during deploys
- test processes that never exit

---

## Kubernetes example

```ts
process.on("SIGTERM", async () => {
  console.log("Stopping RabbitMQ broker...");
  await broker.close();
  console.log("RabbitMQ broker stopped");
  process.exit(0);
});
```

---

## Shared connection note

Rabbit Relay currently uses a process-level shared RabbitMQ connection.

That means calling:

```ts
await broker.close();
```

closes the shared connection used by Rabbit Relay in this process.

This matches the current architecture and keeps shutdown simple.

---

## Summary

- Use `broker.close()` during shutdown
- Handles consumers, channels, and connection cleanup
- Useful for tests and production services
- Safe to call during process termination
