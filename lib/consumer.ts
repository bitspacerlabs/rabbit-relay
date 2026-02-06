import { Channel, ConsumeMessage } from "amqplib";
import { pluginManager } from "./pluginManager";
import { EventEnvelope } from "./eventFactories";
import { ConsumeOptions } from "./types";
import { publishWithBackpressure } from "./backpressure";

export type HandlerMap = Map<string, (id: string | number, event: EventEnvelope) => Promise<unknown>>;

export function createConsumer(params: {
  queueName: string;
  handlers: HandlerMap;
}) {
  const { queueName, handlers } = params;

  let consumerTag: string | undefined;
  let isConsuming = false;
  let consumeCh: Channel | null = null;
  let prefetchCount = 1;
  // Note: concurrency is *effectively* enforced via prefetch as in the original file.
  let concurrency = 1;
  let onError: "ack" | "requeue" | "dead-letter" = "ack";

  const onMessage = async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const ch = consumeCh;
    if (!ch) return;

    const id = msg.fields.deliveryTag;
    const payload = JSON.parse(msg.content.toString()) as EventEnvelope;

    const handler = (handlers.get(payload.name) as any) || (handlers.get("*") as any);

    let result: unknown = null;
    let errored = false;
    try {
      await pluginManager.executeHook("beforeProcess", id, payload);
      if (handler) {
        result = await handler(id, payload as any);
      }
      await pluginManager.executeHook("afterProcess", id, payload, result);
    } catch (err) {
      errored = true;
      console.error("Handler error:", err);
    }

    // RPC reply path (even if handler errored, you might still want a reply)
    if (msg.properties.replyTo) {
      try {
        await publishWithBackpressure(
          ch,
          "",
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ reply: errored ? null : result })),
          { correlationId: msg.properties.correlationId }
        );
      } catch (e) {
        console.error("Reply publish failed:", e);
      }
    }

    // Ack/Nack decision
    try {
      if (errored) {
        if (onError === "requeue") {
          ch.nack(msg, false, true); // requeue back to same queue
        } else if (onError === "dead-letter") {
          ch.nack(msg, false, false); // route to DLX (if queue is DLX-configured)
        } else {
          ch.ack(msg); // swallow the error
        }
      } else {
        ch.ack(msg);
      }
    } catch (e) {
      console.error("Ack/Nack failed:", e);
    }
  };

  async function startConsume(getChannel: () => Promise<Channel>, opts?: ConsumeOptions) {
    prefetchCount = opts?.prefetch ?? opts?.concurrency ?? 1;
    concurrency = opts?.concurrency ?? prefetchCount;

    // Back-compat: if requeueOnError is set and onError not explicitly provided, use "requeue"
    onError = opts?.onError ?? (opts?.requeueOnError ? "requeue" : "ack");

    const ch = await getChannel();
    consumeCh = ch;

    if (prefetchCount > 0) await ch.prefetch(prefetchCount, false);

    const ok = await ch.consume(queueName, onMessage);
    consumerTag = ok.consumerTag;
    isConsuming = true;

    return {
      stop: async (): Promise<void> => {
        isConsuming = false;
        try {
          const c = consumeCh;
          if (consumerTag && c) await c.cancel(consumerTag);
        } catch {
          // channel may be closed, ignore
        }
      },
    };
  }

  async function resumeOnReconnect(ch: Channel) {
    if (!isConsuming) return;

    if (prefetchCount > 0) await ch.prefetch(prefetchCount, false);
    consumeCh = ch;
    const ok = await ch.consume(queueName, onMessage);
    consumerTag = ok.consumerTag;
  }

  function getState() {
    return { isConsuming, prefetchCount, concurrency, onError };
  }

  return {
    startConsume,
    resumeOnReconnect,
    getState,
  };
}
