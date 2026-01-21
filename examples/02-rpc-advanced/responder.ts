import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type AuthorizeReq = { orderId: string; amount: number; currency?: string };
type AuthorizeRes = { orderId: string; approved: boolean; authId?: string; reason?: string };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const EX = "rpc.demo";
  const REQ_KEY = "payments.authorize";
  const Q = "payments_rpc_queue";

  const broker = new RabbitMQBroker("rpc.responder");

  const iface = await broker
    .queue(Q)
    .exchange<{ [REQ_KEY]: EventEnvelope<AuthorizeReq> }>(EX, {
      exchangeType: "topic",
      routingKey: REQ_KEY,
    });

  iface.handle(REQ_KEY as any, async (_id, ev) => {
    console.log("[responder] received:", ev.data);

    const { orderId, amount } = ev.data;
    await sleep(Number(process.env.WORK_MS ?? 50));

    if (amount > 500) {
      console.log(`[responder] declined ${orderId}`);
      return { orderId, approved: false, reason: "Amount over limit" } as AuthorizeRes;
    }

    const authId = `auth_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[responder] approved ${orderId} -> ${authId}`);
    return { orderId, approved: true, authId } as AuthorizeRes;
  });

  const PREFETCH = Number(process.env.PREFETCH ?? 50);
  await iface.consume({ prefetch: PREFETCH, concurrency: PREFETCH });

  console.log(`[responder] listening (prefetch=${PREFETCH})`);
})();