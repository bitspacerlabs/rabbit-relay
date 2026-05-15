# Health Checks

Rabbit Relay exposes runtime health information through `broker.health()`.

This is useful for service readiness endpoints, dashboards, and debugging.

---

## Basic usage

```ts
const health = await broker.health();

console.log(health);
```

Example response:

```ts
{
  peerName: "orders-service",
  connected: true,
  channelOpen: true,
  confirmChannelOpen: true,
  reconnecting: false,
  consumers: [
    {
      queue: "orders.q",
      active: true,
      prefetch: 20,
      concurrency: 5,
      activeHandlers: 2,
      pendingMessages: 8,
      onError: "retry",
      retry: {
        attempts: 3,
        then: "dead-letter",
        delayMs: 5000
      }
    }
  ]
}
```

---

## Express endpoint example

```ts
app.get("/health/rabbitmq", async (_req, res) => {
  const health = await broker.health();

  if (!health.connected || !health.channelOpen || health.reconnecting) {
    return res.status(503).json(health);
  }

  return res.json(health);
});
```

---

## Consumer state

Health output includes each registered consumer:

| Field | Meaning |
|---|---|
| `queue` | Queue name |
| `active` | Whether consuming is active |
| `prefetch` | RabbitMQ prefetch value |
| `concurrency` | Max handler concurrency |
| `activeHandlers` | Currently running handlers |
| `pendingMessages` | Delivered messages waiting in memory |
| `onError` | Error policy |
| `retry` | Retry policy, if enabled |

---

## Related operations APIs

Health is runtime status.

For deeper operations visibility, use:

- [Lifecycle Hooks](/features/lifecycle-hooks)
- [OpenTelemetry Adapter](/features/opentelemetry)
- [Topology Planner](/features/topology-planner)
- [Topology Validation](/features/topology-validation)
- [DLQ Redrive](/features/dlq-redrive)

---

## Best-effort status

`amqplib` does not expose a perfect public `isOpen()` API for channels and connections.

Rabbit Relay combines its own reconnect state with best-effort checks to report health.

Use this for:

- readiness checks
- debugging
- dashboards
- operational visibility

---

## Summary

- `broker.health()` returns connection and consumer state
- Useful for APIs and service readiness
- Includes concurrency, retry, delay, and pending-message info
- Health state is best-effort and operationally useful
