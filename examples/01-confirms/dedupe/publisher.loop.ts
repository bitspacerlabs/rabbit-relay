import { RabbitMQBroker } from "../../../lib";
import { event } from "../../../lib/eventFactories";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const EXCHANGE = "confirms.demo";
  const QUEUE = "confirms_demo_q";

  const broker = new RabbitMQBroker("dedupe.publisher.loop");

  const pub = await broker
    .queue(QUEUE)
    .exchange<{ "demo.tick": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "#",
      publisherConfirms: true,
    });

  const makeTick = event("demo.tick", "v1").of<Payload>();

  let seq = 1;
  const INTERVAL_MS = Number(process.env.PUBLISH_INTERVAL_MS ?? 300);

  async function tick() {
    const ev = makeTick({ seq });
    await pub.produce(ev);
    console.log(`[publisher.loop] sent seq=${seq} id=${ev.id}`);
    seq++;
    setTimeout(tick, INTERVAL_MS);
  }

  console.log("[publisher.loop] publishing unique events…");
  tick();
})();
