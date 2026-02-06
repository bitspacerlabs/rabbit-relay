import { Options } from "amqplib";
import { EventEnvelope } from "./eventFactories";

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

  produce<K extends keyof TEvents>(...events: TEvents[K][]): Promise<void | unknown>;

  produceMany<K extends keyof TEvents>(...events: TEvents[K][]): Promise<void>;

  with<U extends Record<string, (...args: any[]) => EventEnvelope>>(
    events: U
  ): BrokerInterface<{ [K in keyof U]: ReturnType<U[K]> }> & {
    [K in keyof U]: (...args: Parameters<U[K]>) => ReturnType<U[K]>;
  };
}

// Internal normalized cfg after merging defaults + per-exchange overrides
export type InternalCfg = {
  exchangeType: "topic" | "direct" | "fanout";
  routingKey: string;
  durable: boolean;
  publisherConfirms: boolean;
  queueArgs?: Options.AssertQueue["arguments"];
  passiveQueue: boolean;
};
