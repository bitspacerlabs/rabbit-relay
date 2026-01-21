import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type AuthorizeReq = { orderId: string; amount: number; currency?: string };
type AuthorizeRes = { orderId: string; approved: boolean; authId?: string; reason?: string };

(async () => {
  const EX = "rpc.demo";
  const REQ_KEY = "payments.authorize";
  const DUMMY_Q = "orders_rpc_client_queue";

  const TOTAL = Number(process.env.TOTAL ?? 20);
  const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
  const TIMEOUT = Number(process.env.RPC_TIMEOUT_MS ?? 5000);

  const broker = new RabbitMQBroker("rpc.requester.advanced");

  const rpc = await broker
    .queue(DUMMY_Q)
    .exchange<{ [REQ_KEY]: EventEnvelope<AuthorizeReq> }>(EX, {
      exchangeType: "topic",
      routingKey: REQ_KEY,
      publisherConfirms: true,
    });

  const makeAuthorize = event(REQ_KEY, "v1").of<AuthorizeReq>();

  let inFlight = 0;
  let sent = 0;
  let done = 0;

  const pump = async () => {
    while (inFlight < CONCURRENCY && sent < TOTAL) {
      inFlight++;
      sent++;

      const req = makeAuthorize({
        orderId: `ord_${sent}`,
        amount: 100 + (sent % 5) * 200,
        currency: "USD",
      });

      req.meta = { expectsReply: true, timeoutMs: TIMEOUT };

      console.log(`[requester] → sending ${req.data.orderId} amount=${req.data.amount}`);

      rpc.produce(req)
        .then((reply) => {
          console.log(`[requester] ← reply for ${req.data.orderId}:`, reply as AuthorizeRes);
        })
        .catch((err) => {
          console.error(`[requester] ✖ error for ${req.data.orderId}:`, err.message);
        })
        .finally(() => {
          inFlight--;
          done++;
          if (done === TOTAL) {
            console.log("[requester] all requests completed");
            process.exit(0);
          }
          pump();
        });
    }
  };

  console.log(`[requester] sending ${TOTAL} RPCs (concurrency=${CONCURRENCY}, timeout=${TIMEOUT}ms)`);
  pump();
})();