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

        // MUST MATCH publisher queueArgs
        queueArgs: {
          "x-dead-letter-exchange": "orders.dlq.exchange",
        },
      }
    );

  sub.handle("order.created", async (_id, ev) => {
    console.log("[payments] processing", ev.data);

    if (ev.data.amount > 1000) {
      console.log("[payments] payment failed → DLQ");
      throw new Error("payment rejected");
    }

    console.log("[payments] payment success");
  });

  await sub.consume({
    onError: "dead-letter", // THIS is the key
  });

  console.log("[payments] listening");
})();
