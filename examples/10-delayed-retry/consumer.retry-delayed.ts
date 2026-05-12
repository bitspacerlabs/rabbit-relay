import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type JobKind = "ok" | "flaky" | "poison";

type Job = {
  jobId: string;
  kind: JobKind;
};

type JobEvent = EventEnvelope<Job>;

const RETRY_COUNT_HEADER = "x-rabbit-relay-retry-count";

function getRetryCountFromEvent(ev: EventEnvelope): number {
  const raw = ev.meta?.headers?.[RETRY_COUNT_HEADER];

  if (typeof raw === "number") return raw;

  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

(async () => {
  const EXCHANGE = "delayed.jobs.ex";
  const QUEUE = "delayed.jobs.q";

  const broker = new RabbitMQBroker("delayed-retry.consumer");

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "jobs.process.delayed": JobEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "jobs.process.delayed",
      deadLetter: {
        exchange: "delayed.jobs.dlx",
        queue: "delayed.jobs.dlq",
        routingKey: "jobs.process.delayed.dead",
        autoDeclare: true,
      },
    });

  sub.handle("jobs.process.delayed", async (_id, ev) => {
    const retryCount = getRetryCountFromEvent(ev);
    const attempt = retryCount + 1;

    console.log(
      `[consumer] handling ${ev.data.jobId} kind=${ev.data.kind} attempt=${attempt}`
    );

    if (ev.data.kind === "ok") {
      console.log(`[consumer] success ${ev.data.jobId}`);
      return;
    }

    if (ev.data.kind === "flaky") {
      if (attempt < 3) {
        console.log(
          `[consumer] flaky failure ${ev.data.jobId} attempt=${attempt}`
        );
        throw new Error(`temporary failure attempt=${attempt}`);
      }

      console.log(
        `[consumer] flaky recovered ${ev.data.jobId} attempt=${attempt}`
      );
      return;
    }

    console.log(
      `[consumer] poison failure ${ev.data.jobId} attempt=${attempt}`
    );
    throw new Error("poison job always fails");
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "retry",
    retry: {
      attempts: 3,
      delayMs: Number(process.env.RETRY_DELAY_MS ?? 3000),
      then: "dead-letter",
    },
  });

  console.log(
    `[consumer] delayed retry consumer listening (delay=${process.env.RETRY_DELAY_MS ?? 3000}ms)`
  );
})();
