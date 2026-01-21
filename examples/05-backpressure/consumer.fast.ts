import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number; note: string; pad: string };
type BpEvent = EventEnvelope<Payload>;

(async () => {
  const EX = "bp.demo";
  const Q  = "bp_queue";
  const KEY = "#";

  const PREFETCH = Number(process.env.PREFETCH ?? 200);

  const broker = new RabbitMQBroker("bp.consumer.fast");
  const sub = await broker
    .queue(Q)
    .exchange<{ "bp.msg": BpEvent }>(EX, {
      exchangeType: "topic",
      routingKey: KEY,
    });

  sub.handle("bp.msg", async (_id, ev) => {
    if (ev.data.seq % 2000 === 0) {
      console.log(`[fast] processed seq=${ev.data.seq}`);
    }
  });

  await sub.consume({ prefetch: PREFETCH, concurrency: PREFETCH });
  console.log(`[consumer.fast] running with prefetch=${PREFETCH}`);
})();
