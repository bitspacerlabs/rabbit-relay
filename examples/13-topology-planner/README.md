# Topology Planner

This example demonstrates Rabbit Relay topology planning.

The topology planner returns the RabbitMQ topology Rabbit Relay intends to declare.

It does **not** validate RabbitMQ and does **not** change RabbitMQ state by itself.

---

## What it shows

- `sub.planTopology()`
- `broker.planTopology()`
- exchange plan
- queue plan
- binding plan
- dead-letter topology plan
- queue argument visibility

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run:

```bash
npx ts-node-dev --transpile-only examples/13-topology-planner/service.ts
```

---

## Expected output

You should see three printed plans:

```text
orders sub plan
audit sub plan
broker full plan
```

The orders plan should include:

```text
planner.orders.ex
planner.orders.q
planner.orders.dlx
planner.orders.dlq
orders.* binding
orders.dead DLQ binding
```

The broker full plan should include both:

```text
orders topology
audit topology
```

---

## Example

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

const plan = sub.planTopology();

console.log(plan);
```

---

## Notes

- `planTopology()` is read-only.
- It is useful for debugging, docs, CI, and DevOps reviews.
- It is the foundation for future topology validation mode.
