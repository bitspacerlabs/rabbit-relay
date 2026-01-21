import { RabbitMQBroker, event, EventEnvelope } from "../../lib";
import { registerPlugins } from "./register";

registerPlugins("plugins.publisher");

type Payload = { seq: number; msg: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const broker = new RabbitMQBroker("plugins.publisher");

  const pub = await broker
    .queue("plugins_demo_q") // queue is irrelevant for publishing; still asserted/bound
    .exchange<{ "demo.ping": Ev }>("plugins_demo_ex", {
      exchangeType: "topic",
      routingKey: "demo.*",
      publisherConfirms: true,
    });

  const mk = event("demo.ping", "v1").of<Payload>();

  let seq = 1;
  async function tick() {
    await pub.produce(mk({ seq, msg: `hello #${seq}` }));
    seq += 1;
    setTimeout(tick, 700);
  }

  console.log("[plugins/publisher] started");
  tick();
})();
