import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = {
  orderId: string;
  amount: number;
};

(async () => {
  const broker = new RabbitMQBroker("escape.publisher");

  // Raw channel access for topology that Rabbit Relay does not need to model directly.
  await broker.withChannel(async (ch) => {
    await ch.assertExchange("escape.audit.ex", "fanout", { durable: true });
    await ch.assertExchange("escape.unrouted.ex", "fanout", { durable: true });
  });

  const pub = await broker
    .queue("escape.orders.q", {
      amqp: {
        queue: {
          durable: true,
          arguments: {
            "x-message-ttl": 60_000,
          },
        },
      },
    })
    .exchange<{ "escape.order.created": EventEnvelope<Payload> }>(
      "escape.orders.ex",
      {
        exchangeType: "topic",
        routingKey: "escape.order.created",
        publisherConfirms: true,
        amqp: {
          exchange: {
            durable: true,
            alternateExchange: "escape.unrouted.ex",
          },
        },
      }
    );

  const makeOrder = event("escape.order.created", "v1").of<Payload>();

  const ev = makeOrder({
    orderId: `o-${Date.now()}`,
    amount: 120,
  });

  await pub.publish(ev, {
    amqp: {
      publish: {
        persistent: true,
        priority: 5,
        contentType: "application/json",
        headers: {
          "x-example": "escape-hatch",
        },
      },
    },
  });

  console.log("[publisher] published with native AMQP publish options");
  await broker.close();
})();
