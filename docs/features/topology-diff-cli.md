# Topology Diff CLI

Rabbit Relay ships with a CLI for comparing and validating RabbitMQ topology plans.

---

## Installation

The CLI is included with `@bitspacerlabs/rabbit-relay`:

```bash
npm install @bitspacerlabs/rabbit-relay

# Run via npx
npx rabbit-relay help
```

---

## Commands

### `plan <script>`

Generate a topology plan by running a setup script in plan-only mode.

```bash
npx rabbit-relay plan ./setup.mjs > plan.json
```

The script must export a default function (or named export `setup`) that
receives a `RabbitMQBroker` instance:

```js
// setup.mjs
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

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

The topology plan is output as JSON with `exchanges`, `queues`, and `bindings`.

Options:

| Flag | Description |
|---|---|
| `--output <file>` | Write plan JSON to a file instead of stdout |

### `validate <plan.json>`

Validate a topology plan against a live RabbitMQ broker.

```bash
npx rabbit-relay validate plan.json --url amqp://user:pass@localhost:5672
```

This checks that every exchange and queue declared in the plan actually exists
on the broker. Binding validation is informational — AMQP has no passive
binding check through `amqplib`.

Output is a JSON result:

```json
{
  "valid": true,
  "issues": []
}
```

If resources are missing, the result includes issues:

```json
{
  "valid": false,
  "issues": [
    {
      "type": "missing_exchange",
      "exchange": "orders.ex",
      "message": "Exchange 'orders.ex' not found"
    }
  ]
}
```

Options:

| Flag | Default | Description |
|---|---|---|
| `--url <url>` | `RABBITMQ_URL` or `amqp://localhost` | RabbitMQ connection URL |

Exit code is `0` when valid, `1` when blocking issues exist.

### `diff <plan-a.json> <plan-b.json>`

Compare two topology plans and show differences.

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

## CI usage

Typical CI pipeline:

```bash
# 1. Generate the topology plan from the application code
npx rabbit-relay plan ./ci/topology.mjs > plan.json

# 2. Validate against a staging RabbitMQ
npx rabbit-relay validate plan.json --url "$RABBITMQ_URL"

# 3. Compare against the production plan (generated earlier)
npx rabbit-relay diff plan.json plan.production.json
```

---

## Generating plans programmatically

If you prefer not to use the `plan` command, generate the plan in your own code
and write it to a JSON file:

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
  })
  .consume({
    prefetch: 10,
    concurrency: 5,
  });

console.log(JSON.stringify(broker.planTopology(), null, 2));
```
