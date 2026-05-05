# Health + Shutdown

**What it shows:** production lifecycle features: `broker.health()` and `broker.close()`.

This example is useful for services that need readiness checks, dashboards, or Kubernetes shutdown behavior.

---

## Files

- `service.ts`  
  Starts a consumer, prints broker health, and closes cleanly on shutdown.

---

## Run

```bash
npx ts-node-dev --transpile-only examples/08-health-shutdown/service.ts
```

In another terminal, stop it with `Ctrl+C`.

---

## What to notice

The service prints health periodically:

```ts
const health = await broker.health();
console.log(health);
```

And shuts down cleanly:

```ts
process.on("SIGINT", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Example health shape

```ts
{
  peerName: "health.service",
  connected: true,
  channelOpen: true,
  confirmChannelOpen: false,
  reconnecting: false,
  consumers: [
    {
      queue: "health.demo.q",
      active: true,
      prefetch: 10,
      concurrency: 2,
      activeHandlers: 0,
      pendingMessages: 0,
      onError: "ack"
    }
  ]
}
```

---

## Production takeaway

Use `broker.health()` for readiness endpoints and dashboards.

Use `broker.close()` for Kubernetes `SIGTERM`, Docker shutdown, and clean test teardown.
