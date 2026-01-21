import { RabbitMQBroker } from "../../../lib";
import { event } from "../../../lib/eventFactories";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const EXCHANGE = "confirms.demo";
  const QUEUE = "confirms_demo_q";

  const broker = new RabbitMQBroker("dedupe.publisher.dupes");

  const pub = await broker
    .queue(QUEUE)
    .exchange<{ "demo.dupe": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "#",
      publisherConfirms: true, // optional but realistic
    });

  const makeDupe = event("demo.dupe", "v1").of<Payload>();

  let seq = 1;
  const PAIR_DELAY_MS = Number(process.env.DUP_PAIR_DELAY_MS ?? 1000);
  const SECOND_SEND_DELAY_MS = Number(process.env.DUP_SECOND_DELAY_MS ?? 100);

  async function sendPair() {
    // ONE envelope -> same id twice
    const ev = makeDupe({ seq });

    await pub.produce(ev);
    console.log(`[publisher] sent seq=${seq} id=${ev.id}`);

    setTimeout(async () => {
      await pub.produce(ev);
      console.log(`[publisher] sent DUPLICATE seq=${seq} id=${ev.id}`);
    }, SECOND_SEND_DELAY_MS);

    seq++;
    setTimeout(sendPair, PAIR_DELAY_MS);
  }

  console.log("[publisher] sending duplicate pairs…");
  sendPair();
})();
