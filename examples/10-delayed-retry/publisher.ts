import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type JobKind = "ok" | "flaky" | "poison";

type Job = {
  jobId: string;
  kind: JobKind;
};

type JobEvent = EventEnvelope<Job>;

(async () => {
  const EXCHANGE = "delayed.jobs.ex";
  const QUEUE = "delayed.jobs.publisher.q";

  const broker = new RabbitMQBroker("delayed-retry.publisher");

  const pub = await broker
    .queue(QUEUE)
    .exchange<{ "jobs.process.delayed": JobEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "jobs.process.delayed",
      publisherConfirms: true,
    });

  const processJob = event("jobs.process.delayed", "v1").of<Job>();

  await pub.produce(
    processJob({
      jobId: "job-ok",
      kind: "ok",
    }),
    processJob({
      jobId: "job-flaky",
      kind: "flaky",
    }),
    processJob({
      jobId: "job-poison",
      kind: "poison",
    })
  );

  console.log("[publisher] delayed retry jobs sent");

  await broker.close();
})();
