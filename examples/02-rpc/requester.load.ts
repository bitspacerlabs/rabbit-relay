import { RabbitMQBroker } from "../../lib";
import { event } from "../../lib/eventFactories";
import type { EventEnvelope } from "../../lib";

type Req = { orderId: string; amount: number; currency: string };
type ChargeEvent = EventEnvelope<Req>;

(async () => {
  const EX = "rpc.payments";
  const Q  = "orders_rpc_client_queue";
  const N = Number(process.env.N ?? 20);            // how many requests
  const CONC = Number(process.env.CONCURRENCY ?? 5);
  const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 3000);

  const broker = new RabbitMQBroker("rpc.requester.load");

  const cli = await broker
    .queue(Q)
    .exchange<{ "payments.charge": ChargeEvent }>(EX, {
      exchangeType: "topic",
      routingKey: "#",
    });

  const charge = event("payments.charge", "v1").of<Req>();

  let inFlight = 0;
  let sent = 0;
  let ok = 0;
  let fail = 0;

  const pump = async () => {
    while (sent < N && inFlight < CONC) {
      sent++;
      inFlight++;

      const ev = charge({ orderId: `o-${sent}`, amount: sent, currency: "USD" });
      ev.meta = { ...(ev.meta || {}), expectsReply: true, timeoutMs: TIMEOUT_MS };

      cli.produce(ev)
        .then((r) => {
          if (r) ok++; else fail++; // r is null if responder threw
        })
        .catch(() => { fail++; })
        .finally(() => {
          inFlight--;
          if (ok + fail === N) {
            console.log(`[Requester:load] done N=${N} ok=${ok} fail=${fail}`);
          } else {
            void pump();
          }
        });
    }
  };

  await pump();
})();
