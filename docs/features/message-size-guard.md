# Message Size Guard

Rabbit Relay can protect publishers from accidentally sending oversized messages.

Large messages can hurt RabbitMQ performance and make systems harder to operate.

The message size guard checks the serialized event size before publishing.

---

## Why this exists

RabbitMQ works best with reasonably small messages.

Instead of publishing large payloads, prefer:

- storing large data in object storage
- publishing a file/object reference
- letting consumers fetch the large data when needed

---

## Broker-level default

Set a default max size on the broker:

```ts
const broker = new RabbitMQBroker("orders-service", {
  maxMessageBytes: 256 * 1024,
});
```

This applies to publishers created by this broker unless overridden.

---

## Exchange-level setting

```ts
const pub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    maxMessageBytes: 128 * 1024,
  });
```

---

## Per-message override

Use `publish()` when you need a per-message size limit.

```ts
await pub.publish(orderCreated(data), {
  maxMessageBytes: 64 * 1024,
});
```

`request()` also supports the same option:

```ts
const reply = await pub.request<Reply>(requestEvent, {
  timeoutMs: 5000,
  maxMessageBytes: 64 * 1024,
});
```

---

## Error type

If the serialized event is too large, Rabbit Relay throws `MessageTooLargeError`.

```ts
import { MessageTooLargeError } from "@bitspacerlabs/rabbit-relay";

try {
  await pub.publish(bigEvent, {
    maxMessageBytes: 8 * 1024,
  });
} catch (err) {
  if (err instanceof MessageTooLargeError) {
    console.error("Message too large:", {
      eventName: err.eventName,
      sizeBytes: err.sizeBytes,
      maxBytes: err.maxBytes,
    });
  }
}
```

---

## Precedence

Message size is resolved in this order:

```text
per-message option
exchange option
broker default
```

If none is set, Rabbit Relay does not enforce a max size.

---

## What is counted

Rabbit Relay checks the size of:

```ts
Buffer.from(JSON.stringify(eventEnvelope))
```

That means the full event envelope is counted, including:

- `id`
- `name`
- `v`
- `time`
- `data`
- `meta`

---

## Best practices

- Keep event payloads small
- Publish IDs and references instead of large blobs
- Store large payloads externally
- Set conservative limits for critical services
- Treat size errors as developer feedback

---

## Summary

- `maxMessageBytes` prevents oversized publishes
- works at broker, exchange, and per-message level
- throws a typed `MessageTooLargeError`
- encourages healthier RabbitMQ usage
