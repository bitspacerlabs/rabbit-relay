# CLI Reference

Rabbit Relay ships with a built-in CLI for topology planning, validation,
diffing, and DLQ management.

```bash
npx rabbit-relay help
```

---

## Connection URL

Commands that contact RabbitMQ resolve the connection URL in this order:

1. `--url <amqp-url>` flag
2. `RABBITMQ_URL` environment variable
3. `amqp://localhost`

---

## `plan <script>`

Generate a topology plan by running a setup script in plan-only mode.

| Flag | Description |
|------|-------------|
| `--output <file>` | Write plan JSON to a file instead of stdout |

**Details:** [Topology Planner](/features/topology-planner)

```bash
npx rabbit-relay plan ./setup.mjs > plan.json
npx rabbit-relay plan ./setup.mjs --output plan.json
```

---

## `validate <plan.json>`

Validate a topology plan against a live RabbitMQ broker.

| Flag | Default | Description |
|------|---------|-------------|
| `--url <url>` | `RABBITMQ_URL` or `amqp://localhost` | RabbitMQ connection URL |

Exit code: `0` on valid, `1` on blocking issues.

**Details:** [Topology Validation](/features/topology-validation)

```bash
npx rabbit-relay validate plan.json --url amqp://user:pass@localhost:5672
```

---

## `diff <plan-a.json> <plan-b.json>`

Compare two topology plans and show added/removed exchanges, queues, and
bindings.

```bash
npx rabbit-relay diff plan.json plan.production.json
```

Output:

```
# Exchanges only in first plan (new):
+ orders.ex (topic, durable)

# Queues only in second plan (missing):
- orders.q

# Bindings only in first plan (new):
+ orders.q → orders.ex [routingKey: "orders.*"]

Plans are identical.
```

---

## `dlq inspect <queue>`

Show dead-letter queue depth, message count, and consumer count.

| Flag | Default | Description |
|------|---------|-------------|
| `--url <url>` | `RABBITMQ_URL` or `amqp://localhost` | RabbitMQ connection URL |

```bash
npx rabbit-relay dlq inspect orders.dlq
npx rabbit-relay dlq inspect orders.dlq --url amqp://localhost
```

Output (JSON):

```json
{ "queue": "orders.dlq", "messageCount": 42, "consumerCount": 0 }
```

---

## `dlq peek <queue>`

View messages in a dead-letter queue without removing them. Messages are
returned to the queue when the peek consumer is cancelled.

| Flag | Default | Description |
|------|---------|-------------|
| `--limit <N>` | `1` | Max messages to peek (max 100) |
| `--url <url>` | `RABBITMQ_URL` or `amqp://localhost` | RabbitMQ connection URL |

```bash
npx rabbit-relay dlq peek orders.dlq
npx rabbit-relay dlq peek orders.dlq --limit 5 --url amqp://localhost
```

---

## `dlq redrive <from-queue> <to-exchange>`

Redrive messages from a dead-letter queue to a target exchange.

| Flag | Default | Description |
|------|---------|-------------|
| `--routing-key <key>` | Original message routing key | Target routing key |
| `--limit <N>` | `100` | Max messages to redrive |
| `--dry-run` | - | Validate without consuming |
| `--url <url>` | `RABBITMQ_URL` or `amqp://localhost` | RabbitMQ connection URL |

Exit code: `0` on success, `1` if any messages failed.

**Details:** [Dead-Letter Queues](/features/dead-letter-queues)

```bash
npx rabbit-relay dlq redrive orders.dlq orders.ex
npx rabbit-relay dlq redrive orders.dlq orders.ex --limit 50
npx rabbit-relay dlq redrive orders.dlq orders.ex --dry-run
npx rabbit-relay dlq redrive orders.dlq orders.ex --routing-key "orders.fixed"
```

---

## `help`

Show the help text with all commands, options, and examples.

```bash
npx rabbit-relay help
npx rabbit-relay dlq help
```

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Validation failure, missing entity, unexpected error |

The `dlq redrive` command exits with `1` when one or more messages fail.

---

## CI usage

A typical CI pipeline generates a plan from application code, validates it
against a staging broker, and compares it with a known production plan:

```bash
# 1. Generate the topology plan from the application code
npx rabbit-relay plan ./ci/topology.mjs > plan.json

# 2. Validate against a staging RabbitMQ
npx rabbit-relay validate plan.json --url "$RABBITMQ_URL"

# 3. Compare against the production plan (generated earlier)
npx rabbit-relay diff plan.json plan.production.json
```

The `plan` command runs a setup script in plan-only mode. The script must
export a default function (or named export `setup`) that receives a
`RabbitMQBroker` instance:

```js
// ci/topology.mjs
import { RabbitMQBroker } from "@bitspacerlabs/rabbit-relay";

export default function (broker) {
  broker
    .queue("orders.q")
    .exchange("orders.ex", {
      exchangeType: "topic",
      routingKey: "orders.*",
      deadLetter: {
        exchange: "orders.dlx",
        queue: "orders.dlq",
        autoDeclare: true,
      },
    });
}
```

---

## Generating plans programmatically

You can also build the plan in code and write it to JSON yourself:

```ts
import { RabbitMQBroker } from "@bitspacerlabs/rabbit-relay";

const broker = new RabbitMQBroker("ci", {
  topologyMode: "plan-only",
});

await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(JSON.stringify(broker.planTopology(), null, 2));
```

---

## Related

| Page | Description |
|------|-------------|
| [Topology Planner](/features/topology-planner) | Generating topology plans |
| [Topology Validation](/features/topology-validation) | Validating plans against RabbitMQ |
| [Dead-Letter Queues](/features/dead-letter-queues) | DLQ config and redrive |
