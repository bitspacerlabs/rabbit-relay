# Topology Planner

Topology planner returns the RabbitMQ topology Rabbit Relay knows about.

It is read-only.

It does not contact RabbitMQ.

It does not declare or modify RabbitMQ resources.

---

## Basic usage

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

## Plan shape

```ts
type TopologyPlan = {
  exchanges: TopologyExchangePlan[];
  queues: TopologyQueuePlan[];
  bindings: TopologyBindingPlan[];
};
```

Example output:

```ts
{
  exchanges: [
    {
      name: "orders.ex",
      type: "topic",
      durable: true,
    },
  ],
  queues: [
    {
      name: "orders.q",
      durable: true,
    },
  ],
  bindings: [
    {
      queue: "orders.q",
      exchange: "orders.ex",
      routingKey: "orders.*",
    },
  ],
}
```

---

## Topology mode and planning

`planTopology()` is always read-only.

`topologyMode` controls what happens during `.exchange(...)`.

| Mode | `planTopology()` | RabbitMQ topology changes |
|---|---:|---:|
| `"assert"` | ✅ | ✅ |
| `"passive"` | ✅ | ❌ |
| `"plan-only"` | ✅ | ❌ |

By default, `.exchange(...)` asserts topology because the default `topologyMode` is `"assert"`.

If you set `topologyMode: "plan-only"`, Rabbit Relay still records the plan but skips topology setup calls.

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

See [Topology Modes](/features/topology-modes).

---

## Planning dead-letter topology

If you configure dead-letter topology, the plan includes it.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });
```

Plan includes:

- main exchange
- main queue
- main binding
- dead-letter exchange
- dead-letter queue
- DLQ binding
- main queue dead-letter arguments

---

## Broker-level plan

`broker.planTopology()` returns the merged plan for all broker interfaces created from that broker.

```ts
const fullPlan = broker.planTopology();
```

---

## Interface-level plan

`sub.planTopology()` returns the plan for that queue/exchange interface only.

```ts
const subPlan = sub.planTopology();
```

---

## Use cases

Topology planner helps with:

- docs
- CI checks
- debugging
- DevOps reviews
- comparing app-declared topology with infrastructure
- generating expected topology output

---

## Planner vs validation

`planTopology()` only returns the topology data Rabbit Relay already knows.

For passive checks against RabbitMQ, use [Topology Validation](/features/topology-validation).

For topology ownership behavior, use [Topology Modes](/features/topology-modes).

---

## Important notes

- `planTopology()` does not require a RabbitMQ connection
- `planTopology()` does not create resources
- plans include bindings, even though AMQP passive binding validation is limited
- use `topologyMode: "plan-only"` for CI/docs/review workflows

---

## Summary

- `planTopology()` is read-only
- No RabbitMQ changes are made by the planner
- Plans include exchanges, queues, bindings, and configured DLQ topology
- `topologyMode` controls whether `.exchange(...)` asserts, validates, or only plans
- Useful for DevOps and production reviews
