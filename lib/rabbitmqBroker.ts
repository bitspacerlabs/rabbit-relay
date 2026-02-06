import { Channel } from "amqplib";
import { EventEnvelope } from "./eventFactories";
import { ExchangeConfig, BrokerInterface, InternalCfg, ConsumeOptions } from "./types";
import { ReconnectController } from "./reconnect";
import { createAssertTopology } from "./topology";
import { createConsumer } from "./consumer";
import { createPublisher } from "./publisher";

export class RabbitMQBroker {
  private peerName: string;
  private defaultCfg: InternalCfg;

  private reconnect: ReconnectController;

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

    this.reconnect = new ReconnectController();
    void this.reconnect.initChannel();
  }

  private async getChannel(): Promise<Channel> {
    return this.reconnect.getChannel();
  }

  private onReconnect(cb: (ch: Channel) => void | Promise<void>) {
    this.reconnect.onReconnect(cb);
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
    const assertTopology = createAssertTopology({
      exchangeName,
      queueName,
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
      return consumer.startConsume(() => this.getChannel(), opts);
    };

    const produceMany = async <K extends keyof TEvents>(...events: TEvents[K][]): Promise<void> => {
      return publisher.produceMany<TEvents, K>(...events);
    };

    const produce = async <K extends keyof TEvents>(...events: TEvents[K][]): Promise<void | unknown> => {
      return publisher.produce<TEvents, K>(...events);
    };

    const brokerInterface: BrokerInterface<TEvents> = {
      handle,
      consume,
      produce,
      produceMany,
      with: <U extends Record<string, (...args: any[]) => EventEnvelope>>(events: U) => {
        // keep original behavior (dynamic require) to avoid import cycles
        const { augmentEvents } = require("../eventFactories") as {
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
