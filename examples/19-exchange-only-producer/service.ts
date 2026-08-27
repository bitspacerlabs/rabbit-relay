import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Order = { orderId: string; items: Array<{ sku: string; qty: number }> };
type Ev = EventEnvelope<Order>;

(async () => {
  const EX = "orders_exchange";
  const broker = new RabbitMQBroker("orders_publisher", {
    exchangeType: "topic",
    durable: true,
  });

  // Exchange-only topology: the producer declares only the exchange it
  // publishes to. It does NOT declare any queue or binding - queue and
  // binding ownership belong to the consumer in a multi-process setup.
  const pub = await broker.exchange<{ orderCreated: Ev }>(EX, {
    exchangeType: "topic",
  });

  const mkOrderCreated = event("orderCreated", "v1").of<Order>();

  console.log("[orders-publisher] exchange-only topology declared:", EX);
  console.log(
    "[orders-publisher] plan (no queues, no bindings):",
    JSON.stringify(pub.planTopology(), null, 2)
  );

  let n = 1;
  console.log("[orders-publisher] emitting orderCreated every ~1s");
  (async function tick() {
    const order: Order = {
      orderId: `o-${Date.now()}-${n++}`,
      items: [{ sku: "coffee", qty: 1 }],
    };

    try {
      await pub.produce(mkOrderCreated(order));
      console.log("[orders-publisher] published", order.orderId);
    } catch (err) {
      console.error("[orders-publisher] publish error:", err);
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
