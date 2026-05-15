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

## Validation vs assertion

Topology assertion creates or re-declares resources.

Topology validation only checks existing resources.

| API | Contacts RabbitMQ | Modifies RabbitMQ |
|---|---:|---:|
| `.exchange(...)` | ✅ | ✅ |
| `planTopology()` | ❌ | ❌ |
| `validateTopology()` | ✅ | ❌ |

---

## Example flow

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    passiveQueue: true,
    exchangeType: "topic",
    routingKey: "orders.*",
  });

const result = await sub.validateTopology();

if (!result.valid) {
  throw new Error("RabbitMQ topology is not ready");
}
```

---

## Summary

- `validateTopology()` is passive
- It checks exchanges and queues exist
- It does not modify RabbitMQ
- Binding validation is informational for now
- Useful for infrastructure-managed environments
