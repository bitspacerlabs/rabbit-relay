import { RabbitMQBroker, event } from "../../lib";
import type { EventEnvelope } from "../../lib";

type Payload = {
  seq: number;
  message: string;
};

(async () => {
  const broker = new RabbitMQBroker("health.service", {
    shutdownTimeoutMs: 10_000,
  });

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

  (async function publishTick() {
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
    setTimeout(publishTick, 1000);
  })();

  let healthTimer: ReturnType<typeof setTimeout>;

  (async function healthTick() {
    try {
      console.log("[health]", await broker.health());
    } catch (err) {
      console.error("[health] failed:", err);
    }
    healthTimer = setTimeout(healthTick, 3000);
  })();

  async function shutdown(signal: string) {
    console.log(`[service] received ${signal}, shutting down...`);

    if (healthTimer) clearTimeout(healthTimer);

    await broker.close();

    console.log("[service] shutdown complete");
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log("[service] health + shutdown demo running");
})();
