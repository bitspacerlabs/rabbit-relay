import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; note: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "direct.basic";
  const broker = new RabbitMQBroker("direct.consumer.beta");

    // Bind this queue to the 'beta' routing key
  const sub = await broker
    .queue("direct.beta.q")
    .exchange<{ beta: Ev }>(EX, { exchangeType: "direct", routingKey: "beta" });

  sub.handle("beta", async (_id, ev) => {
    console.log(`[direct/beta]  OK   seq=${ev.data.seq} note=${ev.data.note}`);
  });

  await sub.consume({ prefetch: 50, concurrency: 10 });
  console.log("[direct/consumer.beta] listening");
})();
