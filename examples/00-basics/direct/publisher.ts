import { RabbitMQBroker } from "../../../lib";
import { event } from "../../../lib/eventFactories";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; note: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "direct.basic";
  const broker = new RabbitMQBroker("direct.publisher");

  // Bind a dummy queue; we only use the interface to publish
  const pub = await broker
    .queue("direct.publisher.q")
    .exchange<{ alpha: Ev; beta: Ev }>(EX, { exchangeType: "direct" });

  const mkAlpha = event("alpha", "v1").of<Payload>();
  const mkBeta  = event("beta",  "v1").of<Payload>();

  let seq = 1;
  console.log("[direct/publisher] alternating alpha/beta");
  (function tick() {
    const isAlpha = seq % 2 === 1;
    const payload = { seq, note: isAlpha ? "to alpha" : "to beta" };
    const ev = isAlpha ? mkAlpha(payload) : mkBeta(payload);

    pub.produce(ev)
      .then(() => console.log(`[direct/publisher] sent seq=${seq} key=${isAlpha ? "alpha" : "beta"}`))
      .catch(err => console.error("[direct/publisher] publish error:", err))
      .finally(() => { seq++; setTimeout(tick, 250); });
  })();
})();
