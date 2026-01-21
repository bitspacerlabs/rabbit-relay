import { RabbitMQBroker, event } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payment = { orderId: string; status: "paid"; transactionId: string };
type Ship = { orderId: string; status: "shipped"; trackingId: string };

type PaymentEv = EventEnvelope<Payment>;
type ShipEv    = EventEnvelope<Ship>;

(async () => {
  const PAY_EX = "payments_exchange";
  const SHIP_EX = "shipping_exchange";

  const broker = new RabbitMQBroker("shipping_service");

  const sub = await broker
    .queue("shipping_queue")
    .exchange<{ paymentProcessed: PaymentEv }>(PAY_EX, { exchangeType: "topic" });

  const pub = await broker
    .queue("shipping_publish_queue")
    .exchange<{ shippingStarted: ShipEv }>(SHIP_EX, { exchangeType: "topic" });

  const mkShippingStarted = event("shippingStarted", "v1").of<Ship>();

  sub.handle("paymentProcessed", async (_id, ev) => {
    console.log("[shipping] paymentProcessed:", ev.data);
    const ship: Ship = {
      orderId: ev.data.orderId,
      status: "shipped",
      trackingId: `track-${Math.random().toString(36).slice(2, 9)}`,
    };
    await pub.produce(mkShippingStarted(ship));
  });

  await sub.consume({ prefetch: 50, concurrency: 10 });
  console.log("[shipping] listening");
})();
