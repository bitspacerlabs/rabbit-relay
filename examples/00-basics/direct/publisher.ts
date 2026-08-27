import { RabbitMQBroker, event } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; note: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const EX = "direct.basic";
  const broker = new RabbitMQBroker("direct.publisher");

  // Exchange-only: the producer declares just the exchange it publishes to
  const pub = await broker.exchange<{ alpha: Ev; beta: Ev }>(EX, {
    exchangeType: "direct",
  });

  const mkAlpha = event("alpha", "v1").of<Payload>();
  const mkBeta  = event("beta",  "v1").of<Payload>();

  let seq = 1;
  console.log("[direct/publisher] alternating alpha/beta");
  (async function tick() {
    const isAlpha = seq % 2 === 1;
    const payload = { seq, note: isAlpha ? "to alpha" : "to beta" };
    const ev = isAlpha ? mkAlpha(payload) : mkBeta(payload);

    try {
      await pub.produce(ev);
      console.log(`[direct/publisher] sent seq=${seq} key=${isAlpha ? "alpha" : "beta"}`);
    } catch (err) {
      console.error("[direct/publisher] publish error:", err);
    }

    seq++;
    setTimeout(tick, 250);
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
