# Topology Ownership

RabbitMQ topology means:

- exchanges
- queues
- bindings
- dead-letter exchanges
- dead-letter queues
- retry queues

A key production question is:

```text
Who creates these resources?
```

Rabbit Relay makes that choice explicit with `topologyMode`.

---

## The three ownership modes

```ts
type TopologyMode = "assert" | "passive" | "plan-only";
```

| Mode | Who owns topology? | What Rabbit Relay does |
|---|---|---|
| `"assert"` | application | declares topology |
| `"passive"` | infrastructure | checks topology exists |
| `"plan-only"` | CI/docs/review | records topology plan only |

Default:

```ts
topologyMode: "assert"
```

---

## App-owned topology

Use app-owned topology when the application is allowed to create RabbitMQ resources.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "assert",
});
```

Rabbit Relay declares:

- exchange
- queue
- binding
- configured DLQ topology
- delayed retry topology when used

This is good for:

- local development
- tests with disposable RabbitMQ
- small systems where the app owns RabbitMQ setup
- production systems where app-owned topology is acceptable

---

## Infrastructure-owned topology

Use infrastructure-owned topology when resources are created before the app starts.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Rabbit Relay checks required exchanges and queues exist.

It does not declare or bind topology.

This is good when topology is managed by:

- Terraform
- Helm
- Kubernetes jobs
- RabbitMQ definitions
- DevOps setup scripts

If topology is missing, startup fails early.

---

## Plan-only topology

Use plan-only mode when you want topology output without RabbitMQ setup calls.

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "plan-only",
});

const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });

console.log(sub.planTopology());
console.log(broker.planTopology());
```

This is good for:

- CI checks
- documentation
- DevOps review
- generating expected topology
- comparing app topology with infrastructure code

---

## Exchange-level override

You can set topology mode on the broker:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

And override it for one interface:

```ts
const sub = await broker
  .queue("local.dev.q")
  .exchange("local.dev.ex", {
    topologyMode: "assert",
  });
```

Exchange-level settings override broker defaults.

---

## Topology planner

`planTopology()` is always read-only.

```ts
const plan = broker.planTopology();
```

It returns what Rabbit Relay knows about the topology.

It does not create resources.

Use `topologyMode: "plan-only"` when you want to build plans without calling RabbitMQ topology setup APIs.

---

## Topology validation

`validateTopology()` checks whether planned exchanges and queues exist.

```ts
const result = await broker.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

It does not declare or modify resources.

Bindings are included in plans, but AMQP does not expose a simple safe binding check through `amqplib`.

So binding validation is informational.

---

## Delayed retry topology

Delayed retry may need retry exchanges and retry queues.

`topologyMode` applies to that too.

| Mode | Delayed retry behavior |
|---|---|
| `"assert"` | declare retry exchange, retry queue, and binding |
| `"passive"` | check retry exchange and retry queue exist |
| `"plan-only"` | skip retry topology setup |

---

## passiveQueue compatibility

`passiveQueue` still exists for backward compatibility.

```ts
await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    passiveQueue: true,
  });
```

But it only affects the main queue declaration behavior.

For new infrastructure-managed deployments, prefer:

```ts
topologyMode: "passive"
```

It is clearer and applies to topology behavior as a whole.

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

## Common mistakes

### Changing queue arguments after creation

RabbitMQ queue arguments are immutable.

Changing arguments on an existing queue can cause a precondition failure.

Fix by:

- deleting the queue in development
- creating a new queue version
- managing topology through infrastructure
- using passive mode when infra owns topology

### Using assert in infra-owned production

If infrastructure owns topology, do not let the app declare it.

Use:

```ts
topologyMode: "passive"
```

### Using plan-only for runtime consumers

`plan-only` skips topology setup calls.

Use it for CI/docs/review, not normal runtime consumers unless topology is handled elsewhere and you intentionally want no startup checks.

---

## Summary

- Topology ownership should be explicit
- Use `"assert"` when the app owns topology
- Use `"passive"` when infrastructure owns topology
- Use `"plan-only"` for CI/docs/review
- Prefer `topologyMode` over `passiveQueue` in new code
