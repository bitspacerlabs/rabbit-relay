# Compatibility Check: 0.6.1 -> 0.7.0

Use this checklist to make sure existing Rabbit Relay `0.6.1` users can upgrade to `0.7.0` without changing their code.

---

## Goal

These old APIs should still work:

- `produce()`
- `produceMany()`
- `consume()`
- `with()`
- `publisherConfirms`
- RPC using `meta.expectsReply`
- plugins
- TTL dedupe
- backpressure
- manual `queueArgs`

---

## Before testing

Start clean:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
npm run build
```

---

## 1. Basics

### Direct exchange

Run:

```bash
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.alpha.ts
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.beta.ts
npx ts-node-dev --transpile-only examples/00-basics/direct/publisher.ts
```

Expected:

- alpha consumer receives alpha messages
- beta consumer receives beta messages

### Fanout exchange

Run:

```bash
npx ts-node-dev --transpile-only examples/00-basics/fanout/consumer.a.ts
npx ts-node-dev --transpile-only examples/00-basics/fanout/consumer.b.ts
npx ts-node-dev --transpile-only examples/00-basics/fanout/publisher.ts
```

Expected:

- both consumers receive all messages

---

## 2. Publisher confirms

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.with.ts
```

Expected:

- messages are confirmed after RabbitMQ ACK

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.without.ts
```

Expected:

- messages are sent without waiting for confirms

---

## 3. Dedupe

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/consumer.dedupe.ts
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/publisher.dupes.ts
```

Expected:

- first message is processed
- duplicate message is skipped

---

## 4. RPC

Run:

```bash
npx ts-node-dev --transpile-only examples/02-rpc/responder.ts
npx ts-node-dev --transpile-only examples/02-rpc/requester.ts
```

Expected:

- requester receives a reply
- old RPC style still works:

```ts
ev.meta = {
  expectsReply: true,
  timeoutMs: 5000,
};

const reply = await pub.produce(ev);
```

---

## 5. Plugins

Run:

```bash
npx ts-node-dev --transpile-only examples/04-plugins/consumer.ts
npx ts-node-dev --transpile-only examples/04-plugins/publisher.ts
```

Expected:

- plugin logs appear
- metrics appear
- consumer receives messages

---

## 6. Backpressure

Run:

```bash
PREFETCH=10 BP_SLOW_MS=200 \
npx ts-node-dev --transpile-only examples/05-backpressure/consumer.slow.ts
```

```bash
BP_MSG_SIZE=256000 \
npx ts-node-dev --transpile-only examples/05-backpressure/publisher.fast.ts
```

Expected:

- publisher stays stable
- slow consumer processes gradually
- backpressure logs may appear

---

## 7. Manual queueArgs still works

Old DLQ configuration should still be supported:

```ts
.exchange("orders.exchange", {
  exchangeType: "topic",
  routingKey: "order.created",
  queueArgs: {
    "x-dead-letter-exchange": "orders.dlq.exchange",
  },
});
```

Expected:

- `queueArgs` are still passed to RabbitMQ
- new `deadLetter` helper is additive, not breaking

---

## Compatibility result

If all checks pass, `0.7.0` is safe for the common `0.6.1` usage patterns.

Release note:

```md
Rabbit Relay 0.7.0 is backward compatible with 0.6.1 public APIs.

Existing usage of produce, produceMany, consume, with, publisher confirms, RPC metadata, plugins, TTL dedupe, backpressure, and manual queueArgs continues to work.
```
