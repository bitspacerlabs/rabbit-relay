import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "ok" | "fail-once";
};

type JobEvent = EventEnvelope<Job>;

(async () => {
  const EXCHANGE = "redrive.jobs.ex";
  const QUEUE = "redrive.jobs.publisher.q";

  const broker = new RabbitMQBroker("dlq-redrive.publisher");

  const pub = await broker
    .queue(QUEUE)
    .exchange<{ "redrive.job": JobEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "redrive.job",
      publisherConfirms: true,
    });

  const makeJob = event("redrive.job", "v1").of<Job>();

  await pub.produce(
    makeJob({
      jobId: "job-ok",
      kind: "ok",
    }),
    makeJob({
      jobId: "job-needs-redrive",
      kind: "fail-once",
    })
  );

  console.log("[publisher] redrive demo jobs sent");

  await broker.close();
})();
