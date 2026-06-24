# Topology Modes

This example demonstrates Rabbit Relay topology modes.

Topology modes control what Rabbit Relay does when `.exchange(...)` is called.

---

## Modes

### `assert`

Default behavior.

Rabbit Relay declares:

- exchange
- queue
- dead-letter topology if configured
- queue binding

```ts
topologyMode: "assert"
```

---

### `passive`

Rabbit Relay checks that planned exchanges and queues already exist.

It does **not** declare or bind topology.

This is useful when RabbitMQ topology is managed by:

- Helm
- Terraform
- RabbitMQ definitions
- DevOps setup scripts

```ts
topologyMode: "passive"
```

---

### `plan-only`

Rabbit Relay only builds the topology plan.

It does **not** call RabbitMQ topology APIs.

This is useful for:

- CI checks
- docs
- DevOps review
- topology previews

```ts
topologyMode: "plan-only"
```

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
```

Run:

```bash
npx ts-node-dev --transpile-only examples/16-topology-modes/service.ts
```

---

## Expected output

You should see:

```text
[assert] topology created
[passive] topology exists
[plan-only] plan generated without RabbitMQ assertion
```

The plan-only topology uses fake queue/exchange names, but it should still succeed because it does not touch RabbitMQ.

---

## Example

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    topologyMode: "plan-only",
  });

console.log(sub.planTopology());
```

---

## Notes

- `assert` is the default and preserves old behavior.
- `passive` checks exchanges and queues exist.
- `plan-only` only builds the plan.
- `passiveQueue` is still supported, but `topologyMode: "passive"` is preferred for full infra-managed topology.
