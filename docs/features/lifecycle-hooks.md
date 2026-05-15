# Lifecycle Hooks

Lifecycle hooks expose Rabbit Relay operational events.

They are useful for logging, metrics, OpenTelemetry, debugging, and production visibility.

---

## Basic usage

```ts
const broker = new RabbitMQBroker("orders-service");

broker.on("consumer.started", (event) => {
  console.log("consumer started", event.queue);
});

broker.on("retry.scheduled", (event) => {
  console.log("retry scheduled", event.retryCount, event.delayMs);
});
```

Returned broker interfaces also support lifecycle hooks:

```ts
const sub = await broker.queue("orders.q").exchange("orders.ex");

sub.on("consumer.started", (event) => {
  console.log(event.queue);
});
```

---

## Supported events

| Event | Meaning |
|---|---|
| `reconnect` | Broker reconnected |
| `topology.asserted` | Exchange/queue/binding topology was asserted |
| `consumer.started` | Consumer started |
| `consumer.stopped` | Consumer stopped |
| `publish.failed` | Publish failed after retry attempt |
| `retry.scheduled` | A retry was scheduled |
| `broker.closed` | Broker was closed |

---

## Retry scheduled example

```ts
broker.on("retry.scheduled", (event) => {
  console.log({
    queue: event.queue,
    exchange: event.exchange,
    routingKey: event.routingKey,
    retryCount: event.retryCount,
    attempts: event.attempts,
    delayMs: event.delayMs,
  });
});
```

---

## Publish failed example

```ts
broker.on("publish.failed", (event) => {
  console.error("publish failed", {
    exchange: event.exchange,
    routingKey: event.routingKey,
    eventName: event.eventName,
    error: event.error,
  });
});
```

---

## Lifecycle hooks vs plugins

| Feature | Lifecycle Hooks | Plugins |
|---|---|---|
| Scope | Broker instance | Process-wide |
| Focus | Operations events | Message lifecycle |
| API | `broker.on(...)` | `pluginManager.register(...)` |
| Best for | logging, metrics, tracing, operations | cross-cutting message behavior |

---

## Error behavior

If a lifecycle hook throws:

- the error is caught and logged
- Rabbit Relay continues running
- the broker operation is not blocked

Keep hooks lightweight and non-blocking.

---

## Summary

- Lifecycle hooks expose broker operations
- Useful for logging, metrics, and tracing
- Local to a broker instance
- Safe failure behavior
- Foundation for the OpenTelemetry adapter
