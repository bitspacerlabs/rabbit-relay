# Auto Reconnect

Rabbit Relay automatically handles **temporary RabbitMQ outages** and resumes work when the connection is restored.
No manual reconnect logic is required.

This page explains **what auto-reconnect does and what to expect**, without diving into internal details.

---

## What auto-reconnect means

When the RabbitMQ connection or channel is closed due to a broker restart, network issue, or credential rotation, Rabbit Relay will:

- retry the connection with backoff
- create a fresh channel
- re-apply topology behavior for existing broker interfaces
- restore prefetch and resume consumers
- continue publishing once the broker is available again

Your application process stays running throughout.

---

## What is restored automatically

After reconnect, Rabbit Relay restores:

- consumer handlers
- prefetch / QoS settings
- publisher confirms behavior, if enabled
- topology behavior based on `topologyMode`

No additional setup is needed.

---

## Topology ownership during reconnect

Rabbit Relay supports explicit topology ownership modes.

| Mode | Reconnect behavior |
|---|---|
| `"assert"` | Re-declares exchanges, queues, bindings, configured DLQ topology, and delayed retry topology |
| `"passive"` | Checks required exchanges and queues exist without declaring them |
| `"plan-only"` | Skips topology setup calls |

Use app-owned topology:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "assert",
});
```

Use infrastructure-owned topology:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "passive",
});
```

Use CI/docs/review mode:

```ts
const broker = new RabbitMQBroker("orders-service", {
  topologyMode: "plan-only",
});
```

`passiveQueue` remains supported for queue-only passive checks, but `topologyMode: "passive"` is preferred for new infrastructure-managed setups.

See [Topology Modes](/features/topology-modes).

---

## What to be aware of

Auto-reconnect does **not** change RabbitMQ delivery semantics.

- Messages that were delivered but not acknowledged may be re-delivered
- Consumers should be **idempotent**
- Delivery remains **at-least-once**

This is standard RabbitMQ behavior and applies regardless of library.

---

## Publishing during reconnects

If a publish happens while the broker is temporarily unavailable:

- the publish can fail
- Rabbit Relay retries once after reconnect
- with publisher confirms enabled, failures are surfaced explicitly

You should always handle publish errors in application code.

---

## Consumers and reconnects

Consumers automatically resume after reconnect using the same handlers.

You do **not** need to:

- re-register handlers
- restart your process
- re-call `consume()`

---

## Delayed retry during reconnect

Delayed retry topology follows `topologyMode` during startup and reconnect.

| Mode | Delayed retry behavior |
|---|---|
| `"assert"` | Declare retry exchange, retry queue, and binding |
| `"passive"` | Check retry exchange and retry queue exist |
| `"plan-only"` | Skip retry topology setup |

---

## Best practices

- Make handlers idempotent
- Expect at-least-once delivery
- Handle publish errors explicitly
- Use publisher confirms for critical messages
- Use `topologyMode: "passive"` when infrastructure owns topology
- Avoid changing queue arguments at runtime

---

## Summary

- Auto-reconnect is automatic
- Consumers and publishers resume after outages
- Topology behavior follows `topologyMode`
- RabbitMQ delivery semantics remain explicit and unchanged

Reliable, predictable, and production-safe.
