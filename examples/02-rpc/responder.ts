import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Req = { orderId: string; amount: number; currency: string };
type Res = { ok: boolean; transactionId?: string; reason?: string };

(async () => {
  const EX = "rpc.payments";
  const Q  = "payments_rpc_queue";

  const broker = new RabbitMQBroker("rpc.payments.responder");

  const srv = await broker
    .queue(Q)
    .exchange<{ "payments.charge": EventEnvelope<Req> }>(EX, {
      exchangeType: "topic",
      routingKey: "#",
    });

  console.log("[Responder] waiting for payments.charge");

  srv.handle("payments.charge", async (_id, ev): Promise<Res> => {
    const { orderId, amount, currency } = ev.data;

    console.log(`[Responder] charging ${amount} ${currency} for ${orderId}`);

    // simple business logic
    if (amount <= 0) {
      return { ok: false, reason: "invalid amount" };
    }

    const txn = `txn_${Math.random().toString(36).slice(2, 8)}`;
    return { ok: true, transactionId: txn };
  });

  await srv.consume();
})();
