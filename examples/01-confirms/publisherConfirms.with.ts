import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = { seq: number };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const broker = new RabbitMQBroker("confirms.publisher");

  const pub = await broker.exchange<{ "demo.tick": DemoEvent }>("confirms_ex", {
    exchangeType: "topic",
    routingKey: "demo.tick",
    publisherConfirms: true,
  });

  const makeTick = event("demo.tick", "v1").of<Payload>();

  let seq = 1;

  setInterval(async () => {
    const ev = makeTick({ seq });

    try {
      console.log(`[CONFIRM] sending seq=${seq}`);

      // resolves only after broker ACK
      await pub.produce(ev);

      console.log(`[CONFIRM] CONFIRMED seq=${seq}`);
    } catch (err) {
      console.error(`[CONFIRM] NOT CONFIRMED seq=${seq}`, err);
    }

    seq++;
  }, 1000);
  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await broker.close();
    process.exit(0);
  });
})();
