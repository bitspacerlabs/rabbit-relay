import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";

type Payload = { seq: number; label?: string };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const EXCHANGE = "confirms.demo";
  const QUEUE = "confirms_demo_q";

  const broker = new RabbitMQBroker("dedupe.consumer");

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "*": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "#",
    });

  sub.handle("*", async (_deliveryTag, ev) => {
    console.log(
      `[consumer] OK   id=${ev.id} name=${ev.name} seq=${ev.data?.seq ?? "?"}`
    );

    await new Promise((r) => setTimeout(r, 50));
  });

  const PREFETCH = Number(process.env.PREFETCH ?? 10);
  const CONCURRENCY = Number(process.env.CONCURRENCY ?? PREFETCH);

  await sub.consume({
    prefetch: PREFETCH,
    concurrency: CONCURRENCY,
    dedupe: {
      enabled: true,
      ttlMs: Number(process.env.DEDUPE_TTL_MS ?? 60_000),
      maxKeys: Number(process.env.DEDUPE_MAX_KEYS ?? 100_000),
    },
  });

  console.log(
    `[consumer] dedupe running (ttl=${process.env.DEDUPE_TTL_MS ?? "60s"}, maxKeys=${process.env.DEDUPE_MAX_KEYS ?? "100k"})`
  );
})();
