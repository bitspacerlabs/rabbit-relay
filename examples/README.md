# Rabbit Relay Examples

This folder contains runnable examples for Rabbit Relay.

Start RabbitMQ first:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Most examples can be run with:

```bash
npx ts-node-dev --transpile-only examples/<example-folder>/<file>.ts
```

---

## Examples

| Example | What it shows |
|---|---|
| `00-basics/direct` | Direct exchange routing by exact routing key |
| `00-basics/fanout` | Fanout broadcast to multiple queues |
| `00-basics/topic-microservices` | Small event-driven microservices flow |
| `01-confirms` | Publisher confirms vs normal publish |
| `01-confirms/dedupe` | Consumer-side de-duplication |
| `02-rpc` | Basic typed request/reply flow |
| `02-rpc-advanced` | RPC timeouts, slow responders, concurrency, poison messages |
| `03-dlq` | Dead-letter queue basics |
| `04-plugins` | Cross-cutting plugin hooks for logging, headers, metrics, tracing |
| `05-backpressure` | Publisher and consumer backpressure |
| `06-retry-dlq` | Immediate retry followed by DLQ |
| `07-escape-hatch` | Native `amqplib` options and raw channel access |
| `08-health-shutdown` | Health checks and graceful shutdown |
| `09-developer-experience` | Headers, tracing metadata, middleware, dedupe, size guard, RPC |
| `10-delayed-retry` | Delayed retry using TTL + DLX |
| `11-lifecycle-hooks` | Broker lifecycle events |
| `12-opentelemetry` | OpenTelemetry lifecycle adapter |
| `13-topology-planner` | Read-only topology planning with `topologyMode: "plan-only"` |
| `14-topology-validation` | Passive validation of existing RabbitMQ topology |
| `15-dlq-redrive` | Moving messages from DLQ back to a target exchange |
| `16-topology-modes` | `assert`, `passive`, and `plan-only` topology modes |

---

## Recommended learning order

1. Start with `00-basics/direct` or `00-basics/fanout`.
2. Learn reliability with `01-confirms`, `03-dlq`, `06-retry-dlq`, and `10-delayed-retry`.
3. Learn service patterns with `02-rpc`, `02-rpc-advanced`, and `09-developer-experience`.
4. Learn operations with `08-health-shutdown`, `11-lifecycle-hooks`, `12-opentelemetry`, and `15-dlq-redrive`.
5. Learn topology ownership with `13-topology-planner`, `14-topology-validation`, and `16-topology-modes`.

---

## Local reset

RabbitMQ queue arguments are immutable. If you change queue options and get a precondition error, reset the local RabbitMQ volume:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

---

## Production note

Examples are intentionally small and focused. They demonstrate library behavior, not a complete production architecture.

For production systems, combine Rabbit Relay with:

- idempotent handlers
- bounded retries
- DLQ monitoring
- publisher confirms for important messages
- topology ownership rules using `topologyMode`
- observability through lifecycle hooks, plugins, or OpenTelemetry
