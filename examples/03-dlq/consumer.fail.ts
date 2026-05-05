import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
};

(async () => {
  const broker = new RabbitMQBroker("payments.consumer");

  const sub = await broker
    .queue("orders.queue")
    .exchange<{ "order.created": EventEnvelope<OrderCreated> }>(
      "orders.exchange",
      {
        exchangeType: "topic",
        routingKey: "order.created",
        deadLetter: {
          exchange: "orders.dlx",
          queue: "orders.dlq",
          routingKey: "orders.dead",
          autoDeclare: true,
        },
      }
    );

  sub.handle("order.created", async (_id, ev) => {
    console.log("[payments] processing", ev.data);

    if (ev.data.amount > 1000) {
      console.log("[payments] payment failed -> DLQ");
      throw new Error("payment rejected");
    }

    console.log("[payments] payment success");
  });

  await sub.consume({
    prefetch: 10,
    concurrency: 2,
    onError: "dead-letter",
  });

  console.log("[payments] listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
