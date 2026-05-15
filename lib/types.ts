import { Channel, Options } from "amqplib";
import { EventEnvelope } from "./eventFactories";
import { Dedupe, DedupeOpts } from "./utils/dedupe";
import { LifecycleEventName, LifecycleHandler } from "./lifecycle";
import { TopologyPlan } from "./topologyPlan";

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

export interface DeadLetterConfig {
  /**
   * Dead-letter exchange name.
   * Failed messages are routed here when the consumer nacks with requeue=false.
   */
  exchange: string;

  /**
   * Optional dead-letter queue name.
   * Required only when autoDeclare=true.
   */
  queue?: string;

  /**
   * Routing key used when RabbitMQ dead-letters the message.
   * If omitted, RabbitMQ uses the original routing key.
   */
  routingKey?: string;

  /**
   * Exchange type for the DLX.
   * Default: "topic"
   */
  exchangeType?: "topic" | "direct" | "fanout" | "headers";

  /**
   * If true, Rabbit Relay declares the DLX, DLQ, and DLQ binding.
   * Default: false
   */
  autoDeclare?: boolean;

  /**
   * Native amqplib options for declaring the DLX.
   */
  exchangeOptions?: Options.AssertExchange;

  /**
   * Native amqplib options for declaring the DLQ.
   */
  queueOptions?: Options.AssertQueue;

  /**
   * Native amqplib binding arguments for DLQ binding.
   */
  bindArguments?: Record<string, unknown>;
}

export interface ExchangeConfig {
  exchangeType?: "topic" | "direct" | "fanout" | "headers";
  routingKey?: string;
  durable?: boolean;

  publisherConfirms?: boolean;

  queueArgs?: Options.AssertQueue["arguments"];

  /**
   * Maximum serialized event size in bytes.
   *
   * Can be configured at broker/exchange level and overridden per publish/request.
   */
  maxMessageBytes?: number;

  /**
   * If true, do NOT declare the queue; only check it exists.
   * Use this when a separate setup step has already created the queue with specific args.
   */
  passiveQueue?: boolean;

  /**
   * Built-in dead-letter queue helper.
   */
  deadLetter?: DeadLetterConfig;

  /**
   * Escape hatch for native amqplib options.
   * Rabbit Relay keeps safe defaults, while advanced users can pass raw AMQP options.
   */
  amqp?: Pick<AmqpPassthroughOptions, "exchange" | "queue" | "bind">;
}

export interface PublishOptions {
  /** Override the routing key for this publish. Defaults to event.name. */
  routingKey?: string;

  /**
   * Maximum serialized event size in bytes for this publish/request.
   * Overrides broker/exchange-level maxMessageBytes.
   */
  maxMessageBytes?: number;

  /** Native amqplib publish options. */
  amqp?: Pick<AmqpPassthroughOptions, "publish">;
}

export interface RequestOptions extends PublishOptions {
  /** Timeout while waiting for RPC reply. Default: 5000. */
  timeoutMs?: number;
}

export interface RetryOptions {
  /** Number of retry attempts before final failure behavior. */
  attempts: number;

  /**
   * Fixed retry delay in milliseconds.
   *
   * If omitted, retry remains immediate for backward compatibility.
   * If provided, Rabbit Relay uses RabbitMQ TTL + DLX delayed retry queues.
   */
  delayMs?: number;

  /**
   * What to do after retry attempts are exhausted.
   * Default: "dead-letter"
   */
  then?: "ack" | "requeue" | "dead-letter";
}

export type ConsumeDedupeOptions =
  | Dedupe
  | (DedupeOpts & {
      /**
       * Enable/disable built-in memory dedupe.
       * Default: true when dedupe config is provided.
       */
      enabled?: boolean;
    });

export interface ConsumeOptions {
  /** Max unacked messages this consumer can hold. Also default concurrency. */
  prefetch?: number;

  /** Parallel handler executions. Defaults to prefetch (or 1). */
  concurrency?: number;

  /** If true, nack+requeue on handler error; else ack even on error. (back-compat) */
  requeueOnError?: boolean;

  /** What to do when the handler throws. Default "ack". */
  onError?: "ack" | "requeue" | "dead-letter" | "retry";

  /** Retry policy when onError is "retry". */
  retry?: RetryOptions;

  /**
   * Optional consumer-side de-duplication.
   *
   * Pass either:
   * - a Dedupe instance, for example makeMemoryDedupe(...)
   * - a config object, for example { enabled: true, ttlMs: 60000 }
   *
   * Duplicate messages are acknowledged and skipped.
   */
  dedupe?: ConsumeDedupeOptions;

  /** Native amqplib consume options. */
  amqp?: Pick<AmqpPassthroughOptions, "consume">;
}

export interface ConsumeMiddlewareContext {
  /** RabbitMQ delivery tag. */
  id: string | number;

  /** Parsed Rabbit Relay event envelope. */
  event: EventEnvelope;

  /** Queue currently consuming this message. */
  queue: string;
}

export type ConsumeMiddleware = (
  ctx: ConsumeMiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Generic Broker Interface:
 * TEvents maps event name keys -> EventEnvelope types.
 */
export interface BrokerInterface<TEvents extends Record<string, EventEnvelope>> {
  /**
   * Register local middleware for this broker interface.
   *
   * Middleware wraps handler execution for this queue/exchange binding only.
   */
  use(middleware: ConsumeMiddleware): BrokerInterface<TEvents>;

  /**
   * Register a lifecycle hook.
   *
   * Hooks are useful for logging, metrics, OpenTelemetry, and operational visibility.
   */
  on<K extends LifecycleEventName>(
    eventName: K,
    handler: LifecycleHandler<K>
  ): () => void;

  /**
   * Return the RabbitMQ topology this broker interface represents.
   *
   * This is read-only and does not contact RabbitMQ.
   */
  planTopology(): TopologyPlan;

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

  /**
   * Send one event as an RPC-style request and wait for a typed reply.
   *
   * This is a cleaner alternative to manually setting:
   * event.meta = { expectsReply: true, timeoutMs: ... }
   */
  request<TReply = unknown, K extends keyof TEvents = keyof TEvents>(
    event: TEvents[K],
    opts?: RequestOptions
  ): Promise<TReply>;

  /** Escape hatch for advanced amqplib usage. */
  withChannel<T>(fn: (channel: Channel) => Promise<T> | T): Promise<T>;

  health(): Promise<BrokerHealth>;

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
  maxMessageBytes?: number;
  passiveQueue: boolean;
  deadLetter?: DeadLetterConfig;
  amqp?: Pick<AmqpPassthroughOptions, "exchange" | "queue" | "bind">;
};

export interface ConsumerHealth {
  queue: string;
  active: boolean;
  prefetch: number;
  concurrency: number;
  activeHandlers: number;
  pendingMessages: number;
  onError: "ack" | "requeue" | "dead-letter" | "retry";
  retry?: {
    attempts: number;
    then: "ack" | "requeue" | "dead-letter";
    delayMs?: number;
  };
}

export interface BrokerHealth {
  peerName: string;
  connected: boolean;
  channelOpen: boolean;
  confirmChannelOpen: boolean;
  reconnecting: boolean;
  consumers: ConsumerHealth[];
}