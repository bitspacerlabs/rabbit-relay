import { RabbitMQBroker } from "../../../lib";
import { event } from "../../../lib/eventFactories";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; msg: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "fanout.basic";
  const broker = new RabbitMQBroker("fanout.publisher");

  const pub = await broker
    .queue("fanout.publisher.q")
    .exchange<{ broadcast: Ev }>(EX, { exchangeType: "fanout" });

  const mk = event("broadcast", "v1").of<Payload>();

  let seq = 1;
  console.log("[fanout/publisher] broadcasting to all bound queues");
  (function tick() {
    const ev = mk({ seq, msg: `hello #${seq}` });
    pub.produce(ev)
      .then(() => console.log(`[fanout/publisher] sent seq=${seq}`))
      .catch(err => console.error("[fanout/publisher] publish error:", err))
      .finally(() => { seq++; setTimeout(tick, 400); });
  })();
})();