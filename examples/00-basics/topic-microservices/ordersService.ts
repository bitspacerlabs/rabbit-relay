import { RabbitMQBroker, event } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Order = { orderId: string; items: Array<{ sku: string; qty: number }> };
type Ev = EventEnvelope<Order>;

(async () => {
  const EX = "orders_exchange";
  const broker = new RabbitMQBroker("orders_service");

  // Exchange-only: publish to EX without declaring any queue or binding
  const pub = await broker.exchange<{ orderCreated: Ev }>(EX, {
    exchangeType: "topic",
  });

  const mkOrderCreated = event("orderCreated", "v1").of<Order>();

  let n = 1;
  console.log("[orders] emitting orderCreated every ~1s");
  (async function tick() {
    const order: Order = {
      orderId: `o-${Date.now()}-${n++}`,
      items: [{ sku: "coffee", qty: 1 }],
    };

    try {
      await pub.produce(mkOrderCreated(order));
    } catch (err) {
      console.error("[orders] publish error:", err);
    }

    setTimeout(tick, 1000);
  })();
  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await broker.close();
    process.exit(0);
  });
})();