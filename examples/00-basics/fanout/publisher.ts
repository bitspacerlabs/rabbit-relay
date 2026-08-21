import { RabbitMQBroker, event } from "../../../lib";
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
  (async function tick() {
    const ev = mk({ seq, msg: `hello #${seq}` });

    try {
      await pub.produce(ev);
      console.log(`[fanout/publisher] sent seq=${seq}`);
    } catch (err) {
      console.error("[fanout/publisher] publish error:", err);
    }

    seq++;
    setTimeout(tick, 400);
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