import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "ok" | "fail-once";
};

type JobEvent = EventEnvelope<Job>;

(async () => {
  const EXCHANGE = "redrive.jobs.ex";
  const QUEUE = "redrive.jobs.q";

  const broker = new RabbitMQBroker("dlq-redrive.consumer.normal");

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "redrive.job": JobEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "redrive.job",
      deadLetter: {
        exchange: "redrive.jobs.dlx",
        queue: "redrive.jobs.dlq",
        routingKey: "redrive.job.dead",
        autoDeclare: true,
      },
    });

  sub.handle("redrive.job", async (_id, ev) => {
    console.log("[normal-consumer] received redriven/main message:", {
      id: ev.id,
      data: ev.data,
      redriveCount: ev.meta?.headers?.["x-rabbit-relay-redrive-count"],
      redrivenAt: ev.meta?.headers?.["x-rabbit-relay-redriven-at"],
      redrivenFrom: ev.meta?.headers?.["x-rabbit-relay-redriven-from-queue"],
    });

    console.log("[normal-consumer] success", ev.data.jobId);
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "dead-letter",
  });

  console.log("[normal-consumer] listening");
  console.log("[normal-consumer] run redrive.ts to move DLQ messages back here");
})();
