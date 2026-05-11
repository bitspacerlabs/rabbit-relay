import {
  RabbitMQBroker,
  MessageTooLargeError,
  event,
  withHeaders,
  withCorrelation,
} from "../../lib";
import type { EventEnvelope } from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
  note?: string;
};

type Ping = {
  id: string;
};

type Pong = {
  ok: boolean;
  message: string;
};

(async () => {
  const broker = new RabbitMQBroker("dx.publisher", {
    maxMessageBytes: 256 * 1024,
  });

  const pub = await broker
    .queue("dx.publisher.q")
    .exchange<{
      "dx.order.created": EventEnvelope<OrderCreated>;
      "dx.ping": EventEnvelope<Ping>;
    }>("dx.orders.ex", {
      exchangeType: "topic",
      routingKey: "dx.order.created",
      publisherConfirms: true,
      maxMessageBytes: 256 * 1024,
    });

  const orderCreated = event("dx.order.created", "v1").of<OrderCreated>();
  const ping = event("dx.ping", "v1").of<Ping>();

  const order = withCorrelation(
    withHeaders(
      orderCreated({
        orderId: "o-1001",
        amount: 42,
      }),
      {
        tenantId: "tenant-1",
        source: "dx.publisher",
      }
    ),
    "corr-demo-1"
  );

  console.log("[publisher] sending order");
  await pub.produce(order);

  console.log("[publisher] sending duplicate order with same event id");
  await pub.produce(order);

  console.log("[publisher] sending RPC ping");
  const reply = await pub.request<Pong>(
    withHeaders(
      ping({
        id: "ping-1",
      }),
      {
        source: "dx.publisher",
      }
    ),
    {
      timeoutMs: 5000,
      routingKey: "dx.ping",
    }
  );

  console.log("[publisher] RPC reply:", reply);

  console.log("[publisher] testing message size guard");

  try {
    await pub.publish(
      orderCreated({
        orderId: "too-large",
        amount: 1,
        note: "x".repeat(300 * 1024),
      }),
      {
        maxMessageBytes: 8 * 1024,
      }
    );
  } catch (err) {
    if (err instanceof MessageTooLargeError) {
      console.log("[publisher] caught MessageTooLargeError:", {
        eventName: err.eventName,
        sizeBytes: err.sizeBytes,
        maxBytes: err.maxBytes,
      });
    } else {
      throw err;
    }
  }

  await broker.close();
})();
