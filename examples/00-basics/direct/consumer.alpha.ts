import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; note: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "direct.basic";
  const broker = new RabbitMQBroker("direct.consumer.alpha");

  // Bind this queue to the 'alpha' routing key
  const sub = await broker
    .queue("direct.alpha.q")
    .exchange<{ alpha: Ev }>(EX, { exchangeType: "direct", routingKey: "alpha" });

  sub.handle("alpha", async (_id, ev) => {
    console.log(`[direct/alpha] OK   seq=${ev.data.seq} note=${ev.data.note}`);
  });

  await sub.consume({ prefetch: 50, concurrency: 10 });
  console.log("[direct/consumer.alpha] listening");
})();
