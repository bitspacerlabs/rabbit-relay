# Topology Validation

This example demonstrates Rabbit Relay topology validation mode.

Topology validation checks whether the planned RabbitMQ exchanges and queues exist.

It is intentionally safe and passive:

- it does not declare exchanges
- it does not declare queues
- it does not create bindings
- it does not modify RabbitMQ

---

## What it shows

- `sub.planTopology()`
- `sub.validateTopology()`
- `broker.validateTopology()`
- passive exchange checks
- passive queue checks
- binding validation limitation

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run:

```bash
npx ts-node-dev --transpile-only examples/14-topology-validation/service.ts
```

---

## Expected output

You should see:

```text
planned topology
sub.validateTopology()
broker.validateTopology()
```

The validation result may include:

```text
binding_not_validated
```

This is expected.

AMQP passive checks can safely check whether exchanges and queues exist, but RabbitMQ does not expose a simple passive binding check through `amqplib`.

---

## Example

```ts
const result = await sub.validateTopology();

if (!result.valid) {
  console.error(result.issues);
}
```

Broker-level validation:

```ts
const result = await broker.validateTopology();
```

---

## Validation result

Example shape:

```ts
{
  valid: true,
  issues: [
    {
      type: "binding_not_validated",
      queue: "validation.orders.q",
      exchange: "validation.orders.ex",
      routingKey: "orders.*",
      message: "Binding was included in the plan but not passively validated..."
    }
  ]
}
```

`binding_not_validated` is informational.

Blocking issues include:

- `missing_exchange`
- `missing_queue`
- `validation_error`

---

## Notes

This feature is useful when RabbitMQ topology is managed outside the application, for example by:

- Helm
- Terraform
- RabbitMQ definitions
- DevOps setup scripts
- manual infrastructure setup

Topology validation is the safe mode.

Topology assertion is still done by the normal `.exchange(...)` flow unless you intentionally use `passiveQueue` or future dry-run APIs.
