# Quickstart

This guide walks you through publishing and consuming your **first typed event** using **Rabbit Relay**.

---

## Install

```bash
npm install rabbit-relay
```

---

## Define an event (shared contract)

This file defines **event names and payloads only**.
It contains **no RabbitMQ logic** and can be shared across services.

```ts
// events.ts

// Event routing keys used by RabbitMQ
export const SchedulerEvents = {
  ScheduleTask: "scheduler.scheduleTask",
} as const;

// Payload carried by the event
export type ScheduleTaskData = {
  id: string;    // task identifier
  when: number; // timestamp (ms)
};
```

---

## Publish (recommended: `with()` API)

```ts
import { RabbitMQBroker, event } from "rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events.js";

(async () => {
  // Create a broker instance for this service
  const broker = new RabbitMQBroker("scheduler_service");

  // Declare the queue and exchange used for publishing
  const pub = await broker.queue("scheduler_publish_queue")
    .exchange("scheduler_exchange", {
      exchangeType: "topic",
    });

  // Create a typed event factory using the shared contract
  // This attaches:
  // - event name
  // - version
  // - payload typing
  const scheduleTask = event(SchedulerEvents.ScheduleTask, "v1").of<ScheduleTaskData>();

  // Convert event factories into a service-like API
  const api = pub.with({ scheduleTask });

  // Publish the event using a typed method
  await api.scheduleTask({
    id: "task-1",
    when: Date.now() + 5000,
  });
})();
```

---

## Consume

```ts
import { RabbitMQBroker } from "rabbit-relay";
import type { EventEnvelope } from "rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events.js";

(async () => {
  // Create a broker instance for this service
  const broker = new RabbitMQBroker("scheduler_worker");

  // Declare the queue and bind it to the exchange
  // The generic type defines which events this exchange can emit
  const sub = await broker
    .queue("scheduler_worker_queue")
    .exchange<{
      [SchedulerEvents.ScheduleTask]: EventEnvelope<ScheduleTaskData>;
    }>(
      "scheduler_exchange",
      {
        exchangeType: "topic",
        routingKey: "scheduler.*", // RabbitMQ routing pattern
      }
    );

  // Register a handler for the event
  // The key must match the event name exactly
  sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    console.log("Task received:", ev.data);
  });

  // Start consuming messages
  await sub.consume();
})();
```

---

## Publish without `with()` (explicit style)

```ts
import { RabbitMQBroker, event } from "rabbit-relay";
import { SchedulerEvents, type ScheduleTaskData } from "./events.js";

(async () => {
  const broker = new RabbitMQBroker("scheduler_service");

  const pub = await broker
    .queue("scheduler_publish_queue")
    .exchange("scheduler_exchange", {
      exchangeType: "topic",
    });

  const scheduleTask =
    event(SchedulerEvents.ScheduleTask, "v1")
      .of<ScheduleTaskData>();

  const evt = scheduleTask({
    id: "task-2",
    when: Date.now() + 10_000,
  });

  await pub.produce(evt);
})();
```

---

## Summary

- Contracts define event names and payloads
- Publishers own events and versions
- Consumers explicitly declare what they handle
- RabbitMQ routing remains visible
- `with()` is convenience, not magic
