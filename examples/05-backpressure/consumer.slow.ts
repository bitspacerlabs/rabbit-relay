import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number; note: string; pad: string };
type BpEvent = EventEnvelope<Payload>;

(async () => {
  const EX = "bp.demo";
  const Q  = "bp_queue";
  const KEY = "#";

  const SLOW_MS = Number(process.env.BP_SLOW_MS ?? 750); // ~0.75s per msg
  const PREFETCH = Number(process.env.PREFETCH ?? 1);

  const broker = new RabbitMQBroker("bp.consumer.slow");
  const sub = await broker
    .queue(Q)
    .exchange<{ "bp.msg": BpEvent }>(EX, {
      exchangeType: "topic",
      routingKey: KEY,
    });

  sub.handle("bp.msg", async (_id, ev) => {
    // Simulate slow work
    await new Promise(r => setTimeout(r, SLOW_MS));
    if (ev.data.seq % 500 === 0) {
      console.log(`[slow] processed seq=${ev.data.seq}`);
    }
  });

  await sub.consume({ prefetch: PREFETCH, concurrency: PREFETCH });
  console.log(`[consumer.slow] running with prefetch=${PREFETCH}, delay=${SLOW_MS}ms`);
})();
