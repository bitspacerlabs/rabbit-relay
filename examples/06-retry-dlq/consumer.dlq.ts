import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

(async () => {
  const broker = new RabbitMQBroker("retry.dlq.consumer");

  const dlq = await broker
    .queue("retry.jobs.dlq")
    .exchange<Record<string, EventEnvelope>>("retry.jobs.dlx", {
      exchangeType: "topic",
      routingKey: "jobs.dead",
    });

  dlq.handle("*", async (_id, ev) => {
    console.error("[dlq] exhausted message:", {
      id: ev.id,
      name: ev.name,
      data: ev.data,
      meta: ev.meta,
    });
  });

  await dlq.consume({ prefetch: 10, concurrency: 2 });

  console.log("[dlq] retry DLQ listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
