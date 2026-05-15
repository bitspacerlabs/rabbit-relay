import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type DemoJob = {
  jobId: string;
  shouldFail?: boolean;
};

type DemoEvent = EventEnvelope<DemoJob>;

(async () => {
  const EXCHANGE = "lifecycle.demo.ex";
  const QUEUE = "lifecycle.demo.q";

  const broker = new RabbitMQBroker("lifecycle.demo.service");

  broker.on("topology.asserted", (ev) => {
    console.log("[lifecycle] topology.asserted", ev);
  });

  broker.on("consumer.started", (ev) => {
    console.log("[lifecycle] consumer.started", ev);
  });

  broker.on("consumer.stopped", (ev) => {
    console.log("[lifecycle] consumer.stopped", ev);
  });

  broker.on("retry.scheduled", (ev) => {
    console.log("[lifecycle] retry.scheduled", {
      peerName: ev.peerName,
      queue: ev.queue,
      exchange: ev.exchange,
      routingKey: ev.routingKey,
      retryCount: ev.retryCount,
      attempts: ev.attempts,
      delayMs: ev.delayMs,
      error: ev.error instanceof Error ? ev.error.message : String(ev.error),
    });
  });

  broker.on("publish.failed", (ev) => {
    console.log("[lifecycle] publish.failed", {
      peerName: ev.peerName,
      exchange: ev.exchange,
      routingKey: ev.routingKey,
      eventName: ev.eventName,
      error: ev.error instanceof Error ? ev.error.message : String(ev.error),
    });
  });

  broker.on("broker.closed", (ev) => {
    console.log("[lifecycle] broker.closed", ev);
  });

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "lifecycle.job": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "lifecycle.job",
      deadLetter: {
        exchange: "lifecycle.demo.dlx",
        queue: "lifecycle.demo.dlq",
        routingKey: "lifecycle.job.dead",
        autoDeclare: true,
      },
    });

  sub.handle("lifecycle.job", async (_id, ev) => {
    console.log("[handler] received", ev.data);

    if (ev.data.shouldFail) {
      throw new Error(`job failed: ${ev.data.jobId}`);
    }

    console.log("[handler] success", ev.data.jobId);
  });

  await sub.consume({
    prefetch: 5,
    concurrency: 2,
    onError: "retry",
    retry: {
      attempts: 2,
      delayMs: 1000,
      then: "dead-letter",
    },
  });

  const makeJob = event("lifecycle.job", "v1").of<DemoJob>();

  await sub.produce(
    makeJob({
      jobId: "job-ok",
    }),
    makeJob({
      jobId: "job-fail",
      shouldFail: true,
    })
  );

  console.log("[service] lifecycle demo running");
  console.log("[service] press Ctrl+C to stop");

  process.on("SIGINT", async () => {
    console.log("\n[service] received SIGINT");

    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[service] received SIGTERM");

    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  });
})();
