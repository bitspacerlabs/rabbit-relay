import { RabbitMQBroker } from "../../../lib";
import type { EventEnvelope } from "../../../lib";
import { makeMemoryDedupe } from "../../../lib/utils/dedupe";

type Payload = { seq: number; label?: string };
type DemoEvent = EventEnvelope<Payload>;

(async () => {
  const EXCHANGE = "confirms.demo";
  const QUEUE = "confirms_demo_q";

  // In-memory dedupe (TTL + max keys configurable via env)
  const dedupe = makeMemoryDedupe({
    ttlMs: Number(process.env.DEDUPE_TTL_MS ?? 60_000),
    maxKeys: Number(process.env.DEDUPE_MAX_KEYS ?? 100_000),
  });

  const broker = new RabbitMQBroker("dedupe.consumer");

  const sub = await broker
    .queue(QUEUE)
    .exchange<{ "*": DemoEvent }>(EXCHANGE, {
      exchangeType: "topic",
      routingKey: "#",
    });

  sub.handle("*", async (_deliveryTag, ev) => {
    // Idempotency check
    if (!dedupe.checkAndRemember(ev)) {
      console.log(
        `[consumer] DROP duplicate id=${ev.id} name=${ev.name} seq=${ev.data?.seq ?? "?"}`
      );
      return;
    }

    console.log(
      `[consumer] OK   id=${ev.id} name=${ev.name} seq=${ev.data?.seq ?? "?"}`
    );

    // simulate work
    await new Promise((r) => setTimeout(r, 50));
  });

  const PREFETCH = Number(process.env.PREFETCH ?? 10);
  const CONCURRENCY = Number(process.env.CONCURRENCY ?? PREFETCH);

  await sub.consume({ prefetch: PREFETCH, concurrency: CONCURRENCY });

  console.log(
    `[consumer] dedupe running (ttl=${process.env.DEDUPE_TTL_MS ?? "60s"}, maxKeys=${process.env.DEDUPE_MAX_KEYS ?? "100k"})`
  );
})();
