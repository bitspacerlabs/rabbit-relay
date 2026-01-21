import { RabbitMQBroker } from "../../lib";
import type { EventEnvelope } from "../../lib";
import { registerPlugins } from "./register";

registerPlugins("plugins.consumer");

type Payload = { seq: number; msg: string };
type Ev = EventEnvelope<Payload>;

(async () => {
  const broker = new RabbitMQBroker("plugins.consumer");

  const sub = await broker
    .queue("plugins_demo_q")
    .exchange<{ "demo.ping": Ev }>("plugins_demo_ex", {
      exchangeType: "topic",
      routingKey: "demo.*",
    });

  sub.handle("demo.ping", async (_id, ev) => {
    // Uncomment to see error vs success behavior in hooks:
    // if (ev.data.seq % 5 === 0) throw new Error("simulate consumer failure");
    console.log(`[consumer] got ping #${ev.data.seq}`);
  });

  await sub.consume({ prefetch: 50, concurrency: 10, onError: "ack" });
  console.log("[plugins/consumer] listening");
})();
