import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Req = { orderId: string; amount: number; currency: string };
type ChargeEvent = EventEnvelope<Req>;

(async () => {
  const EX = "rpc.payments";
  const Q  = "orders_rpc_client_queue";
  const TIMEOUT_MS = 5000;

  const broker = new RabbitMQBroker("rpc.requester");

  const cli = await broker
    .queue(Q)
    .exchange<{ "payments.charge": ChargeEvent }>(EX, {
      exchangeType: "topic",
      routingKey: "#",
    });

  const charge = event("payments.charge", "v1").of<Req>();

  const ev = charge({
    orderId: "o-1001",
    amount: 42,
    currency: "USD",
  });

  ev.meta = {
    expectsReply: true,
    timeoutMs: TIMEOUT_MS,
  };

  console.log("[Requester] sending charge request");

  try {
    const reply = await cli.produce(ev);
    console.log("[Requester] reply:", reply);
  } catch (err) {
    console.error("[Requester] ERROR:", err);
  }
})();
