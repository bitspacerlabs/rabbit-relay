import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = {
  orderId: string;
  amount: number;
};

(async () => {
  const broker = new RabbitMQBroker("escape.consumer");

  const sub = await broker
    .queue("escape.orders.q", {
      amqp: {
        queue: {
          durable: true,
          arguments: {
            // Native RabbitMQ queue argument passed through amqplib.
            "x-message-ttl": 60_000,
          },
        },
      },
    })
    .exchange<{ "escape.order.created": EventEnvelope<Payload> }>(
      "escape.orders.ex",
      {
        exchangeType: "topic",
        routingKey: "escape.order.*",
        amqp: {
          exchange: {
            durable: true,
            alternateExchange: "escape.unrouted.ex",
          },
        },
      }
    );

  sub.handle("escape.order.created", async (_id, ev) => {
    console.log("[consumer] received:", ev.data);
  });

  await sub.consume({
    prefetch: 10,
    concurrency: 2,
    amqp: {
      consume: {
        exclusive: false,
        priority: 5,
      },
    },
  });

  console.log("[consumer] escape hatch consumer listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
