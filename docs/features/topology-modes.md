# Topology Modes

Topology modes control what Rabbit Relay does when a queue/exchange interface is created.

They are useful when different environments have different ownership rules for RabbitMQ topology.

---

## Why topology modes exist

In development, it is convenient for the application to create queues, exchanges, bindings, and retry/DLQ topology automatically.

In production, RabbitMQ topology is often managed outside the application by infrastructure tooling such as:

- Terraform
- Helm
- Kubernetes jobs
- RabbitMQ definitions
- DevOps setup scripts

Topology modes let you choose the correct behavior explicitly.

---

## Modes

```ts
type TopologyMode = "assert" | "passive" | "plan-only";
```

| Mode | Behavior | Best for |
|---|---|---|
| `"assert"` | Declare exchanges, queues, bindings, configured DLQ topology, and delayed retry topology | local development, app-owned topology |
| `"passive"` | Check required exchanges and queues exist without declaring them | production with infra-managed topology |
| `"plan-only"` | Build the topology plan but skip topology setup calls | CI, docs, DevOps review |

---

## Default mode: assert

`assert` is the default behavior.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

This mode calls RabbitMQ topology APIs such as:

- `assertExchange`
- `assertQueue`
- `bindQueue`

Use it when the application owns the topology.

---

## Passive mode

Use passive mode when infrastructure creates RabbitMQ topology before the application starts.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
    topologyMode: "passive",
  });
```

Rabbit Relay checks that required exchanges and queues exist.

If something is missing, startup fails early.

This helps catch deployment/configuration problems without modifying RabbitMQ topology.

---

## Plan-only mode

Use plan-only mode when you want Rabbit Relay to build its topology plan but not call RabbitMQ topology setup APIs.

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

This is useful for:

- CI checks
- topology review
- documentation
- generating expected RabbitMQ definitions
- comparing app topology with infrastructure code

---

## Broker-level default

You can set a default topology mode on the broker.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Exchange-level settings can override the broker default.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    topologyMode: "assert",
  });
```

---

## Recommended environment setup

| Environment | Recommended mode |
|---|---|
| Local development | `"assert"` |
| Tests with disposable RabbitMQ | `"assert"` |
| CI topology review | `"plan-only"` |
| Production with app-owned topology | `"assert"` |
| Production with infra-owned topology | `"passive"` |

---

## Relationship with topology planner

`planTopology()` is always read-only.

It returns what Rabbit Relay knows about the declared topology.

```ts
const plan = broker.planTopology();
```

`topologyMode` controls what happens during `.exchange(...)`.

| Mode | `planTopology()` | RabbitMQ topology changes |
|---|---:|---:|
| `"assert"` | ✅ | ✅ |
| `"passive"` | ✅ | ❌ |
| `"plan-only"` | ✅ | ❌ |

See [Topology Planner](/features/topology-planner).

---

## Relationship with topology validation

`validateTopology()` performs passive checks against RabbitMQ.

Passive mode uses the same idea during startup.

```ts
const result = await broker.validateTopology();
```

Use:

- `topologyMode: "passive"` to fail fast at startup
- `validateTopology()` when you want an explicit validation result object

See [Topology Validation](/features/topology-validation).

---

## Delayed retry topology

If you use delayed retry, Rabbit Relay may need retry exchanges and retry queues.

With `topologyMode: "assert"`, Rabbit Relay declares retry topology.

With `topologyMode: "passive"`, Rabbit Relay checks that retry topology already exists.

With `topologyMode: "plan-only"`, Rabbit Relay skips retry topology setup.

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

---

## passiveQueue compatibility

`passiveQueue` is still supported for backward compatibility.

It only makes the main queue check passive.

For infrastructure-managed topology, prefer:

```ts
topologyMode: "passive"
```

This is clearer because it applies to the topology behavior as a whole.

---

## Important notes

- `"passive"` checks exchanges and queues
- AMQP does not provide a simple safe binding check through `amqplib`
- bindings are still included in `planTopology()`
- `"plan-only"` skips topology setup calls
- normal publishing, consuming, validation, and redrive operations can still require a RabbitMQ connection
- queue arguments are immutable in RabbitMQ; changing them may require a new queue or recreation

---

## Summary

- Use `"assert"` when Rabbit Relay owns topology
- Use `"passive"` when infrastructure owns topology
- Use `"plan-only"` for CI/docs/review
- Prefer `topologyMode` over `passiveQueue` for new infrastructure-managed setups
