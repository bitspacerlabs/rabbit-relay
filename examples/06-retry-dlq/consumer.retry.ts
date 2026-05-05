import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "ok" | "flaky" | "poison";
};

const flakyAttempts = new Map<string, number>();

(async () => {
  const broker = new RabbitMQBroker("retry.consumer");

  const sub = await broker
    .queue("retry.jobs.queue")
    .exchange<{ "jobs.process": EventEnvelope<Job> }>("retry.jobs.exchange", {
      exchangeType: "topic",
      routingKey: "jobs.process",
      deadLetter: {
        exchange: "retry.jobs.dlx",
        queue: "retry.jobs.dlq",
        routingKey: "jobs.dead",
        autoDeclare: true,
      },
    });

  sub.handle("jobs.process", async (_id, ev) => {
    const job = ev.data;

    console.log(`[consumer] handling ${job.jobId} kind=${job.kind}`);

    if (job.kind === "ok") {
      console.log(`[consumer] success ${job.jobId}`);
      return;
    }

    if (job.kind === "flaky") {
      const attempt = (flakyAttempts.get(job.jobId) ?? 0) + 1;
      flakyAttempts.set(job.jobId, attempt);

      if (attempt < 3) {
        console.log(`[consumer] flaky failure ${job.jobId} attempt=${attempt}`);
        throw new Error(`temporary failure attempt=${attempt}`);
      }

      console.log(`[consumer] flaky recovered ${job.jobId} attempt=${attempt}`);
      return;
    }

    console.log(`[consumer] poison failure ${job.jobId}`);
    throw new Error("poison job always fails");
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "retry",
    retry: {
      attempts: 3,
      then: "dead-letter",
    },
  });

  console.log("[consumer] retry consumer listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
