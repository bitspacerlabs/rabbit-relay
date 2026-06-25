# Rabbit Relay Agent Guide

This file is the single source of truth for AI coding agents working in this repository.

Use it for Claude Code, Codex, Cursor, ChatGPT, or any agent that edits code, examples, or docs.

## Project

Rabbit Relay is a reliable, type-safe RabbitMQ event framework for Node.js.

It is built on top of `amqplib` and keeps RabbitMQ concepts explicit:

- exchanges
- queues
- bindings
- routing keys
- acknowledgements
- retries
- dead-letter queues
- publisher confirms
- topology ownership

Do not hide RabbitMQ behind magic abstractions.

## Current release status

Rabbit Relay `1.0.0` is the first stable release.

After `1.0.0`, prefer backward-compatible fixes, documentation improvements, and small production-hardening changes.

Do not add new public APIs unless explicitly requested.

## Change style

Prefer minimal, focused changes.

When editing code:

- keep existing style
- keep existing public APIs stable
- avoid large refactors
- avoid unnecessary dependencies
- avoid changing runtime behavior unless the task requires it
- update examples/docs if behavior changes

When editing docs:

- write for developers first
- keep examples copy-paste friendly
- explain RabbitMQ concepts simply
- prefer task-based guidance
- avoid internal roadmap wording such as “Phase 1”, “Phase 2”, or “Phase 3”

## Public API to preserve

Treat these as stable unless explicitly asked to change them:

- `RabbitMQBroker`
- `event`
- `eventWithReply`
- `expectReply`
- `withMeta`
- `withHeaders`
- `withCorrelation`
- `withCausation`
- `traceFrom`
- `produce`
- `produceMany`
- `publish`
- `request<TReply>()`
- `handle`
- `consume`
- `use`
- `health`
- `close`
- `withChannel`
- `planTopology`
- `validateTopology`
- `redriveDlq`
- `attachOpenTelemetry`
- `makeMemoryDedupe`

## Preferred Rabbit Relay patterns

### Publish typed events

Use event factories.

```ts
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";

const orderCreated = event("order.created", "v1").of<{
  orderId: string;
  amount: number;
}>();

const broker = new RabbitMQBroker("orders.publisher");

const pub = await broker
  .queue("orders.publisher.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

await pub.produce(
  orderCreated({
    orderId: "o-1",
    amount: 42,
  })
);

await broker.close();
```

Always `await` `produce()`, `publish()`, and `request()`.

### Consume events

```ts
import { RabbitMQBroker, type EventEnvelope } from "@bitspacerlabs/rabbit-relay";

type OrderCreated = {
  orderId: string;
  amount: number;
};

const broker = new RabbitMQBroker("orders.consumer");

const sub = await broker
  .queue("orders.q")
  .exchange<{
    "order.created": EventEnvelope<OrderCreated>;
  }>("orders.ex", {
    exchangeType: "topic",
    routingKey: "order.*",
  });

sub.handle("order.created", async (_id, ev) => {
  console.log(ev.data.orderId);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

### Production consumer failure handling

Prefer bounded retry plus DLQ.

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "order.*",
    deadLetter: {
      exchange: "orders.dlx",
      queue: "orders.dlq",
      routingKey: "orders.dead",
      autoDeclare: true,
    },
  });

await sub.consume({
  prefetch: 10,
  concurrency: 5,
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 5000,
    then: "dead-letter",
  },
});
```

Use delayed retry for downstream outages.

Use immediate retry only for short transient failures.

Avoid infinite `requeue` loops.

### RPC

Use `request<TReply>()` for new request/reply flows.

```ts
type Reply = {
  ok: boolean;
};

const reply = await pub.request<Reply>(eventEnvelope, {
  timeoutMs: 5000,
});
```

Do not prefer manual `meta.expectsReply` in new examples unless documenting backward compatibility.

### Topology ownership

Use `topologyMode` to make RabbitMQ topology ownership explicit.

```ts
topologyMode: "assert";
topologyMode: "passive";
topologyMode: "plan-only";
```

Meaning:

