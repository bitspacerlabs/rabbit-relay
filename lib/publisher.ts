import { Channel, ConfirmChannel, Options } from "amqplib";
import { getRabbitMQConfirmChannel } from "./config";
import { pluginManager } from "./pluginManager";
import { EventEnvelope, EventMeta } from "./eventFactories";
import { ExchangeConfig, InternalCfg, PublishOptions, RequestOptions } from "./types";
import { publishWithBackpressure, PublishChannel } from "./backpressure";
import { generateUuid } from "./uuid";

function buildPublishProps(
  event: EventEnvelope,
  opts?: PublishOptions
): Options.Publish {
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

function buildRpcPublishProps(
  event: EventEnvelope,
  correlationId: string,
  replyTo: string,
  opts?: PublishOptions
): Options.Publish {
  const nativePublish = opts?.amqp?.publish ?? {};
  const baseHeaders = event.meta?.headers ?? {};
  const nativeHeaders = nativePublish.headers ?? {};

  return {
    messageId: event.id,
    type: event.name,
    timestamp: Math.floor((event.time ?? Date.now()) / 1000),
    correlationId,
    replyTo,
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
  const { exchangeName, exchangeConfig, defaultCfg, getChannel, getBackoffMs } =
    params;

  const getPubChannel = async (): Promise<PublishChannel> => {
    if (exchangeConfig.publisherConfirms ?? defaultCfg.publisherConfirms) {
      return getRabbitMQConfirmChannel() as Promise<ConfirmChannel>;
    }

    return getChannel();
  };

  const safePublish = async (
    publish: (ch: PublishChannel) => unknown | Promise<unknown>
  ) => {
    try {
      const ch = await getPubChannel();
      await publish(ch);
    } catch (err) {
      // Broker is likely reconnecting. Briefly wait, then retry once.
      const delay = Math.min(getBackoffMs() * 2, 2000);
      await new Promise((r) => setTimeout(r, delay));

      const ch2 = await getPubChannel();
      await publish(ch2);
    }
  };

  const publishOne = async (
    evt: EventEnvelope,
    opts?: PublishOptions
  ): Promise<void> => {
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

  const requestOne = async (
    evt: EventEnvelope & { meta?: EventMeta },
    opts?: PublishOptions
  ): Promise<unknown> => {
    const correlationId = generateUuid();

    const rpcCh = await getChannel();
    const temp = await rpcCh.assertQueue("", {
      exclusive: true,
      autoDelete: true,
    });

    await pluginManager.executeHook("beforeProduce", evt);

    await safePublish(async (pubCh) => {
      const props = buildRpcPublishProps(evt, correlationId, temp.queue, opts);

      await publishWithBackpressure(
        pubCh,
        exchangeName,
        opts?.routingKey ?? evt.name,
        Buffer.from(JSON.stringify(evt)),
        props
      );
    });

    const timeoutMs = evt.meta?.timeoutMs ?? 5000;

    return await new Promise((resolve, reject) => {
      let ctag: string | undefined;
      let settled = false;

      const cleanup = async () => {
        try {
          if (ctag) await rpcCh.cancel(ctag);
        } catch {}

        try {
          await rpcCh.deleteQueue(temp.queue);
        } catch {}
      };

      const timer = setTimeout(async () => {
        if (settled) return;

        settled = true;
        await cleanup();
        reject(new Error("Timeout waiting for reply"));
      }, timeoutMs);

      rpcCh
        .consume(
          temp.queue,
          (msg) => {
            if (!msg) return;
            if (msg.properties.correlationId !== correlationId) return;
            if (settled) return;

            settled = true;
            clearTimeout(timer);

            try {
              const reply = JSON.parse(msg.content.toString()).reply;
              void pluginManager.executeHook("afterProduce", evt, reply);
              resolve(reply);
            } catch (err) {
              reject(err);
            } finally {
              void cleanup();
            }
          },
          { noAck: true }
        )
        .then((ok) => {
          ctag = ok.consumerTag;
        })
        .catch((err) => {
          if (settled) return;

          settled = true;
          clearTimeout(timer);
          reject(err);
        });
    });
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
      if (w?.timeout != null && first.meta.timeoutMs == null) {
        first.meta.timeoutMs = w.timeout;
      }

      if (w?.source) {
        first.meta.headers = {
          ...(first.meta.headers || {}),
          source: w.source,
        };
      }
    }

    // RPC request path
    if (events.length === 1 && (events[0] as any)?.meta?.expectsReply === true) {
      return requestOne(events[0] as EventEnvelope & { meta?: EventMeta });
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
      return requestOne(event as EventEnvelope & { meta?: EventMeta }, opts);
    }

    return publishOne(event as EventEnvelope, opts);
  };

  const request = async <TReply = unknown>(
    event: EventEnvelope,
    opts?: RequestOptions
  ): Promise<TReply> => {
    const evt = event as EventEnvelope & { meta?: EventMeta };

    evt.meta = {
      ...(evt.meta ?? {}),
      expectsReply: true,
      ...(opts?.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
    };

    return requestOne(evt, opts) as Promise<TReply>;
  };

  return { produce, produceMany, publish, request };
}