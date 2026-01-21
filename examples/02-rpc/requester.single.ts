import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Req = { orderId: string; amount: number; currency: string };
type ChargeEvent = EventEnvelope<Req>;

(async () => {
  const EX = "rpc.payments";
  const Q  = "orders_rpc_client_queue"; // just a name for the requester side (no special meaning)
  const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 5000);

  const broker = new RabbitMQBroker("rpc.requester.single");

  const cli = await broker
    .queue(Q)
    .exchange<{ "payments.charge": ChargeEvent }>(EX, {
      exchangeType: "topic",
      routingKey: "#",
      // confirms not required; RPC path uses a temp reply queue internally
    });

  const charge = event("payments.charge", "v1").of<Req>();

  const ev = charge({ orderId: "o-1001", amount: 42, currency: "USD" });
  ev.meta = { ...(ev.meta || {}), expectsReply: true, timeoutMs: TIMEOUT_MS };

  try {
    const reply = await cli.produce(ev); // resolved with responder's `{ reply }`
    console.log("[Requester:single] reply:", reply);
  } catch (e) {
    console.error("[Requester:single] ERROR:", e);
  }
})();
