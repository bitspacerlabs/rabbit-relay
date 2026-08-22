import { Channel } from "amqplib";
import { augmentEvents, EventEnvelope } from "./eventFactories.js";
import {
  ExchangeConfig,
  BrokerConfig,
  BrokerInterface,
  InternalCfg,
  ConsumeOptions,
  QueueConfig,
  PublishOptions,
  RequestOptions,
  BrokerHealth,
  ConsumeMiddleware,
} from "./types.js";
import { ReconnectController } from "./reconnect.js";
import {
  createAssertTopology,
  createTopologyPlan,
  mergeInternalCfg,
  resolveTopologyMode,
} from "./topology.js";
import { createConsumer } from "./consumer.js";
import { createPublisher } from "./publisher.js";
import { RabbitMQConnectionManager } from "./config.js";
import {
  LifecycleEmitter,
  LifecycleEventName,
  LifecycleHandler,
} from "./lifecycle.js";
import {
  TopologyPlan,
  emptyTopologyPlan,
  mergeTopologyPlans,
} from "./topologyPlan.js";
import {
  TopologyValidationIssue,
  TopologyValidationResult,
  validateTopologyPlan,
} from "./topologyValidation.js";
import {
  DlqRedriveOptions,
  DlqRedriveResult,
  redriveDlq,
} from "./dlqRedrive.js";

type RegisteredConsumer = {
  queueName: string;
  getState: () => {
    isConsuming: boolean;
    prefetchCount: number;
    concurrency: number;
    activeHandlers: number;
    pendingMessages: number;
    onError: "ack" | "requeue" | "dead-letter" | "retry";
    retry?: {
      attempts: number;
      then: "ack" | "requeue" | "dead-letter";
      delayMs?: number;
    };
  };
};

function formatTopologyValidationIssues(
  issues: TopologyValidationIssue[]
): string {
  return issues
    .map((issue) => {
      const target = issue.queue ?? issue.exchange ?? "unknown";
      return `${issue.type}:${target}:${issue.message}`;
    })
    .join("; ");
}

function blockingTopologyIssues(
  result: TopologyValidationResult
): TopologyValidationIssue[] {
  return result.issues.filter(
    (issue) => issue.type !== "binding_not_validated"
  );
}

export class RabbitMQBroker {
  private peerName: string;
  private defaultCfg: InternalCfg;

  private reconnect: ReconnectController;
  private connection: RabbitMQConnectionManager;
  private shutdownTimeoutMs: number;
  private closePromise: Promise<void> | undefined;
  private lifecycle = new LifecycleEmitter();
  private topologyPlan: TopologyPlan = emptyTopologyPlan();

  private activeConsumers: Array<{ stop(): Promise<void> }> = [];
  private registeredConsumers: RegisteredConsumer[] = [];

  constructor(peerName: string, config: BrokerConfig = {}) {
    this.peerName = peerName;
    this.defaultCfg = {
      exchangeType: config.exchangeType ?? "topic",
      routingKey: config.routingKey ?? "#",
      durable: config.durable ?? true,
      publisherConfirms: config.publisherConfirms ?? false,
      binding: config.binding ?? true,
      queueArgs: config.queueArgs,
      topologyMode: resolveTopologyMode(config.topologyMode),
      maxMessageBytes: config.maxMessageBytes,
      passiveQueue: config.passiveQueue ?? false,
      deadLetter: config.deadLetter,
      amqp: config.amqp,
    };

    this.shutdownTimeoutMs = config.shutdownTimeoutMs ?? 30_000;
    if (!Number.isFinite(this.shutdownTimeoutMs) || this.shutdownTimeoutMs < 0) {
      throw new Error(`[broker] shutdownTimeoutMs must be a non-negative number, got ${config.shutdownTimeoutMs}`);
    }

    this.connection = new RabbitMQConnectionManager({
      url: config.connectionUrl,
      connectionName:
        config.connectionName ?? process.env.AMQP_CONN_NAME ?? peerName,
    });
    this.reconnect = new ReconnectController(() => this.connection.getChannel());

    this.reconnect.onReconnect(async () => {
      await this.lifecycle.emit("reconnect", {
        peerName: this.peerName,
      });
    });
  }

  public on<K extends LifecycleEventName>(
    eventName: K,
    handler: LifecycleHandler<K>
  ): () => void {
    return this.lifecycle.on(eventName, handler);
  }

  public planTopology(): TopologyPlan {
    return mergeTopologyPlans(this.topologyPlan);
  }

  public async validateTopology(): Promise<TopologyValidationResult> {
    return this.validatePlan(this.planTopology());
  }

  public async redriveDlq(
    options: DlqRedriveOptions
  ): Promise<DlqRedriveResult> {
    const channel = await this.getChannel();
    return redriveDlq(channel, options);
  }

  private async getChannel(): Promise<Channel> {
    return this.reconnect.getChannel();
  }

  private onReconnect(cb: (ch: Channel) => void | Promise<void>) {
    this.reconnect.onReconnect(cb);
  }

