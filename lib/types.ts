import { Channel, Options } from "amqplib";
import { EventEnvelope } from "./eventFactories";

export interface AmqpPassthroughOptions {
  queue?: Options.AssertQueue;
  exchange?: Options.AssertExchange;
  bind?: Record<string, unknown>;
  publish?: Options.Publish;
  consume?: Options.Consume;
}

export interface QueueConfig {
  amqp?: Pick<AmqpPassthroughOptions, "queue">;
}

export interface ExchangeConfig {
  exchangeType?: "topic" | "direct" | "fanout" | "headers";
  routingKey?: string;
  durable?: boolean;

  publisherConfirms?: boolean;

  queueArgs?: Options.AssertQueue["arguments"];

  /**
   * If true, do NOT declare the queue; only check it exists.
   * Use this when a separate setup step has already created the queue with specific args.
   */
  passiveQueue?: boolean;

  /**
   * Escape hatch for native amqplib options.
   * Rabbit Relay keeps safe defaults, while advanced users can pass raw AMQP options.
   */
  amqp?: Pick<AmqpPassthroughOptions, "exchange" | "queue" | "bind">;
}

export interface PublishOptions {
  /** Override the routing key for this publish. Defaults to event.name. */
  routingKey?: string;

  /** Native amqplib publish options. */
  amqp?: Pick<AmqpPassthroughOptions, "publish">;
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

  /** Native amqplib consume options. */
  amqp?: Pick<AmqpPassthroughOptions, "consume">;
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

  /**
   * Publish one event with per-message options.
   * Use this when you need native amqplib publish options like persistent, priority, expiration, etc.
   */
  publish<K extends keyof TEvents>(
    event: TEvents[K],
    opts?: PublishOptions
  ): Promise<void | unknown>;

  /** Escape hatch for advanced amqplib usage. */
  withChannel<T>(fn: (channel: Channel) => Promise<T> | T): Promise<T>;

  with<U extends Record<string, (...args: any[]) => EventEnvelope>>(
    events: U
  ): BrokerInterface<{ [K in keyof U]: ReturnType<U[K]> }> & {
    [K in keyof U]: (...args: Parameters<U[K]>) => ReturnType<U[K]>;
  };
}

// Internal normalized cfg after merging defaults + per-exchange overrides
export type InternalCfg = {
  exchangeType: "topic" | "direct" | "fanout" | "headers";
  routingKey: string;
  durable: boolean;
  publisherConfirms: boolean;
  queueArgs?: Options.AssertQueue["arguments"];
  passiveQueue: boolean;
  amqp?: Pick<AmqpPassthroughOptions, "exchange" | "queue" | "bind">;
};