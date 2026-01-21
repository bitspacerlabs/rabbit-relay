# Auto Reconnect

Rabbit Relay automatically handles **temporary RabbitMQ outages** and resumes work when the connection is restored.
No manual reconnect logic is required.

This page explains **what auto-reconnect does and what to expect**, without diving into internal details.

---

## What auto-reconnect means

When the RabbitMQ connection or channel is closed (broker restart, network issue, credential rotation), Rabbit Relay will:

- retry the connection with backoff
- create a fresh channel
- re-assert declared exchanges and queues
- re-bind queues using the original routing keys
- restore prefetch and resume consumers
- continue publishing once the broker is available again

Your application process stays running throughout.

---

## What is restored automatically

After reconnect, Rabbit Relay restores:

- exchanges and queues declared by your code
- bindings between queues and exchanges
- consumer handlers
- prefetch / QoS settings
- publisher confirms (if enabled)

No additional setup is needed.

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

- the publish will fail
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

## Topology ownership

Rabbit Relay can either **own topology** or **attach to existing infrastructure**.

- If your application declares queues/exchanges → auto-reconnect re-asserts them
- If infrastructure declares them → prefer `passiveQueue: true` to avoid conflicts

Topology changes should not be made concurrently by both sides.

---

## Best practices

- Make handlers idempotent
- Expect at-least-once delivery
- Handle publish errors explicitly
- Use publisher confirms for critical messages
- Avoid changing queue arguments at runtime

---

## Summary

- Auto-reconnect is automatic and always on
- Consumers and publishers resume after outages
- No special APIs are required
- RabbitMQ semantics remain explicit and unchanged

Reliable, predictable, and production-safe.