  public async withChannel<T>(fn: (channel: Channel) => Promise<T> | T): Promise<T> {
    const channel = await this.getChannel();
    return fn(channel);
  }

  public close(): Promise<void> {
    if (!this.closePromise) {
      this.closePromise = this.performClose();
    }

    return this.closePromise;
  }

  private async performClose(): Promise<void> {
    const consumers = [...this.activeConsumers];
    this.activeConsumers = [];

    await Promise.all(
      consumers.map((consumer) => consumer.stop().catch(() => undefined))
    );

    this.reconnect.close();
    await this.connection.close();

    await this.lifecycle.emit("broker.closed", {
      peerName: this.peerName,
    });

    this.lifecycle.clear();
  }

  public async health(): Promise<BrokerHealth> {
    const rabbit = this.connection.health();

    return {
      peerName: this.peerName,
      connected: rabbit.connected,
      channelOpen: rabbit.channelOpen,
      confirmChannelOpen: rabbit.confirmChannelOpen,
      reconnecting: this.reconnect.isReconnecting(),
      consumers: this.registeredConsumers.map((consumer) => {
        const state = consumer.getState();

        return {
          queue: consumer.queueName,
          active: state.isConsuming,
          prefetch: state.prefetchCount,
          concurrency: state.concurrency,
          activeHandlers: state.activeHandlers,
          pendingMessages: state.pendingMessages,
          onError: state.onError,
          retry: state.retry,
        };
      }),
    };
  }

  private async validatePlan(
    plan: TopologyPlan
  ): Promise<TopologyValidationResult> {
    const issues: TopologyValidationIssue[] = [];
    const validation = await this.connection.createValidationSession();

    try {
      for (const exchange of plan.exchanges) {
        const channel = await validation.createChannel();
        try {
          const result = await validateTopologyPlan(channel, {
            exchanges: [exchange],
            queues: [],
            bindings: [],
          });
          issues.push(...result.issues);
        } finally {
          await channel.close().catch(() => undefined);
        }
      }

      for (const queue of plan.queues) {
        const channel = await validation.createChannel();
        try {
          const result = await validateTopologyPlan(channel, {
            exchanges: [],
            queues: [queue],
            bindings: [],
          });
          issues.push(...result.issues);
        } finally {
          await channel.close().catch(() => undefined);
        }
      }

      for (const binding of plan.bindings) {
        issues.push({
          type: "binding_not_validated",
          queue: binding.queue,
          exchange: binding.exchange,
          routingKey: binding.routingKey,
          message:
            `Binding '${binding.queue}' -> '${binding.exchange}' with routing key ` +
            `'${binding.routingKey}' was included in the plan but not passively validated. ` +
            `AMQP does not expose a safe binding check through amqplib.`,
        });
      }

      return {
        valid: issues.every((issue) => issue.type === "binding_not_validated"),
        issues,
      };
    } finally {
      await validation.close();
    }
  }

  public queue(queueName: string, queueConfig: QueueConfig = {}) {
    return {
      exchange: async <TEvents extends Record<string, EventEnvelope>>(
        exchangeName: string,
        exchangeConfig: ExchangeConfig = {}
      ): Promise<BrokerInterface<TEvents>> => {
        return this.exchange<TEvents>(exchangeName, queueName, queueConfig, exchangeConfig);
      },
    };
  }

