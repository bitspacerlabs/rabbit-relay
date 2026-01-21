import { Channel, ConsumeMessage, Options } from "amqplib";
import { getRabbitMQChannel, getRabbitMQConfirmChannel } from "./config";
import { pluginManager } from "./pluginManager";
import { EventEnvelope, EventMeta } from "./eventFactories";

function generateUuid(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export interface ExchangeConfig {
  exchangeType?: "topic" | "direct" | "fanout";
  routingKey?: string;
  durable?: boolean;

  publisherConfirms?: boolean;

  queueArgs?: Options.AssertQueue["arguments"];

  /**
   * If true, do NOT declare the queue; only check it exists.
   * Use this when a separate setup step has already created the queue with specific args.
   */
  passiveQueue?: boolean;
}

export interface ConsumeOptions {
  /** Max unacked messages this consumer can hold. Also default concurrency. */
  prefetch?: number;
  /** Parallel handler executions. Defaults to prefetch (or 1). */
  concurrency?: number;
  /** If true, nack+requeue on handler error; else ack even on error. (back-compat) */
  requeueOnError?: boolean;
  /** What to do when the handler throws. Default "ack". */
  onError?: "ack" | "requeue" | "dead-letter";
}

/**
 * Generic Broker Interface:
 * TEvents maps event name keys -> EventEnvelope types.
 */
export interface BrokerInterface<TEvents extends Record<string, EventEnvelope>> {
  handle<K extends keyof TEvents>(
    eventName: K | "*",
    handler: (id: string | number, event: TEvents[K]) => Promise<unknown>
  ): BrokerInterface<TEvents>;

  consume(opts?: ConsumeOptions): Promise<{ stop(): Promise<void> }>;

  produce<K extends keyof TEvents>(
    ...events: TEvents[K][]
  ): Promise<void | unknown>;

  produceMany<K extends keyof TEvents>(...events: TEvents[K][]): Promise<void>;

  with<U extends Record<string, (...args: any[]) => EventEnvelope>>(
    events: U
  ): BrokerInterface<{ [K in keyof U]: ReturnType<U[K]> }> & {
    [K in keyof U]: (...args: Parameters<U[K]>) => ReturnType<U[K]>;
  };
}

// Internal normalized cfg after merging defaults + per-exchange overrides
type InternalCfg = {
  exchangeType: "topic" | "direct" | "fanout";
  routingKey: string;
  durable: boolean;
  publisherConfirms: boolean;
  queueArgs?: Options.AssertQueue["arguments"];
  passiveQueue: boolean;
};


export class RabbitMQBroker {
  private peerName: string;
  private defaultCfg: InternalCfg;

  /** The current live channel promise (replaced after reconnect). */
  private channelPromise!: Promise<Channel>;

  /** Reconnect state */
  private reconnecting = false;
  private backoffMs = 500;
  private readonly maxBackoffMs = 20000;

  /** Callbacks to run after a successful reconnect (like re-assert topology, resume consume). */
  private onReconnectCbs: Array<(ch: Channel) => void | Promise<void>> = [];

  constructor(peerName: string, config: ExchangeConfig = {}) {
    this.peerName = peerName;
    this.defaultCfg = {
      exchangeType: config.exchangeType ?? "topic",
      routingKey: config.routingKey ?? "#",
      durable: config.durable ?? true,
      publisherConfirms: config.publisherConfirms ?? false,
      queueArgs: config.queueArgs,
      passiveQueue: config.passiveQueue ?? false,
    };
    this.initChannel();
  }

  private async initChannel() {
    this.channelPromise = getRabbitMQChannel();
    const ch = await this.channelPromise;

    this.backoffMs = 500;

    const onClose = () => this.scheduleReconnect("channel.close");
    const onError = () => this.scheduleReconnect("channel.error");

    (ch as any).on?.("close", onClose);
    (ch as any).on?.("error", onError);
  }

  private async scheduleReconnect(reason: string) {
    if (this.reconnecting) return;
    this.reconnecting = true;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, this.backoffMs + jitter));

        await this.initChannel();
        const ch = await this.channelPromise;

        this.backoffMs = 500;
        this.reconnecting = false;

        for (const cb of this.onReconnectCbs) {
          try { await cb(ch); } catch (e) { console.error("[broker] onReconnect callback failed:", e); }
        }
        return;
      } catch {
        this.backoffMs = Math.min(
          this.maxBackoffMs,
          Math.floor(this.backoffMs * 1.7 + Math.random() * 100)
        );
        console.error(`[broker] reconnect failed (${reason}), retrying in ~${this.backoffMs}ms`);
      }
    }
  }

  private async getChannel(): Promise<Channel> {
    return this.channelPromise;
  }

  private onReconnect(cb: (ch: Channel) => void | Promise<void>) {
    this.onReconnectCbs.push(cb);
  }

  public queue(queueName: string) {
    return {
      exchange: async <TEvents extends Record<string, EventEnvelope>>(
        exchangeName: string,
        exchangeConfig: ExchangeConfig = {}
      ): Promise<BrokerInterface<TEvents>> => {
        return this.exchange<TEvents>(exchangeName, queueName, exchangeConfig);
      },
    };
  }

  private async exchange<TEvents extends Record<string, EventEnvelope>>(
    exchangeName: string,
    queueName: string,
    exchangeConfig: ExchangeConfig = {}
  ): Promise<BrokerInterface<TEvents>> {

    const assertTopology = async (channel: Channel) => {
      const cfg: InternalCfg = {
        exchangeType: exchangeConfig.exchangeType ?? this.defaultCfg.exchangeType,
        routingKey: exchangeConfig.routingKey ?? this.defaultCfg.routingKey,
        durable: exchangeConfig.durable ?? this.defaultCfg.durable,
        publisherConfirms: exchangeConfig.publisherConfirms ?? this.defaultCfg.publisherConfirms,
        queueArgs: exchangeConfig.queueArgs ?? this.defaultCfg.queueArgs,
        passiveQueue: exchangeConfig.passiveQueue ?? this.defaultCfg.passiveQueue,
      };

      await channel.assertExchange(exchangeName, cfg.exchangeType, { durable: cfg.durable });

      if (cfg.passiveQueue) {
        if (cfg.queueArgs) {
          console.warn(
            `[broker] passiveQueue=true: ignoring queueArgs for '${queueName}' (not declaring).`
          );
        }
        try {
          await channel.checkQueue(queueName);
        } catch (err: any) {
          const code = err?.code;
          if (code === 404) {
            throw new Error(
              `[broker] passiveQueue check failed: queue '${queueName}' does not exist. ` +
              `Either create it in your setup step with the desired arguments, ` +
              `or call with passiveQueue:false and queueArgs to auto-declare.`
            );
          }
          throw err;
        }
      } else {
        try {
          const qOpts: Options.AssertQueue = {
            durable: cfg.durable,
            ...(cfg.queueArgs ? { arguments: cfg.queueArgs } : {}),
          };
          await channel.assertQueue(queueName, qOpts);
        } catch (err: any) {
          if (err?.code === 406) {
            throw new Error(
              `[broker] QueueDeclare PRECONDITION_FAILED for '${queueName}'. ` +
              `Existing queue has different arguments. ` +
              `Fix: delete the queue or switch to { passiveQueue: true } if you're using a setup step.`
            );
          }
          throw err;
        }
      }

      // (Re)bind is idempotent - safe to call even if binding already exists
      await channel.bindQueue(queueName, exchangeName, cfg.routingKey);
    };

    const channel = await this.getChannel();
    await assertTopology(channel);

    const handlers = new Map<
      string,
      (id: string | number, event: EventEnvelope) => Promise<unknown>
    >();

    let consumerTag: string | undefined;
    let isConsuming = false;
    let consumeCh: Channel | null = null;
    let prefetchCount = 1;
    let concurrency = 1;
    let onError: "ack" | "requeue" | "dead-letter" = "ack";

    this.onReconnect(async (ch) => {
      await assertTopology(ch);
      if (isConsuming) {
        if (prefetchCount > 0) await ch.prefetch(prefetchCount, false);
        consumeCh = ch; // pin
        const ok = await ch.consume(queueName, onMessage);
        consumerTag = ok.consumerTag;
      }
    });

    const handle = <K extends keyof TEvents>(
      eventName: K | "*",
      handler: (id: string | number, event: TEvents[K]) => Promise<unknown>
    ): BrokerInterface<TEvents> => {
      handlers.set(eventName as string, handler as any);
      return brokerInterface;
    };

    // Backpressure-aware publish helper
    const waitForDrain = (ch: Channel) =>
      new Promise<void>((resolve) => {
        const anyCh = ch as any;
        if (typeof anyCh.once === "function") anyCh.once("drain", resolve);
        else resolve(); // if not supported, resolve immediately
      });

    const publishWithBackpressure = async (
      ch: Channel,
      exchange: string,
      routingKey: string,
      content: Buffer,
      options?: Options.Publish
    ) => {
      const ok = ch.publish(exchange, routingKey, content, options);
      if (!ok) {
        console.warn(
          `[amqp] publish backpressure: waiting for 'drain' (exchange=${exchange}, key=${routingKey}, size=${content.length})`
        );
        const t0 = Date.now();
        await waitForDrain(ch);
        const dt = Date.now() - t0;
        if (dt >= 1) {
          console.warn(
            `[amqp] drain resolved after ${dt}ms (exchange=${exchange}, key=${routingKey})`
          );
        }
      }
    };

    const getPubChannel = async (): Promise<Channel> => {
      if (exchangeConfig.publisherConfirms ?? this.defaultCfg.publisherConfirms) {
        return getRabbitMQConfirmChannel();
      }
      return this.getChannel();
    };

    const maybeWaitForConfirms = async (ch: Channel) => {
      const anyCh = ch as any;
      if (typeof anyCh.waitForConfirms === "function") {
        await anyCh.waitForConfirms();
      }
    };

    const onMessage = async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const ch = consumeCh;
      if (!ch) return;

      const id = msg.fields.deliveryTag;
      const payload = JSON.parse(msg.content.toString()) as EventEnvelope;

      const handler =
        (handlers.get(payload.name) as any) || (handlers.get("*") as any);

      let result: unknown = null;
      let errored = false;
      try {
        await pluginManager.executeHook("beforeProcess", id, payload);
        if (handler) {
          // concurrency is enforced by prefetch limiting in-flight
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
          // derive behavior from onError (Backward compatibility: requeueOnError -> "requeue" handled in consume())
          if (onError === "requeue") {
            ch.nack(msg, false, true);              // requeue back to SAME queue
          } else if (onError === "dead-letter") {
            ch.nack(msg, false, false);             // route to DLX (if queue is DLX-configured)
          } else {
            ch.ack(msg);                             // swallow the error
          }
        } else {
          ch.ack(msg);
        }
      } catch (e) {
        console.error("Ack/Nack failed:", e);
      }
    };

    const consume = async (opts?: ConsumeOptions): Promise<{ stop(): Promise<void> }> => {
      prefetchCount = opts?.prefetch ?? opts?.concurrency ?? 1;
      concurrency = opts?.concurrency ?? prefetchCount;

      // Back-compat: if requeueOnError is set and onError not explicitly provided, use "requeue"
      onError = opts?.onError ?? (opts?.requeueOnError ? "requeue" : "ack");

      const ch = await this.getChannel();
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
            // channel may be closed; ignore
          }
        },
      };
    };

    const safePublish = async (publish: (ch: Channel) => unknown | Promise<unknown>) => {
      try {
        const ch = await getPubChannel();
        await publish(ch);
        await maybeWaitForConfirms(ch);
      } catch {
        // Broker is likely reconnecting. Briefly wait, then retry once.
        const delay = Math.min(this.backoffMs * 2, 2000);
        await new Promise(r => setTimeout(r, delay));
        // try once more after reconnect
        const ch2 = await getPubChannel();
        await publish(ch2);
        await maybeWaitForConfirms(ch2);
      }
    };

    const produceMany = async <K extends keyof TEvents>(
      ...events: TEvents[K][]
    ): Promise<void> => {
      for (const evt of events) {
        await pluginManager.executeHook("beforeProduce", evt);
        await safePublish((ch) => {
          const e = evt as any as EventEnvelope;
          const props: Options.Publish = {
            messageId: e.id,                                // idempotency key
            type: e.name,                                   // event name
            timestamp: Math.floor((e.time ?? Date.now()) / 1000),
            correlationId: e.meta?.corrId,
            headers: e.meta?.headers,
          };
          return publishWithBackpressure(
            ch,
            exchangeName,
            e.name,
            Buffer.from(JSON.stringify(e)),
            props
          );
        });
        await pluginManager.executeHook("afterProduce", evt, null);
      }
    };

    const produce = async <K extends keyof TEvents>(
      ...events: TEvents[K][]
    ): Promise<void | unknown> => {
      // Back-compat: upgrade legacy `wait` (if present) to meta fields
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

        const rpcCh = await this.getChannel(); // pin for reply consumer/ack
        const temp = await rpcCh.assertQueue("", { exclusive: true, autoDelete: true });

        await pluginManager.executeHook("beforeProduce", evt);
        await safePublish(async () => {
          // use (confirm) pub channel for the request publish
          const pubCh = await getPubChannel();
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
            try { if (ctag) await rpcCh.cancel(ctag); } catch { }
            try { await rpcCh.deleteQueue(temp.queue); } catch { }
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
                      try { if (ctag) await rpcCh.cancel(ctag); } catch { }
                      try { await rpcCh.deleteQueue(temp.queue); } catch { }
                    })
                    .catch(() => undefined);
                }
              },
              { noAck: true }
            )
            .then((ok) => { ctag = ok.consumerTag; })
            .catch((err) => {
              clearTimeout(timer);
              reject(err);
            });
        });
      }

      return produceMany(...events);
    };

    const brokerInterface: BrokerInterface<TEvents> = {
      handle,
      consume,
      produce,
      produceMany,
      with: <
        U extends Record<string, (...args: any[]) => EventEnvelope>
      >(
        events: U
      ) => {
        const { augmentEvents } = require("./eventFactories") as {
          augmentEvents: <X extends object>(ev: Record<string, any>, brk: any) => X;
        };
        const augmented = augmentEvents(events, brokerInterface);
        return augmented as BrokerInterface<{ [K in keyof U]: ReturnType<U[K]> }> & {
          [K in keyof U]: (...args: Parameters<U[K]>) => ReturnType<U[K]>;
        };
      },
    };

    return brokerInterface;
  }
}
