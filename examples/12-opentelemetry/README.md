# OpenTelemetry Adapter

This example demonstrates the Rabbit Relay OpenTelemetry lifecycle adapter.

The adapter listens to broker lifecycle hooks and creates spans from events such as:

- `topology.asserted`
- `consumer.started`
- `retry.scheduled`
- `broker.closed`

---

## Why fake tracer?

This example uses a small fake tracer so it can run without installing OpenTelemetry packages.

In a real app, use:

```ts
import { trace } from "@opentelemetry/api";

attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "orders-service",
});
```

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run:

```bash
npx ts-node-dev --transpile-only examples/12-opentelemetry/service.ts
```

---

## Expected output

You should see logs like:

```text
[otel] span started rabbit-relay.topology.asserted
[otel] span ended ...
[otel] span started rabbit-relay.consumer.started
[otel] span ended ...
[otel] span started rabbit-relay.retry.scheduled
[otel] exception ...
[otel] span ended ...
```

Press `Ctrl+C` and you should see shutdown-related lifecycle behavior.

---

## Real OpenTelemetry usage

```ts
import { RabbitMQBroker, attachOpenTelemetry } from "@bitspacerlabs/rabbit-relay";
import { trace } from "@opentelemetry/api";

const broker = new RabbitMQBroker("orders-service");

const otel = attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "orders-service",
});

// later
otel.detach();
```

---

## Notes

- Rabbit Relay does not force OpenTelemetry as a runtime dependency.
- Your application owns OpenTelemetry setup/exporters.
- The adapter only maps Rabbit Relay lifecycle events to spans.
- `otel.detach()` removes registered lifecycle listeners.
