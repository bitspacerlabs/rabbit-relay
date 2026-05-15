# Topology Planner

Topology planner returns the RabbitMQ topology Rabbit Relay intends to declare.

It is read-only and does not contact RabbitMQ.

---

## Basic usage

```ts
const broker = new RabbitMQBroker("orders-service");

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(sub.planTopology());
console.log(broker.planTopology());
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

Example:

```json
{
  "exchanges": [
    {
      "name": "orders.ex",
      "type": "topic",
      "durable": true
    }
  ],
  "queues": [
    {
      "name": "orders.q",
      "durable": true
    }
  ],
  "bindings": [
    {
      "queue": "orders.q",
      "exchange": "orders.ex",
      "routingKey": "orders.*"
    }
  ]
}
```

---

## DLQ topology

If you use the `deadLetter` helper, the plan includes DLX/DLQ topology.

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
- future validation workflows

---

## Important note

Calling `.exchange(...)` still asserts topology as usual.

`planTopology()` only returns the topology data Rabbit Relay already knows.

For passive checks against RabbitMQ, use [Topology Validation](/features/topology-validation).

---

## Summary

- `planTopology()` is read-only
- No RabbitMQ changes are made by the planner
- Plans include exchanges, queues, and bindings
- Useful for DevOps and production reviews