  private async exchange<TEvents extends Record<string, EventEnvelope>>(
    exchangeName: string,
    queueName: string,
    queueConfig: QueueConfig = {},
    exchangeConfig: ExchangeConfig = {}
  ): Promise<BrokerInterface<TEvents>> {
    const cfg = mergeInternalCfg(this.defaultCfg, exchangeConfig);

    const topologyPlan = createTopologyPlan({
      exchangeName,
      queueName,
      queueConfig,
      defaultCfg: this.defaultCfg,
      exchangeConfig,
    });

    this.topologyPlan = mergeTopologyPlans(this.topologyPlan, topologyPlan);

    const assertTopology = createAssertTopology({
      exchangeName,
      queueName,
      queueConfig,
      defaultCfg: this.defaultCfg,
      exchangeConfig,
    });

    const applyTopology = async (channel: Channel): Promise<void> => {
      if (cfg.topologyMode === "plan-only") {
        return;
      }

      if (cfg.topologyMode === "passive") {
        try {
          const result = await this.validatePlan(topologyPlan);
          const blockingIssues = blockingTopologyIssues(result);

          if (blockingIssues.length > 0) {
            throw new Error(
              `[broker] topologyMode='passive' validation failed for exchange '${exchangeName}' and queue '${queueName}': ` +
                formatTopologyValidationIssues(blockingIssues)
            );
          }
        } catch (err) {
          await this.lifecycle.emit("topology.failed", {
            peerName: this.peerName,
            exchange: exchangeName,
            queue: queueName,
            error: err,
          });
          throw err;
        }

        return;
      }

      try {
        await assertTopology(channel);

        await this.lifecycle.emit("topology.asserted", {
          peerName: this.peerName,
          exchange: exchangeName,
          queue: queueName,
        });
      } catch (err) {
        await this.lifecycle.emit("topology.failed", {
          peerName: this.peerName,
          exchange: exchangeName,
          queue: queueName,
          error: err,
        });
        throw err;
      }
    };

    if (cfg.topologyMode !== "plan-only") {
      const channel = await this.getChannel();
      await applyTopology(channel);
    }

    const handlers = new Map<
      string,
      (id: string | number, event: EventEnvelope) => Promise<unknown>
    >();

    const middlewares: ConsumeMiddleware[] = [];

    const consumer = createConsumer({
      peerName: this.peerName,
      queueName,
      exchangeName,
      topologyMode: cfg.topologyMode,
      handlers,
      middlewares,
      emitLifecycle: (eventName, event) =>
        this.lifecycle.emit(eventName, event),
      shutdownTimeoutMs: this.shutdownTimeoutMs,
    });

    this.registeredConsumers.push({
      queueName,
      getState: consumer.getState,
    });

    const publisher = createPublisher({
      peerName: this.peerName,
      exchangeName,
      exchangeConfig,
      defaultCfg: this.defaultCfg,
      getChannel: () => this.getChannel(),
      getConfirmChannel: () => this.connection.getConfirmChannel(),
      getBackoffMs: () => this.reconnect.getBackoffMs(),
      emitLifecycle: (eventName, event) =>
        this.lifecycle.emit(eventName, event),
    });

    this.onReconnect(async (ch) => {
      await applyTopology(ch);

      await consumer.resumeOnReconnect(ch);

      await this.lifecycle.emit("topology.restored", {
        peerName: this.peerName,
        exchange: exchangeName,
        queue: queueName,
      });
    });

    const use = (middleware: ConsumeMiddleware): BrokerInterface<TEvents> => {
      middlewares.push(middleware);
      return brokerInterface;
    };

    const on = <K extends LifecycleEventName>(
      eventName: K,
      handler: LifecycleHandler<K>
    ): () => void => {
      return this.lifecycle.on(eventName, handler);
    };

    const planTopology = (): TopologyPlan => {
      return mergeTopologyPlans(topologyPlan);
    };

    const validateTopology = async (): Promise<TopologyValidationResult> => {
      return this.validatePlan(planTopology());
    };

    const redriveDlqFromInterface = async (
      options: DlqRedriveOptions
    ): Promise<DlqRedriveResult> => {
      const channel = await this.getChannel();
      return redriveDlq(channel, options);
    };

    const handle = <K extends keyof TEvents>(
      eventName: K | "*",
      handler: (id: string | number, event: TEvents[K]) => Promise<unknown>
    ): BrokerInterface<TEvents> => {
      handlers.set(eventName as string, handler as any);
      return brokerInterface;
    };

    const consume = async (opts?: ConsumeOptions): Promise<{ stop(): Promise<void> }> => {
      const consumerHandle = await consumer.startConsume(() => this.getChannel(), opts);
      this.activeConsumers.push(consumerHandle);

      return {
        stop: async () => {
          await consumerHandle.stop();
          this.activeConsumers = this.activeConsumers.filter((c) => c !== consumerHandle);
        },
      };
    };

    const produceMany = async <K extends keyof TEvents>(...events: TEvents[K][]): Promise<void> => {
      return publisher.produceMany<TEvents, K>(...events);
    };

    const produce = async <K extends keyof TEvents>(...events: TEvents[K][]): Promise<void | unknown> => {
      return publisher.produce<TEvents, K>(...events);
    };

    const publish = async <K extends keyof TEvents>(
      event: TEvents[K],
      opts?: PublishOptions
    ): Promise<void | unknown> => {
      return publisher.publish<TEvents, K>(event, opts);
    };

    const request = async <
      TReply = unknown,
      K extends keyof TEvents = keyof TEvents
    >(
      event: TEvents[K],
      opts?: RequestOptions
    ): Promise<TReply> => {
      return publisher.request<TReply>(event as EventEnvelope, opts);
    };

    const withChannel = async <T>(fn: (channel: Channel) => Promise<T> | T): Promise<T> => {
      const channel = await this.getChannel();
      return fn(channel);
    };

    const brokerInterface: BrokerInterface<TEvents> = {
      use,
      on,
      planTopology,
      validateTopology,
      redriveDlq: redriveDlqFromInterface,
      handle,
      consume,
      produce,
      produceMany,
      publish,
      request,
      withChannel,
      health: () => this.health(),
      with: <U extends Record<string, (...args: any[]) => EventEnvelope>>(events: U) => {
        const augmented = augmentEvents(events, brokerInterface as any);

        return augmented as BrokerInterface<{ [K in keyof U]: ReturnType<U[K]> }> & {
          [K in keyof U]: (...args: Parameters<U[K]>) => Promise<void | unknown>;
        };
      },
    };

    return brokerInterface;
  }
}
