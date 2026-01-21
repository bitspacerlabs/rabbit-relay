import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const EXCHANGE = "confirms.demo";
  const QUEUE = "confirms_demo_q";
  const ROUTING_KEY = "demo.tick";

  const broker = new RabbitMQBroker("confirms.publisher");

  const pub = await broker
    .queue(QUEUE)
    .exchange<{ "demo.tick": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: ROUTING_KEY,
      publisherConfirms: true, // enable publisher confirms
    });

  const makeTick = event("demo.tick", "v1").of<Payload>();

  let seq = 1;
  const INTERVAL_MS = Number(process.env.PUBLISH_INTERVAL_MS ?? 1000);

  async function publish() {
    const ev = makeTick({ seq });

    try {
      console.log(`[publisher] sending seq=${seq} id=${ev.id}`);

      // Resolves only after broker ACK
      await pub.produce(ev);

      console.log(`[publisher] ✔ CONFIRMED seq=${seq} id=${ev.id}`);
    } catch (err) {
      console.error(`[publisher] ✖ NOT CONFIRMED seq=${seq}`, err);
    } finally {
      seq++;
      setTimeout(publish, INTERVAL_MS);
    }
  }

  console.log("[publisher] publisher confirms demo running…");
  publish();
})();
