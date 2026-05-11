import { Channel } from "amqplib";
import { EventEnvelope } from "./eventFactories";
import {
  ExchangeConfig,
  BrokerInterface,
  InternalCfg,
  ConsumeOptions,
  QueueConfig,
  PublishOptions,
  RequestOptions,
  BrokerHealth,
} from "./types";
import { ReconnectController } from "./reconnect";
import { createAssertTopology } from "./topology";
import { createConsumer } from "./consumer";
import { createPublisher } from "./publisher";
import { closeRabbitMQ, getRabbitMQHealthState } from "./config";

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
    };
  };
};

export class RabbitMQBroker {
  private peerName: string;
  private defaultCfg: InternalCfg;

  private reconnect: ReconnectController;
  private activeConsumers: Array<{ stop(): Promise<void> }> = [];
  private registeredConsumers: RegisteredConsumer[] = [];

  constructor(peerName: string, config: ExchangeConfig = {}) {
    this.peerName = peerName;
    this.defaultCfg = {
      exchangeType: config.exchangeType ?? "topic",
      routingKey: config.routingKey ?? "#",
      durable: config.durable ?? true,
      publisherConfirms: config.publisherConfirms ?? false,
      queueArgs: config.queueArgs,
      maxMessageBytes: config.maxMessageBytes,
      passiveQueue: config.passiveQueue ?? false,
      deadLetter: config.deadLetter,
      amqp: config.amqp,
    };

    this.reconnect = new ReconnectController();
    void this.reconnect.initChannel();
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

  public async close(): Promise<void> {
    const consumers = [...this.activeConsumers];
    this.activeConsumers = [];

    await Promise.all(
      consumers.map((consumer) => consumer.stop().catch(() => undefined))
    );

    this.reconnect.close();
    await closeRabbitMQ();
  }

  public async health(): Promise<BrokerHealth> {
    const rabbit = getRabbitMQHealthState();

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
    const assertTopology = createAssertTopology({
      exchangeName,
      queueName,
      queueConfig,
      defaultCfg: this.defaultCfg,
      exchangeConfig,
    });

    const channel = await this.getChannel();
    await assertTopology(channel);

    const handlers = new Map<
      string,
      (id: string | number, event: EventEnvelope) => Promise<unknown>
    >();

    const consumer = createConsumer({
      queueName,
      handlers,
    });

    this.registeredConsumers.push({
      queueName,
      getState: consumer.getState,
    });

    const publisher = createPublisher({
      exchangeName,
      exchangeConfig,
      defaultCfg: this.defaultCfg,
      getChannel: () => this.getChannel(),
      getBackoffMs: () => this.reconnect.getBackoffMs(),
    });

    this.onReconnect(async (ch) => {
      await assertTopology(ch);
      await consumer.resumeOnReconnect(ch);
    });

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
      handle,
      consume,
      produce,
      produceMany,
      publish,
      request,
      withChannel,
      health: () => this.health(),
      with: <U extends Record<string, (...args: any[]) => EventEnvelope>>(events: U) => {
        // keep original behavior (dynamic require) to avoid import cycles
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