| Mode | Use when |
|---|---|
| `"assert"` | the app owns RabbitMQ topology |
| `"passive"` | infrastructure owns RabbitMQ topology |
| `"plan-only"` | CI/docs/review should only produce a topology plan |

For new infra-managed examples, prefer:

```ts
topologyMode: "passive"
```

over:

```ts
passiveQueue: true
```

`passiveQueue` remains supported only for compatibility and queue-only passive checks.

### Topology planner

Use `topologyMode: "plan-only"` when showing planner-only examples.

```ts
const broker = new RabbitMQBroker("topology.preview", {
  topologyMode: "plan-only",
});
```

`planTopology()` must be described as read-only and not requiring RabbitMQ.

### Topology validation

`validateTopology()` is passive and non-mutating.

It checks exchanges and queues.

Binding validation is informational because AMQP/amqplib does not expose a simple safe passive binding check.

`binding_not_validated` is expected and should not be treated as a failure by itself.

### DLQ redrive

Always dry-run first in docs and operational examples.

```ts
await broker.redriveDlq({
  fromQueue: "orders.dlq",
  toExchange: "orders.ex",
  routingKey: "order.created",
  limit: 100,
  dryRun: true,
});
```

Explain that Rabbit Relay ACKs the original DLQ message only after successful republish.

## RabbitMQ teaching rules

When explaining RabbitMQ concepts, use this mental model:

```text
producer -> exchange -> binding -> queue -> consumer
```

Map Rabbit Relay code to RabbitMQ concepts:

```ts
const sub = await broker
  .queue("orders.q")
  .exchange("orders.ex", {
    exchangeType: "topic",
    routingKey: "orders.*",
  });
```

Means:

```text
orders.ex = exchange
orders.q = queue
orders.* = binding routing key
```

Acknowledgement mapping:

```text
handler succeeds                         -> ACK
handler throws + onError: "ack"          -> ACK anyway
handler throws + onError: "requeue"      -> NACK requeue=true
handler throws + onError: "dead-letter"  -> NACK requeue=false
handler throws + onError: "retry"        -> publish retry copy, then ACK original
```

Always remind that RabbitMQ delivery is at-least-once and consumers should be idempotent.

## Things not to add unless explicitly requested

Do not add these as new runtime features without an explicit product decision:

- DLQ peek
- redrive filtering
- pause/resume consumers
- metrics adapter
- RabbitMQ management API validation
- new topology helper APIs
- new public broker methods
- new retry strategies beyond the current API

Document future ideas only if explicitly asked.

## Validation commands

For code changes:

```bash
npm run build
npm run test:package
```

For docs changes:

```bash
npm run docs:build
```

For examples changes:

```bash
npm run build
npm run test:package
npm run docs:build
```

Before future releases:

```bash
npm run build
npm run test:package
npm run docs:build
npm pack --dry-run
```

## Commit style

Use simple conventional commits.

Examples:

```bash
git commit -m "docs: add RabbitMQ learning guide"
git commit -m "docs: add AI agent guidance"
git commit -m "fix: respect topology mode for delayed retry"
git commit -m "chore: prepare release"
```

## Docs map

Useful docs for agents and developers:

- `docs/guide/quickstart.md` — first working example
- `docs/guide/configuration.md` — broker/exchange options
- `docs/learn/rabbitmq-basics.md` — RabbitMQ concepts
- `docs/learn/exchanges-queues-bindings.md` — topology basics
- `docs/learn/acknowledgements.md` — ACK/NACK behavior
- `docs/learn/retry-dlq-redrive.md` — failure lifecycle
- `docs/learn/topology-ownership.md` — assert/passive/plan-only
- `docs/ai/agent-guide.md` — agent-specific guidance
- `docs/ai/common-recipes.md` — copy-paste recipes
- `docs/ai/decision-guide.md` — what feature to use when
- `docs/api/rabbitmq-broker.md` — main API reference
- `docs/api/event-envelope.md` — message envelope reference

## Final instruction

When unsure, choose the smallest safe change that preserves the public API and makes RabbitMQ behavior clearer.
