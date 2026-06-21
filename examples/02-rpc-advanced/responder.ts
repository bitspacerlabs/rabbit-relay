import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type AuthorizeReq = {
  orderId: string;
  amount: number;
  currency?: string;
  poison?: boolean;
};

type AuthorizeRes = {
  orderId: string;
  approved: boolean;
  authId?: string;
  reason?: string;
};

type Events = {
  "payments.authorize": EventEnvelope<AuthorizeReq>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const EXCHANGE = "rpc.demo";
  const ROUTING_KEY = "payments.authorize";
  const QUEUE = "payments_rpc_queue";

  const broker = new RabbitMQBroker("rpc.responder");

  const iface = await broker
    .queue(QUEUE)
    .exchange<Events>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: ROUTING_KEY,
    });

  iface.handle("payments.authorize", async (_id, ev) => {
    console.log("[responder] received:", ev.data);

    const { orderId, amount, poison } = ev.data;

    if (poison) {
      console.log(`[responder] poison message received ${orderId}`);
      return {
        orderId,
        approved: false,
        reason: "poison message ignored",
      } satisfies AuthorizeRes;
    }

    await sleep(Number(process.env.WORK_MS ?? 50));

    if (amount > 500) {
      console.log(`[responder] declined ${orderId}`);
      return {
        orderId,
        approved: false,
        reason: "Amount over limit",
      } satisfies AuthorizeRes;
    }

    const authId = `auth_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[responder] approved ${orderId} -> ${authId}`);

    return {
      orderId,
      approved: true,
      authId,
    } satisfies AuthorizeRes;
  });

  const PREFETCH = Number(process.env.PREFETCH ?? 50);

  await iface.consume({
    prefetch: PREFETCH,
    concurrency: PREFETCH,
  });

  console.log(`[responder] listening (prefetch=${PREFETCH})`);
})();
