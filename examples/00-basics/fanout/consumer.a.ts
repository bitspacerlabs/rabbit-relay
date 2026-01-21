import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; msg: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "fanout.basic";
  const broker = new RabbitMQBroker("fanout.consumer.a");

  // With fanout, the binding key is ignored; default is fine.
  const sub = await broker
    .queue("fanout.a.q")
    .exchange<{ broadcast: Ev }>(EX, { exchangeType: "fanout" });

  sub.handle("broadcast", async (_id, ev) => {
    console.log(`[fanout/A] seq=${ev.data.seq} msg=${ev.data.msg}`);
  });

  await sub.consume({ prefetch: 50, concurrency: 10 });
  console.log("[fanout/consumer.a] listening");
})();
