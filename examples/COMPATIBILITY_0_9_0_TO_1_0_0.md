# Compatibility Check: 0.9.0 -> 1.0.0

Use this checklist to make sure existing Rabbit Relay `0.9.0` users can upgrade to `1.0.0` safely.

---

## Goal

Rabbit Relay `1.0.0` is the first stable release.

Existing `0.9.0` public APIs should continue to work:

- `produce()`
- `produceMany()`
- `publish(event, options)`
- `request<TReply>()`
- `consume()`
- `consume({ prefetch, concurrency })`
- `consume({ onError: "retry" })`
- immediate retry
- delayed retry with `retry.delayMs`
- `.with({ eventFactory })`
- `publisherConfirms`
- RPC using `meta.expectsReply`
- plugins
- middleware
- metadata helpers
- TTL dedupe
- message size guard
- native `amqplib` passthrough options
- `withChannel()`
- `broker.health()`
- `broker.close()`
- `planTopology()`
- `validateTopology()`
- `redriveDlq()`
- manual `queueArgs`
- built-in `deadLetter` helper
- OpenTelemetry lifecycle adapter

---

## Changed in 1.0.0

`1.0.0` stabilizes the public API and fixes two public API correctness issues.

### Routing key behavior

Rabbit Relay now handles configured routing keys more precisely:

- concrete `routingKey` values are used when publishing
- topic wildcard bindings such as `#` and `demo.*` continue publishing with the event name
- explicit `publish(event, { routingKey })` still overrides the publish routing key

### `.with(events)` return type

`.with(events)` generated methods are typed as async publish methods.

They return a `Promise`, not an `EventEnvelope`.

Correct usage:

```ts
const api = pub.with({ orderCreated });

await api.orderCreated({
  orderId: "o-1",
});
```

Avoid treating generated methods as event factories:

```ts
const ev = api.orderCreated({
  orderId: "o-1",
});

// Wrong: ev is a Promise, not an EventEnvelope.
console.log(ev.id);
```

---

## Before testing

Start clean:

```bash
docker compose -f examples/docker-compose.yml down -v
docker compose -f examples/docker-compose.yml up -d
npm run build
```

---

## 1. Package usage

Run:

```bash
npm run test:package
```

Expected:

- ESM import works
- CommonJS require works
- TypeScript consumer API types compile
- public APIs are type-safe
- `.with(events)` generated methods are typed as Promise-returning publish methods

---

## 2. Wildcard topic routing still works

Run:

```bash
npx ts-node-dev --transpile-only examples/04-plugins/consumer.ts
npx ts-node-dev --transpile-only examples/04-plugins/publisher.ts
```

Expected:

- publisher uses `routingKey: "demo.*"` as a binding pattern
- messages publish with event name `demo.ping`
- consumer receives messages
- plugin logs appear
- metrics appear

---

## 3. `#` topic routing still works

Run:

```bash
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/consumer.dedupe.ts
npx ts-node-dev --transpile-only examples/01-confirms/dedupe/publisher.loop.ts
```

Expected:

- publisher uses `routingKey: "#"` as a binding pattern
- messages publish with event name `demo.tick`
- consumer receives messages
- dedupe remains valid

---

## 4. Concrete routing keys still work

Run:

```bash
npx ts-node-dev --transpile-only examples/03-dlq/consumer.fail.ts
npx ts-node-dev --transpile-only examples/03-dlq/publisher.ts
```

Expected:

- concrete `routingKey: "order.created"` still routes correctly
- normal message is processed
- poison message is dead-lettered

---

## 5. RPC still works

Run responder:

```bash
npx ts-node-dev --transpile-only examples/02-rpc/responder.ts
```

Run requester:

```bash
npx ts-node-dev --transpile-only examples/02-rpc/requester.ts
```

Expected:

- requester receives a typed reply
- `request<TReply>()` remains the recommended API
- old `meta.expectsReply` compatibility remains valid

---

## 6. Developer experience APIs still work

Run consumer:

```bash
npx ts-node-dev --transpile-only examples/09-developer-experience/consumer.ts
```

Run publisher:

```bash
npx ts-node-dev --transpile-only examples/09-developer-experience/publisher.ts
```

Expected:

- `.with(events)` publish API works with `await`
- middleware logs appear
- metadata helpers work
- typed RPC reply is received
- message size guard still throws `MessageTooLargeError`

---

## 7. Operations APIs remain additive

Run:

```bash
npx ts-node-dev --transpile-only examples/11-lifecycle-hooks/service.ts
npx ts-node-dev --transpile-only examples/13-topology-planner/service.ts
npx ts-node-dev --transpile-only examples/14-topology-validation/service.ts
```

Expected:

- lifecycle hooks still emit
- topology planner remains read-only
- topology validation remains passive
- `binding_not_validated` remains informational

---

## Compatibility result

If all checks pass, `1.0.0` is safe for common `0.9.0` usage patterns.

Release note:

```md
Rabbit Relay 1.0.0 is backward compatible with 0.9.0 public APIs.

Existing usage of produce, produceMany, publish, request, consume, with, publisher confirms, RPC metadata, plugins, middleware, metadata helpers, TTL dedupe, message size guard, amqplib passthrough options, health checks, shutdown, topology planning, topology validation, DLQ redrive, and manual queueArgs continues to work.

The 1.0.0 release stabilizes the API, clarifies routing-key behavior, and fixes the .with(events) generated method return type.
```
