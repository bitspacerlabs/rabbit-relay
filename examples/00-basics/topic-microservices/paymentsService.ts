import { RabbitMQBroker, event } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Order = { orderId: string; items: Array<{ sku: string; qty: number }> };
type Payment = { orderId: string; status: "paid"; transactionId: string };

type OrderEv = EventEnvelope<Order>;
type PaymentEv = EventEnvelope<Payment>;

(async () => {
  const ORDERS_EX = "orders_exchange";
  const PAY_EX    = "payments_exchange";

  const broker = new RabbitMQBroker("payments_service");

  const sub = await broker
    .queue("payments_queue")
    .exchange<{ orderCreated: OrderEv }>(ORDERS_EX, { exchangeType: "topic" });

  const payPub = await broker
    .queue("payments_publish_queue")
    .exchange<{ paymentProcessed: PaymentEv }>(PAY_EX, { exchangeType: "topic" });

  const mkPaymentProcessed = event("paymentProcessed", "v1").of<Payment>();

  sub.handle("orderCreated", async (_id, ev) => {
    console.log("[payments] received orderCreated:", ev.data);
    const payment: Payment = {
      orderId: ev.data.orderId,
      status: "paid",
      transactionId: `txn-${Math.random().toString(36).slice(2, 9)}`,
    };
    await payPub.produce(mkPaymentProcessed(payment));
  });

  await sub.consume({ prefetch: 50, concurrency: 10 });
  console.log("[payments] listening");
})();
