import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
};

(async () => {
  const broker = new RabbitMQBroker("orders.publisher");

  const pub = await broker
    .queue("orders.queue")
    .exchange<{ "order.created": EventEnvelope<OrderCreated> }>(
      "orders.exchange",
      {
        exchangeType: "topic",
        routingKey: "order.created",

        // DLQ CONFIG — declared ONCE here
        queueArgs: {
          "x-dead-letter-exchange": "orders.dlq.exchange",
        },
      }
    );

  const makeOrder = event("order.created", "v1").of<OrderCreated>();

  await pub.produce(
    makeOrder({ orderId: "o-1", amount: 100 }),
    makeOrder({ orderId: "o-2", amount: 9999 }) // poison
  );

  console.log("[publisher] orders sent");
})();
