import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Job = {
  jobId: string;
  kind: "flaky" | "poison";
};

type JobEvent = EventEnvelope<Job>;

(async () => {
  const EXCHANGE = "backoff.jobs.ex";
  const QUEUE = "backoff.jobs.q";

  const broker = new RabbitMQBroker("exponential-backoff.consumer");

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "jobs.process.backoff": JobEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "jobs.process.backoff",
    });

  const startedAt = Date.now();
  const deliveries: string[] = [];

  const processJob = event("jobs.process.backoff", "v1").of<Job>();

  sub.handle("*", async (_id, ev) => {
    const attempt =
      Number(ev.meta?.headers?.["x-rabbit-relay-retry-count"] ?? 0) + 1;
    const elapsed = Date.now() - startedAt;
    deliveries.push(`${ev.data.jobId}#a${attempt}`);

    if (ev.data.kind === "flaky") {
      if (attempt < 3) {
        console.log(
          `[t+${String(elapsed).padStart(5)}ms] flaky failure ${ev.data.jobId} attempt=${attempt}`
        );
        throw new Error(`temporary failure attempt=${attempt}`);
      }

      console.log(
        `[t+${String(elapsed).padStart(5)}ms] flaky recovered ${ev.data.jobId} attempt=${attempt}`
      );
      return;
    }

    console.log(
      `[t+${String(elapsed).padStart(5)}ms] poison failure ${ev.data.jobId} attempt=${attempt}`
    );
    throw new Error("poison job always fails");
  });

  await sub.consume({
    prefetch: 1,
    concurrency: 1,
    onError: "retry",
    retry: {
      attempts: 3,
      delayMs: 500,
      backoff: "exponential",
      then: "ack",
    },
  });

  const pub = sub.with({ processJob });

  await pub.processJob({ jobId: "job-flaky", kind: "flaky" });
  await pub.processJob({ jobId: "job-poison", kind: "poison" });

  console.log("[consumer] jobs published");

  // Expected waits between poison deliveries: 500ms, 1000ms, 2000ms.
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const poisonDone = deliveries.filter((d) => d.includes("job-poison")).length >= 4;
      if (poisonDone) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
    setTimeout(() => clearInterval(timer), 15_000);
  });

  console.log("[consumer] observed delivery order:", deliveries.join(", "));
  console.log(
    "[consumer] exponential backoff demo complete (waits double each attempt)"
  );

  await broker.close();
})();
