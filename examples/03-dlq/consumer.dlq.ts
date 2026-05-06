import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

(async () => {
  const broker = new RabbitMQBroker("dlq.consumer");

  const dlq = await broker
    .queue("orders.dlq")
    .exchange<Record<string, EventEnvelope>>(
      "orders.dlx",
      {
        exchangeType: "topic",
        routingKey: "orders.dead",
      }
    );

  dlq.handle("*", async (_id, ev) => {
    console.error("[dlq] message received:", ev);
    // Store in DB, send alert, expose to operations tooling, etc.
  });

  await dlq.consume({ prefetch: 10, concurrency: 2 });

  console.log("[dlq] listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
