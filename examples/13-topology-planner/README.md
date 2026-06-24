# Topology Planner

This example demonstrates Rabbit Relay topology planning.

The topology planner returns the RabbitMQ topology Rabbit Relay knows about.

This example uses:

```ts
topologyMode: "plan-only"
```

That means it builds the topology plan without declaring exchanges, queues, or bindings in RabbitMQ.

---

## What it shows

- `sub.planTopology()`
- `broker.planTopology()`
- exchange plan
- queue plan
- binding plan
- dead-letter topology plan
- queue argument visibility
- plan-only topology review

---

## Run

This example does not need RabbitMQ because it uses `topologyMode: "plan-only"`.

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
const broker = new RabbitMQBroker("topology-planner.demo", {
  topologyMode: "plan-only",
});

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
- `topologyMode: "plan-only"` skips topology setup calls.
- This is useful for debugging, docs, CI, and DevOps reviews.
- Use `topologyMode: "assert"` when the application owns topology.
- Use `topologyMode: "passive"` when infrastructure owns topology.
