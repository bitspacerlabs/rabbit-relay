# RPC (Request–Reply)

Rabbit Relay supports a request–reply pattern on top of RabbitMQ.

RPC allows a publisher to send a request and wait for a single reply from a consumer, using standard AMQP semantics: `replyTo`, `correlationId`, and timeouts.

RPC is opt-in per message and does not affect normal fire-and-forget events.

---

## When to use RPC

Use RPC only when a workflow requires a direct response.

Good examples:

- validate a payment
- check inventory
- request a calculated value
- ask another internal service for a decision

If a workflow can be modeled as events, prefer events.

RPC introduces tighter coupling and should be used deliberately.

---

## Typed request API

The recommended API is `request<TReply>()`.

```ts
type ChargeReply = {
  ok: boolean;
  transactionId?: string;
  reason?: string;
};

const reply = await pub.request<ChargeReply>(
  charge({
    orderId: "o-1",
    amount: 42,
    currency: "USD",
  }),
  {
    timeoutMs: 5000,
  }
);
```

This is cleaner than manually setting RPC metadata.

---

## Request options

`request()` accepts the same per-message publish options as `publish()`, plus `timeoutMs`.

```ts
const reply = await pub.request<ChargeReply>(
  charge(payload),
  {
    timeoutMs: 5000,
    routingKey: "payments.charge",
    maxMessageBytes: 64 * 1024,
    amqp: {
      publish: {
        persistent: true,
      },
    },
  }
);
```

---

## Handling an RPC request

On the consumer side, the handler return value becomes the reply.

```ts
sub.handle("payments.charge", async (_id, ev) => {
  if (ev.data.amount <= 0) {
    return {
      ok: false,
      reason: "invalid amount",
    };
  }

  return {
    ok: true,
    transactionId: "txn_123",
  };
});
```

Consumers do not need special RPC code.

If the message has `replyTo`, Rabbit Relay sends the return value back.

---

## Backward compatibility

The old metadata-based RPC style still works.

```ts
const req = charge(payload);

req.meta = {
  expectsReply: true,
  timeoutMs: 5000,
};

const reply = await pub.produce(req);
```

Use `request<TReply>()` for new code.

---

## Timeouts and errors

- Default timeout: `5000 ms`
- Timeouts reject on the caller side
- Handler errors return `null` as the reply
- Publish failures reject

```ts
try {
  const reply = await pub.request<Reply>(req, {
    timeoutMs: 5000,
  });

  if (reply === null) {
    // responder failed
  }
} catch (err) {
  // timeout or publish failure
}
```

---

## What Rabbit Relay manages

For each RPC request, Rabbit Relay:

- creates a temporary exclusive reply queue
- sets `replyTo`
- sets `correlationId`
- matches replies to requests
- enforces timeout
- cleans up the reply queue

---

## What RPC does not guarantee

RPC does not provide:

- exactly-once delivery
- cancellation of in-flight work after timeout
- transactional semantics across services
- consumer-side success guarantees

If a requester times out, the responder may still process the message later.

---

## Best practices

- Prefer events for workflows
- Use RPC for short internal decisions or queries
- Keep replies small
- Keep timeouts short
- Make RPC handlers idempotent
- Avoid long-running handlers

---

## Summary

- Use `request<TReply>()` for new RPC flows
- Handler return value becomes the reply
- Timeouts and failures are explicit
- Built on normal RabbitMQ semantics
