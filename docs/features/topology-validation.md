# Topology Validation

Topology validation checks whether the planned RabbitMQ topology exists.

It is safe and passive.

It does not declare or modify RabbitMQ resources.

---

## Basic usage

```ts
const result = await broker.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

You can also validate one broker interface:

```ts
const result = await sub.validateTopology();
```

---

## What is validated

Rabbit Relay validates:

- exchanges exist
- queues exist

It uses AMQP passive checks.

---

## What is not deeply validated yet

Bindings are included in the topology plan, but they are not passively validated through `amqplib`.

RabbitMQ does not expose a simple safe binding check through the normal AMQP channel API.

Validation results include informational issues:

```text
binding_not_validated
```

This does not make the result invalid.

---

## Result shape

```ts
type TopologyValidationResult = {
  valid: boolean;
  issues: TopologyValidationIssue[];
};
```

Issue examples:

```ts
{
  type: "missing_queue",
  queue: "orders.q",
  message: "Queue 'orders.q' does not exist"
}
```

```ts
{
  type: "binding_not_validated",
  queue: "orders.q",
  exchange: "orders.ex",
  routingKey: "orders.*",
  message: "Binding was included in the plan but not passively validated..."
}
```

---

## When to use validation

Use topology validation when RabbitMQ topology is managed outside the application by:

- Helm
- Terraform
- RabbitMQ definitions
- DevOps setup scripts
- manual infrastructure setup

---

## Validation vs assertion vs planning

Topology assertion creates or re-declares resources.

Topology validation only checks existing resources.

Topology planning only returns known topology data.

| API / mode | Contacts RabbitMQ | Modifies RabbitMQ |
|---|---:|---:|
| `.exchange(...)` with `topologyMode: "assert"` | ✅ | ✅ |
| `.exchange(...)` with `topologyMode: "passive"` | ✅ | ❌ |
| `.exchange(...)` with `topologyMode: "plan-only"` | ❌ | ❌ |
| `planTopology()` | ❌ | ❌ |
| `validateTopology()` | ✅ | ❌ |

---

## Passive startup mode

If you want Rabbit Relay to perform passive checks during startup, use `topologyMode: "passive"`.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    topologyMode: "passive",
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

Use `validateTopology()` when you want an explicit result object instead of startup failure behavior.

```ts
const result = await sub.validateTopology();

if (!result.valid) {
  throw new Error("RabbitMQ topology is not ready");
}
```

---

## CI / review mode

Use `topologyMode: "plan-only"` when you want to build the topology plan without RabbitMQ setup calls.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    topologyMode: "plan-only",
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(sub.planTopology());
```

Then validate separately in an environment where RabbitMQ is available:

```ts
const result = await sub.validateTopology();
```

---

## passiveQueue compatibility

`passiveQueue` is still supported for backward compatibility, but it is narrower than topology modes.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    passiveQueue: true,
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

For infrastructure-managed topology, prefer:

```ts
topologyMode: "passive"
```

See [Topology Modes](/features/topology-modes).

---

## Summary

- `validateTopology()` is passive
- It checks exchanges and queues exist
- It does not modify RabbitMQ
- Binding validation is informational for now
- Use `topologyMode: "passive"` for passive startup checks
- Use `topologyMode: "plan-only"` for CI/docs/review planning
- Useful for infrastructure-managed environments
