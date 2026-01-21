import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type AuthorizeReq = { orderId: string; amount: number; currency?: string };
type AuthorizeRes = { orderId: string; approved: boolean; authId?: string };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const EX = "rpc.demo";
  const REQ_KEY = "payments.authorize";
  const Q = "payments_rpc_queue";

  const broker = new RabbitMQBroker("rpc.responder.slow");

  const iface = await broker
    .queue(Q)
    .exchange<{ [REQ_KEY]: EventEnvelope<AuthorizeReq> }>(EX, {
      exchangeType: "topic",
      routingKey: REQ_KEY,
    });

  iface.handle(REQ_KEY as any, async (_id, ev) => {
    console.log("[responder.slow] received:", ev.data);

    const { orderId } = ev.data;
    await sleep(Number(process.env.WORK_MS ?? 3000));

    const authId = `slow_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[responder.slow] approved ${orderId} -> ${authId}`);
    return { orderId, approved: true, authId } as AuthorizeRes;
  });

  const PREFETCH = Number(process.env.PREFETCH ?? 1);
  await iface.consume({ prefetch: PREFETCH, concurrency: PREFETCH });

  console.log(`[responder.slow] listening (work=${process.env.WORK_MS ?? 3000}ms)`);
})();