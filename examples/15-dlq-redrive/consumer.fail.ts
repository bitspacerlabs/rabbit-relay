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

  const broker = new RabbitMQBroker("dlq-redrive.consumer.fail");

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
    console.log("[fail-consumer] received", ev.data);

    if (ev.data.kind === "fail-once") {
      console.log("[fail-consumer] failing job so it goes to DLQ");
      throw new Error("simulated failure for DLQ redrive demo");
    }

    console.log("[fail-consumer] success", ev.data.jobId);
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "dead-letter",
  });

  console.log("[fail-consumer] listening");
  console.log("[fail-consumer] run publisher, then stop this process before redrive");
})();
