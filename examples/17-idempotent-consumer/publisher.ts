import { event } from "../../lib/index.js";
import { RabbitMQBroker } from "../../lib/index.js";

const EXCHANGE = "idempotent.demo.ex";
const QUEUE = "idempotent.demo.q";

const orderCreated = event("order.created", "v1").schema(
  // Use Zod or any validator in production; plain object here for zero-dependency example
  { parse: (input: unknown) => input as { orderId: string; amount: number } }
);

(async () => {
  const broker = new RabbitMQBroker("idempotent.publisher");

  const pub = await broker.queue("idempotent.publisher.q").exchange(EXCHANGE, {
    exchangeType: "topic",
    publisherConfirms: true,
  });

  async function publishUnique() {
    const ev = orderCreated({
      orderId: `order_${Date.now()}`,
      amount: Math.round(Math.random() * 10000) / 100,
    });

    await pub.produce(ev);
    console.log(`[publisher] published ${ev.id} (orderId=${ev.data.orderId})`);
  }

  async function publishDupe() {
    const ev = orderCreated({
      orderId: `order_${Date.now()}`,
      amount: Math.round(Math.random() * 10000) / 100,
    });

    await pub.produce(ev);
    console.log(`[publisher] published ${ev.id} (original)`);

    // Simulate a redelivery: same event ID, same payload
    await pub.produce(ev);
    console.log(`[publisher] published ${ev.id} (duplicate - same id!)`);
  }

  console.log(`Publishing to exchange '${EXCHANGE}'`);

  // Publish a few unique events
  await publishUnique();
  await new Promise((r) => setTimeout(r, 300));

  // Publish one with an intentional duplicate
  await publishDupe();
  await new Promise((r) => setTimeout(r, 300));

  await publishUnique();

  await broker.close();
  console.log("[publisher] done");

})();
