import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = {
  seq: number;
  message: string;
};

(async () => {
  const broker = new RabbitMQBroker("health.service");

  const iface = await broker
    .queue("health.demo.q")
    .exchange<{ "health.demo": EventEnvelope<Payload> }>("health.demo.ex", {
      exchangeType: "topic",
      routingKey: "health.*",
      publisherConfirms: true,
    });

  iface.handle("health.demo", async (_id, ev) => {
    console.log("[handler] received:", ev.data);
  });

  await iface.consume({
    prefetch: 10,
    concurrency: 2,
    onError: "ack",
  });

  const makeEvent = event("health.demo", "v1").of<Payload>();

  let seq = 1;

  const publishTimer = setInterval(async () => {
    try {
      await iface.produce(
        makeEvent({
          seq,
          message: `hello #${seq}`,
        })
      );
      seq++;
    } catch (err) {
      console.error("[service] publish failed:", err);
    }
  }, 1000);

  const healthTimer = setInterval(async () => {
    try {
      console.log("[health]", await broker.health());
    } catch (err) {
      console.error("[health] failed:", err);
    }
  }, 3000);

  async function shutdown(signal: string) {
    console.log(`[service] received ${signal}, shutting down...`);

    clearInterval(publishTimer);
    clearInterval(healthTimer);

    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log("[service] health + shutdown demo running");
})();
