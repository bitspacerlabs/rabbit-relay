import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "ok" | "flaky" | "poison";
};

type JobEvent = EventEnvelope<Job>;

(async () => {
  const DLX = "delayed.jobs.dlx";
  const DLQ = "delayed.jobs.dlq";

  const broker = new RabbitMQBroker("delayed-retry.dlq-consumer");

  const dlq = await broker
    .queue(DLQ)
    .exchange<{ "jobs.process.delayed": JobEvent }>(DLX, {
      exchangeType: "topic",
      routingKey: "jobs.process.delayed.dead",
      topologyMode: "passive",
    });

  dlq.handle("*", async (_id, ev) => {
    console.log("[dlq] exhausted message:", {
      id: ev.id,
      name: ev.name,
      data: ev.data,
      meta: ev.meta,
    });
  });

  await dlq.consume({
    prefetch: 1,
    concurrency: 1,
  });

  console.log("[dlq] delayed retry DLQ listening");
})();
