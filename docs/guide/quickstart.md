# Quickstart

This guide walks you through publishing and consuming your **first typed event** using **Rabbit Relay**.

---

## Install

```bash
npm install @bitspacerlabs/rabbit-relay
```

---

## Define an event contract

This file defines **event names and payloads only**.
It contains **no RabbitMQ logic** and can be shared across services.

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
import { RabbitMQBroker, event } from "@bitspacerlabs/rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events";

(async () => {
  const broker = new RabbitMQBroker("scheduler_service");

  const pub = await broker
    .queue("scheduler_publish_queue")
    .exchange("scheduler_exchange", {
      exchangeType: "topic",
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
import { RabbitMQBroker, type EventEnvelope } from "@bitspacerlabs/rabbit-relay";
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

  sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    console.log("Task received:", ev.data);
  });

  await sub.consume({
    prefetch: 10,
    concurrency: 5,
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

## Publish with native AMQP options

Use `publish()` when you need per-message RabbitMQ options.

```ts
await pub.publish(scheduleTask({ id: "task-3", when: Date.now() }), {
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

- Contracts define event names and payloads
- Publishers create typed event envelopes
- Consumers explicitly declare what they handle
- `prefetch` controls RabbitMQ delivery pressure
- `concurrency` controls parallel handler execution
- Retry + DLQ gives safer production failure handling
- Native `amqplib` options remain available when needed
