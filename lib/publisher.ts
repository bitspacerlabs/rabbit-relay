import { Channel, Options } from "amqplib";
import { getRabbitMQConfirmChannel } from "./config";
import { pluginManager } from "./pluginManager";
import { EventEnvelope, EventMeta } from "./eventFactories";
import { ExchangeConfig, InternalCfg, PublishOptions } from "./types";
import { publishWithBackpressure, maybeWaitForConfirms } from "./backpressure";
import { generateUuid } from "./uuid";

function buildPublishProps(event: EventEnvelope, opts?: PublishOptions): Options.Publish {
  const nativePublish = opts?.amqp?.publish ?? {};
  const baseHeaders = event.meta?.headers ?? {};
  const nativeHeaders = nativePublish.headers ?? {};

  return {
    messageId: event.id,
    type: event.name,
    timestamp: Math.floor((event.time ?? Date.now()) / 1000),
    correlationId: event.meta?.corrId,
    ...nativePublish,
    headers: { ...baseHeaders, ...nativeHeaders },
  };
}

export function createPublisher(params: {
  exchangeName: string;
  exchangeConfig: ExchangeConfig;
  defaultCfg: InternalCfg;
  getChannel: () => Promise<Channel>;
  getBackoffMs: () => number;
}) {
  const { exchangeName, exchangeConfig, defaultCfg, getChannel, getBackoffMs } = params;

  const getPubChannel = async (): Promise<Channel> => {
    if (exchangeConfig.publisherConfirms ?? defaultCfg.publisherConfirms) {
      return getRabbitMQConfirmChannel();
    }

    return getChannel();
  };

  const safePublish = async (publish: (ch: Channel) => unknown | Promise<unknown>) => {
    try {
      const ch = await getPubChannel();
      await publish(ch);
      await maybeWaitForConfirms(ch);
    } catch {
      // Broker is likely reconnecting. Briefly wait, then retry once.
      const delay = Math.min(getBackoffMs() * 2, 2000);
      await new Promise((r) => setTimeout(r, delay));

      const ch2 = await getPubChannel();
      await publish(ch2);
      await maybeWaitForConfirms(ch2);
    }
  };

  const publishOne = async (evt: EventEnvelope, opts?: PublishOptions): Promise<void> => {
    await pluginManager.executeHook("beforeProduce", evt);

    await safePublish((ch) => {
      const props = buildPublishProps(evt, opts);

      return publishWithBackpressure(
        ch,
        exchangeName,
        opts?.routingKey ?? evt.name,
        Buffer.from(JSON.stringify(evt)),
        props
      );
    });

    await pluginManager.executeHook("afterProduce", evt, null);
  };

  const produceMany = async <
    TEvents extends Record<string, EventEnvelope>,
    K extends keyof TEvents
  >(
    ...events: TEvents[K][]
  ): Promise<void> => {
    for (const evt of events) {
      await publishOne(evt as EventEnvelope);
    }
  };

  const produce = async <
    TEvents extends Record<string, EventEnvelope>,
    K extends keyof TEvents
  >(
    ...events: TEvents[K][]
  ): Promise<void | unknown> => {
    // Back-compat: upgrade legacy "wait" (if present) to meta fields
    if (events.length === 1 && (events[0] as any)?.wait) {
      const first: any = events[0];
      const w = first.wait as { source?: string; timeout?: number };

      first.meta = first.meta || {};

      if (first.meta.expectsReply !== true) first.meta.expectsReply = true;
      if (w?.timeout != null && first.meta.timeoutMs == null) first.meta.timeoutMs = w.timeout;

      if (w?.source) {
        first.meta.headers = { ...(first.meta.headers || {}), source: w.source };
      }
    }

    // RPC request path
    if (events.length === 1 && (events[0] as any)?.meta?.expectsReply === true) {
      const evt = events[0] as EventEnvelope & { meta?: EventMeta };
      const correlationId = generateUuid();

      const rpcCh = await getChannel();
      const temp = await rpcCh.assertQueue("", { exclusive: true, autoDelete: true });

      await pluginManager.executeHook("beforeProduce", evt);

      await safePublish(async (pubCh) => {
        const props: Options.Publish = {
          messageId: evt.id,
          type: evt.name,
          timestamp: Math.floor((evt.time ?? Date.now()) / 1000),
          correlationId,
          headers: evt.meta?.headers,
          replyTo: temp.queue,
        };

        await publishWithBackpressure(
          pubCh,
          exchangeName,
          evt.name,
          Buffer.from(JSON.stringify(evt)),
          props
        );
      });

      const timeoutMs = evt.meta?.timeoutMs ?? 5000;

      return await new Promise((resolve, reject) => {
        let ctag: string | undefined;

        const timer = setTimeout(async () => {
          try {
            if (ctag) await rpcCh.cancel(ctag);
          } catch {}

          try {
            await rpcCh.deleteQueue(temp.queue);
          } catch {}

          reject(new Error("Timeout waiting for reply"));
        }, timeoutMs);

        rpcCh
          .consume(
            temp.queue,
            (msg) => {
              if (!msg) return;
              if (msg.properties.correlationId !== correlationId) return;

              clearTimeout(timer);

              try {
                const reply = JSON.parse(msg.content.toString()).reply;
                pluginManager.executeHook("afterProduce", evt, reply);
                resolve(reply);
              } finally {
                Promise.resolve()
                  .then(async () => {
                    try {
                      if (ctag) await rpcCh.cancel(ctag);
                    } catch {}

                    try {
                      await rpcCh.deleteQueue(temp.queue);
                    } catch {}
                  })
                  .catch(() => undefined);
              }
            },
            { noAck: true }
          )
          .then((ok) => {
            ctag = ok.consumerTag;
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
    }

    return produceMany<TEvents, K>(...events);
  };

  const publish = async <
    TEvents extends Record<string, EventEnvelope>,
    K extends keyof TEvents
  >(
    event: TEvents[K],
    opts?: PublishOptions
  ): Promise<void | unknown> => {
    if ((event as any)?.meta?.expectsReply === true) {
      return produce<TEvents, K>(event);
    }

    return publishOne(event as EventEnvelope, opts);
  };

  return { produce, produceMany, publish };
}