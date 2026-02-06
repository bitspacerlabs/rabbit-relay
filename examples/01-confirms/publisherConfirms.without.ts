import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const broker = new RabbitMQBroker("no-confirms.publisher");

  const pub = await broker
    .queue("no_confirms_q")
    .exchange<{ "demo.tick": DemoEvent }>("no_confirms_ex", {
      exchangeType: "topic",
      routingKey: "demo.tick",
    });

  const makeTick = event("demo.tick", "v1").of<Payload>();

  let seq = 1;

  setInterval(async () => {
    const ev = makeTick({ seq });

    console.log(`[NO-CONFIRM] sending seq=${seq}`);

    // resolves immediately after socket write
    await pub.produce(ev);

    console.log(`[NO-CONFIRM] SENT seq=${seq}`);
    seq++;
  }, 1000);
})();
