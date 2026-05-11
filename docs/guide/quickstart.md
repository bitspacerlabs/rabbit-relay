# Quickstart

This guide walks you through publishing and consuming your first typed event using Rabbit Relay.

---

## Install

```bash
npm install @bitspacerlabs/rabbit-relay
```

---

## Define an event contract

```ts
// events.ts

export const SchedulerEvents = {
  ScheduleTask: "scheduler.scheduleTask",
} as const;

export type ScheduleTaskData = {
  id: string;
  when: number;
};
```

---

## Publish

```ts
import {
  RabbitMQBroker,
  event,
  withHeaders,
} from "@bitspacerlabs/rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events";

(async () => {
  const broker = new RabbitMQBroker("scheduler_service", {
    maxMessageBytes: 256 * 1024,
  });

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
    withHeaders(
      scheduleTask({
        id: "task-1",
        when: Date.now() + 5000,
      }),
      {
        source: "scheduler_service",
      }
    )
  );

  await broker.close();
})();
```

---

## Publish with the `with()` API

`with()` converts event factories into a small typed API.

```ts
const api = pub.with({ scheduleTask });

await api.scheduleTask({
  id: "task-2",
  when: Date.now() + 10_000,
});
```

---

## Consume

```ts
import {
  RabbitMQBroker,
  traceFrom,
  type EventEnvelope,
} from "@bitspacerlabs/rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events";

(async () => {
  const broker = new RabbitMQBroker("scheduler_worker");

  const sub = await broker
    .queue("scheduler_worker_queue")
    .exchange<{
      [SchedulerEvents.ScheduleTask]: EventEnvelope<ScheduleTaskData>;
    }>("scheduler_exchange", {
      exchangeType: "topic",
      routingKey: "scheduler.*",
    });

  sub.use(async (ctx, next) => {
    console.log("processing", ctx.event.name);
    await next();
  });

  sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    console.log("Task received:", ev.data);
    console.log("Trace metadata for child event:", traceFrom(ev));
  });

  await sub.consume({
    prefetch: 10,
    concurrency: 5,
    dedupe: {
      enabled: true,
      ttlMs: 60_000,
    },
  });
})();
```

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
    then: "dead-letter",
  },
});
```

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
- `request<TReply>()` supports typed RPC
- `withHeaders()` and `traceFrom()` help with metadata
- middleware is local to a consumer flow
- `consume({ dedupe })` skips duplicate messages
- retry + DLQ gives safer production failure handling
- native `amqplib` options remain available when needed
