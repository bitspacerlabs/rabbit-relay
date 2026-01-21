import { RabbitMQBroker } from "../../../lib";
import { event } from "../../../lib/eventFactories";
import type { EventEnvelope } from "../../../lib";

type Order = { orderId: string; items: Array<{ sku: string; qty: number }> };
type Ev = EventEnvelope<Order>;

(async () => {
  const EX = "orders_exchange";
  const broker = new RabbitMQBroker("orders_service");

  // We'll publish to EX; queue here is only to get a publisher interface.
  const pub = await broker
    .queue("orders_publish_queue")
    .exchange<{ orderCreated: Ev }>(EX, { exchangeType: "topic" });

  const mkOrderCreated = event("orderCreated", "v1").of<Order>();

  let n = 1;
  console.log("[orders] emitting orderCreated every ~1s");
  setInterval(() => {
    const order: Order = {
      orderId: `o-${Date.now()}-${n++}`,
      items: [{ sku: "coffee", qty: 1 }],
    };
    pub.produce(mkOrderCreated(order)).catch(err => console.error("[orders] publish error:", err));
  }, 1000);
})();