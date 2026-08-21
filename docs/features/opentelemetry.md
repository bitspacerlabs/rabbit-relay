# OpenTelemetry Adapter

Rabbit Relay provides an OpenTelemetry lifecycle adapter.

The adapter listens to lifecycle hooks and creates spans for operational events.

---

## Design

Rabbit Relay does not force OpenTelemetry as a runtime dependency.

Your application owns OpenTelemetry setup and passes a tracer to Rabbit Relay.

```ts
import { RabbitMQBroker, attachOpenTelemetry } from "@bitspacerlabs/rabbit-relay";
import { trace } from "@opentelemetry/api";

const broker = new RabbitMQBroker("orders-service");

const otel = attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "orders-service",
});
```

---

## Detach

`attachOpenTelemetry()` returns a detach handle.

```ts
otel.detach();
```

This removes registered lifecycle listeners.

---

## Events traced

The adapter listens to:

| Event | Description |
|---|---|
| `reconnect` | Broker re-established connection |
| `topology.asserted` | Exchange, queue, and bindings declared |
| `topology.failed` | Topology assert or passive check failed |
| `topology.restored` | Topology and consumers restored after reconnect |
| `consumer.started` | Consumer registered on a queue |
| `consumer.stopped` | Consumer cancelled |
| `publish.failed` | Publish rejected or errored |
| `retry.scheduled` | Handler failed, retry copy published |
| `broker.closed` | Broker shut down |
| `handler.completed` | Handler finished (success or error) |
| `message.dead-lettered` | Message sent to dead-letter queue |
| `message.dropped` | Message dropped (acked) after retry exhaustion or `onError: "ack"` |

---

## Disable specific events

```ts
attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  disabledEvents: ["broker.closed"],
});
```

---

## Custom span prefix

Default span names use:

```text
rabbit-relay.<event>
```

Example:

```text
rabbit-relay.consumer.started
```

You can change the prefix:

```ts
attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  spanPrefix: "messaging.rabbit-relay",
});
```

---

## Attributes

Spans include these attributes:

```text
messaging.system              = rabbitmq
rabbit-relay.lifecycle.event
rabbit-relay.peer
messaging.destination.name
messaging.rabbitmq.queue
messaging.rabbitmq.routing_key
rabbit-relay.retry.count
rabbit-relay.retry.delay_ms
rabbit-relay.handler.duration_ms  (handler.completed only)
messaging.message.type             (event name)
```

**Payload data is never recorded** in span attributes or events.
Only metadata (event name, queue, routing key, duration) is included.

---

## Publish failures

For `publish.failed`, the adapter records the exception and marks the span as error.

---

## Retry scheduled

For `retry.scheduled`, the adapter records retry details and attaches the original handler error as span information.

---

## Handler completed

For `handler.completed`, the adapter records the event name, queue,
and handler duration in milliseconds. If the handler threw, the span
is marked as error with the error message.

---

## Metrics from lifecycle events

Every lifecycle event is available as a hook - you can build counters,
histograms, and gauges from them:

```ts
// Example: prometheus-style counters using lifecycle hooks
const handlerTotal = new Map<string, number>();

broker.on("handler.completed", (ev) => {
  const key = ev.eventName;
  handlerTotal.set(key, (handlerTotal.get(key) ?? 0) + 1);
});

broker.on("message.dead-lettered", (ev) => {
  console.warn(`DLQ: ${ev.eventName} on ${ev.queue}`);
});
```

Common metric patterns:

| Metric | Source event |
|---|---|
| `rabbit_relay_publish_total` | `publish.failed` (errors) or custom hook on `produce()` |
| `rabbit_relay_handler_duration` | `handler.completed.durationMs` |
| `rabbit_relay_consume_total` | `handler.completed` |
| `rabbit_relay_retry_total` | `retry.scheduled` |
| `rabbit_relay_dead_letter_total` | `message.dead-lettered` |
| `rabbit_relay_connection_state` | `reconnect`, `broker.closed` |

---

## Example

```ts
const broker = new RabbitMQBroker("payments-service");

attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "payments-service",
});

broker.on("retry.scheduled", (event) => {
  console.log("retry scheduled", event);
});
```

You can use lifecycle hooks and OpenTelemetry together.

---

## Summary

- OpenTelemetry is optional
- You pass your own tracer
- Rabbit Relay maps lifecycle events to spans
- Payload data is never recorded in spans
- Lifecycle hooks double as a metrics data source
- Adapter can be detached
- Core package stays lightweight
