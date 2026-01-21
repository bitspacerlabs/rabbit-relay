import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Req = { orderId: string; amount: number; currency: string };
type Res = { ok: true; orderId: string; transactionId: string } | { ok: false; reason: string };
type ChargeEvent = EventEnvelope<Req>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const EX = "rpc.payments";     // topic exchange (asserted for you)
  const Q  = "payments_rpc_queue";

  const broker = new RabbitMQBroker("rpc.payments.responder");

  const srv = await broker
    .queue(Q)
    .exchange<{ "payments.charge": ChargeEvent }>(EX, {
      exchangeType: "topic",
      routingKey: "#", // we publish with routingKey = event name
    });

  srv.handle("payments.charge", async (_id, ev): Promise<Res> => {
    const { orderId, amount, currency } = ev.data;

    // Optional: simulate variable latency / failures to test timeouts.
    if (process.env.FAIL_IF_AMOUNT === "1" && amount % 7 === 0) {
      // Throwing -> reply will be `{ reply: null }` (requester sees null)
      throw new Error("intermittent PSP failure");
    }
    if (process.env.SLOW_MS) await sleep(Number(process.env.SLOW_MS));

    // Do your real charge logic here
    const txn = `txn_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[Responder] charged ${amount} ${currency} for ${orderId} -> ${txn}`);
    return { ok: true, orderId, transactionId: txn };
  });

  await srv.consume({ prefetch: 50, concurrency: 10 });
  console.log("[Responder] payments.charge listening");
})();
