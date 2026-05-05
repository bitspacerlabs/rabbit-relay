import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "ok" | "flaky" | "poison";
};

(async () => {
  const broker = new RabbitMQBroker("retry.publisher");

  const pub = await broker
    .queue("retry.jobs.queue")
    .exchange<{ "jobs.process": EventEnvelope<Job> }>("retry.jobs.exchange", {
      exchangeType: "topic",
      routingKey: "jobs.process",
      publisherConfirms: true,
      deadLetter: {
        exchange: "retry.jobs.dlx",
        queue: "retry.jobs.dlq",
        routingKey: "jobs.dead",
        autoDeclare: true,
      },
    });

  const makeJob = event("jobs.process", "v1").of<Job>();

  await pub.produce(
    makeJob({ jobId: "job-ok", kind: "ok" }),
    makeJob({ jobId: "job-flaky", kind: "flaky" }),
    makeJob({ jobId: "job-poison", kind: "poison" })
  );

  console.log("[publisher] jobs sent");
  await broker.close();
})();
