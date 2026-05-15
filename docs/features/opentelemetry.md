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

- `reconnect`
- `topology.asserted`
- `consumer.started`
- `consumer.stopped`
- `publish.failed`
- `retry.scheduled`
- `broker.closed`

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

Spans include useful attributes such as:

```text
messaging.system = rabbitmq
rabbit-relay.lifecycle.event
rabbit-relay.peer
messaging.destination.name
messaging.rabbitmq.queue
messaging.rabbitmq.routing_key
rabbit-relay.retry.count
rabbit-relay.retry.delay_ms
```

---

## Publish failures

For `publish.failed`, the adapter records the exception and marks the span as error.

---

## Retry scheduled

For `retry.scheduled`, the adapter records retry details and attaches the original handler error as span information.

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
- Adapter can be detached
- Core package stays lightweight
