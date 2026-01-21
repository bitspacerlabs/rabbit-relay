import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

(async () => {
  const broker = new RabbitMQBroker("dlq.consumer");

  const dlq = await broker
    .queue("orders.dlq.queue")
    .exchange<Record<string, EventEnvelope>>(
      "orders.dlq.exchange",
      {
        exchangeType: "fanout",
        routingKey: "#",
      }
    );

  dlq.handle("*", async (_id, ev) => {
    console.error("DLQ MESSAGE:", ev);
    // store in DB, send Slack alert, etc.
  });

  await dlq.consume();
  console.log("[dlq] listening");
})();
