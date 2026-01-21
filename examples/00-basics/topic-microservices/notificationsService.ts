import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type AnyEv = EventEnvelope<any>;

(async () => {
  const broker = new RabbitMQBroker("notifications_service");

  // Listen to payments events
  const pay = await broker
    .queue("notifications_payments_q")
    .exchange<{ paymentProcessed: AnyEv }>("payments_exchange", { exchangeType: "topic" });

  pay.handle("*", async (_id, ev) => {
    console.log("[notifications/payments] event:", ev.name, ev.data);
  });
  await pay.consume({ prefetch: 50, concurrency: 10 });

  // Listen to shipping events
  const ship = await broker
    .queue("notifications_shipping_q")
    .exchange<{ shippingStarted: AnyEv }>("shipping_exchange", { exchangeType: "topic" });

  ship.handle("*", async (_id, ev) => {
    console.log("[notifications/shipping] event:", ev.name, ev.data);
  });
  await ship.consume({ prefetch: 50, concurrency: 10 });

  console.log("[notifications] listening on payments + shipping");
})();
