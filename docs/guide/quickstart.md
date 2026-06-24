# Quickstart

This guide walks you through publishing and consuming your first typed event using Rabbit Relay.

::: tip What you will build
A small publisher creates a typed event and a consumer handles it from RabbitMQ.
:::

---

## Install

```bash
npm install @bitspacerlabs/rabbit-relay
```

---

## Define an event contract

```ts [events.ts]
export const SchedulerEvents = {
  ScheduleTask: "scheduler.scheduleTask",
} as const;

export type ScheduleTaskData = {
  id: string;
  when: number;
};
```

---

## Publish and consume

::: code-group

```ts [publisher.ts]
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events";

const broker = new RabbitMQBroker("scheduler_service");

const pub = await broker
  .queue("scheduler_publish_queue")
  .exchange("scheduler_exchange", {
    exchangeType: "topic",
    publisherConfirms: true,
  });

const scheduleTask = event(
  SchedulerEvents.ScheduleTask,
  "v1"
).of<ScheduleTaskData>();

await pub.produce(
  scheduleTask({
    id: "task-1",
    when: Date.now() + 5000,
  })
);

await broker.close();
```

```ts [consumer.ts]
import {
  RabbitMQBroker,
  type EventEnvelope,
} from "@bitspacerlabs/rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events";

const broker = new RabbitMQBroker("scheduler_worker");

const sub = await broker
  .queue("scheduler_worker_queue")
  .exchange<{
    [SchedulerEvents.ScheduleTask]: EventEnvelope<ScheduleTaskData>;
  }>("scheduler_exchange", {
    exchangeType: "topic",
    routingKey: "scheduler.*",
  });

sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
  console.log("Task received:", ev.data);
});

await sub.consume({
  prefetch: 10,
  concurrency: 5,
});
```

:::

---

## Publish with the `with()` API

`with()` converts event factories into a small typed publish API.

```ts
const api = pub.with({ scheduleTask });

await api.scheduleTask({
  id: "task-2",
  when: Date.now() + 10_000,
});
```

::: tip Recommended style
Use `with()` when a service owns a group of events and publishes them often.
Use `produce()` or `publish()` directly for one-off publishing.
:::

---

## Add retries and DLQ

For production consumers, prefer bounded retries with a dead-letter queue.

```ts
const sub = await broker
  .queue("scheduler_worker_queue")
  .exchange<{
    [SchedulerEvents.ScheduleTask]: EventEnvelope<ScheduleTaskData>;
  }>("scheduler_exchange", {
    exchangeType: "topic",
    routingKey: "scheduler.*",
    deadLetter: {
      exchange: "scheduler.dlx",
      queue: "scheduler.dlq",
      routingKey: "scheduler.dead",
      autoDeclare: true,
    },
  });

sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
  console.log("Task received:", ev.data);
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

::: warning Queue arguments are immutable
RabbitMQ does not allow changing queue arguments after a queue already exists.
If you change DLQ settings, retry delay, or queue type in local development, recreate the queue or reset the local RabbitMQ volume.
:::

`delayMs` uses RabbitMQ TTL + DLX delayed retry queues. If you omit `delayMs`, retry remains immediate.

---

## Typed RPC

Use `request<TReply>()` for request/reply flows.

```ts
type Reply = {
  ok: boolean;
};

const reply = await pub.request<Reply>(
  scheduleTask({
    id: "task-rpc",
    when: Date.now(),
  }),
  {
    timeoutMs: 5000,
  }
);

console.log(reply);
```

::: warning Use RPC deliberately
RPC creates tighter service coupling than events. Prefer events when the workflow does not need an immediate reply.
:::

---

## Message metadata

Use `withHeaders()` when you want to attach metadata to a message.

```ts
import { withHeaders } from "@bitspacerlabs/rabbit-relay";

await pub.produce(
  withHeaders(
    scheduleTask({
      id: "task-with-headers",
      when: Date.now(),
    }),
    {
      source: "scheduler_service",
    }
  )
);
```

Use `traceFrom()` when creating a child event from an existing event.

```ts
import { traceFrom } from "@bitspacerlabs/rabbit-relay";

sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
  const trace = traceFrom(ev);

  console.log("Trace metadata:", trace);
});
```

---

## Operations helpers

Rabbit Relay includes operations helpers for production visibility and support workflows.

::: code-group

```ts [lifecycle.ts]
broker.on("retry.scheduled", (event) => {
  console.log("retry scheduled", event);
});
```

```ts [topology.ts]
const plan = broker.planTopology();
console.log(plan);

const validation = await broker.validateTopology();
console.log(validation);
```

```ts [redrive.ts]
const redrive = await broker.redriveDlq({
  fromQueue: "scheduler.dlq",
  toExchange: "scheduler_exchange",
  routingKey: SchedulerEvents.ScheduleTask,
  limit: 10,
  dryRun: true,
});

console.log(redrive);
```

:::

---

## OpenTelemetry

Use OpenTelemetry by passing your own tracer.

```ts
import { attachOpenTelemetry } from "@bitspacerlabs/rabbit-relay";
import { trace } from "@opentelemetry/api";

attachOpenTelemetry(broker, {
  tracer: trace.getTracer("rabbit-relay"),
  serviceName: "scheduler-service",
});
```

---

## Publish with native AMQP options

Use `publish()` when you need per-message RabbitMQ options.

```ts
await pub.publish(scheduleTask({ id: "task-3", when: Date.now() }), {
  maxMessageBytes: 64 * 1024,
  amqp: {
    publish: {
      persistent: true,
      priority: 5,
    },
  },
});
```

---

## Health checks

```ts
const health = await broker.health();
console.log(health);
```

---

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  await broker.close();
  process.exit(0);
});
```

---

## Summary

- Publishers create typed event envelopes
- Consumers explicitly declare what they handle
- `produce()` is the simplest way to publish an event
- `with()` creates a small typed publish API
- `request<TReply>()` supports typed RPC
- `withHeaders()` and `traceFrom()` help with metadata
- retry + delayed retry + DLQ gives safer production failure handling
- lifecycle hooks, topology planning, validation, and DLQ redrive help operations
- native `amqplib` options remain available when needed
