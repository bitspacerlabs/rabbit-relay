# Publisher Confirms

Publisher confirms let you **know for sure** whether RabbitMQ accepted your message.
When enabled, Rabbit Relay waits for the broker to **ACK or NACK** a publish before returning.

---

## When publisher confirms matter

Publisher confirms are useful when your application must **synchronously know** whether RabbitMQ accepted a publish.

They provide a delivery acknowledgement **from the broker**, not from consumers.

Use confirms when your code must:
- block until the broker confirms receipt
- react immediately to publish failures
- treat publishing as part of a larger transactional boundary


---

## Enabling publisher confirms

Publisher confirms are enabled **per exchange**.

```ts
const pub = await broker
  .queue("orders_queue")
  .exchange("orders_exchange", {
    exchangeType: "topic",
    publisherConfirms: true, // enable confirms
  });
```

That’s it.

From this point on:
- every `produce()` waits for a broker ACK
- a broker NACK (or timeout) causes the call to reject

---

## Publishing with confirms

Once enabled, publishing does **not change**.

```ts
await pub.produce(eventEnvelope);
```

Or, using the `.with()` helper:

```ts
const api = pub.with({ orderCreated });
await api.orderCreated({ id: "o-1", total: 50 });
```

If the broker:
- **ACKs** → the promise resolves
- **NACKs** or disconnects → the promise rejects

You decide what to do next (retry, alert, park, etc.).

---

## What Rabbit Relay guarantees

With `publisherConfirms: true`:

- Messages are sent on a **confirm channel**
- Rabbit Relay waits for broker acknowledgement
- Transient disconnects are retried once automatically
- Backpressure is handled safely

What it does **not** guarantee:
- consumer processing success
- exactly-once delivery by itself

For stronger guarantees, combine confirms with:
- idempotent consumers
- de-duplication
- dead-letter queues

---

## Common mistakes

### Forgot to enable confirms

If `publisherConfirms` is not set, publishing uses a normal channel and never waits for ACKs.

### Expecting retries forever

Rabbit Relay retries **once** on transient reconnects.
After that, failures are surfaced to your code intentionally.

### Confirms replace error handling

They don’t.
Confirms only tell you whether the broker accepted the message — not whether a consumer handled it.

---

## Recommended usage

- Enable confirms for **critical event boundaries**
- Keep them off for high-volume, non-critical streams
- Always handle publish errors explicitly

---

## Summary

- Publisher confirms are **opt-in**
- Enable them per exchange
- Publishing APIs stay the same
- Errors are explicit and actionable

Simple, predictable, and production-safe.
