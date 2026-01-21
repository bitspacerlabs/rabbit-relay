import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number; note: string; pad: string };
type BpEvent = EventEnvelope<Payload>;

(async () => {
  const EX = "bp.demo";
  const Q  = "bp_queue";
  const KEY = "#";

  // Big messages help trigger socket backpressure sooner
  const BYTES = Number(process.env.BP_MSG_SIZE ?? 200_000); // 200 KB default
  const TOTAL = Number(process.env.BP_TOTAL ?? 50_000);     // how many to try

  const broker = new RabbitMQBroker("bp.publisher");
  const pub = await broker
    .queue(Q)
    .exchange<{ "bp.msg": BpEvent }>(EX, {
      exchangeType: "topic",
      routingKey: KEY,
      // IMPORTANT: leave publisherConfirms=false to maximize send rate and reveal backpressure
      publisherConfirms: false,
    });

  const make = event("bp.msg", "v1").of<Payload>();
  const pad = "x".repeat(BYTES);

  let seq = 0;
  function loop() {
    if (seq >= TOTAL) {
      console.log(`[publisher] done TOTAL=${TOTAL}`);
      return;
    }
    seq += 1;
    const ev = make({ seq, note: "heavy publish", pad });

    // Fire-and-continue; publishWithBackpressure inside the broker will await 'drain' when needed
    pub.produce(ev).then(() => {
      if (seq % 1000 === 0) console.log(`[publisher] sent ${seq}`);
      // schedule the next immediately to push hard
      setImmediate(loop);
    }).catch(err => {
      console.error(`[publisher] error at seq=${seq}`, err);
      setImmediate(loop);
    });
  }

  console.log(`[publisher] blasting… size=${BYTES} bytes, total=${TOTAL}`);
  loop();
})();
