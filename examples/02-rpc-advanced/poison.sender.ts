import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type AuthorizeReq = { orderId: string; amount: number; poison?: boolean };

(async () => {
  const EX = "rpc.demo";
  const REQ_KEY = "payments.authorize";
  const DUMMY_Q = "orders_rpc_client_queue";

  const broker = new RabbitMQBroker("rpc.poison.sender");

  const pub = await broker
    .queue(DUMMY_Q)
    .exchange<{ [REQ_KEY]: EventEnvelope<AuthorizeReq> }>(EX, {
      exchangeType: "topic",
      routingKey: REQ_KEY,
      publisherConfirms: true,
    });

  const makeAuthorize = event(REQ_KEY, "v1").of<AuthorizeReq>();

  const bad = makeAuthorize({ orderId: "poison_1", amount: 9999, poison: true });

  console.log("[poison.sender] → sending poison message");
  await pub.produce(bad);
  console.log("[poison.sender] ✓ poison message published");
  process.exit(0);
})();