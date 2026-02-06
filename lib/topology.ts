import { Channel, Options } from "amqplib";
import { ExchangeConfig, InternalCfg } from "./types";

export function mergeInternalCfg(defaultCfg: InternalCfg, exchangeConfig: ExchangeConfig): InternalCfg {
  return {
    exchangeType: exchangeConfig.exchangeType ?? defaultCfg.exchangeType,
    routingKey: exchangeConfig.routingKey ?? defaultCfg.routingKey,
    durable: exchangeConfig.durable ?? defaultCfg.durable,
    publisherConfirms: exchangeConfig.publisherConfirms ?? defaultCfg.publisherConfirms,
    queueArgs: exchangeConfig.queueArgs ?? defaultCfg.queueArgs,
    passiveQueue: exchangeConfig.passiveQueue ?? defaultCfg.passiveQueue,
  };
}

export function createAssertTopology(params: {
  exchangeName: string;
  queueName: string;
  defaultCfg: InternalCfg;
  exchangeConfig: ExchangeConfig;
}) {
  const { exchangeName, queueName, defaultCfg, exchangeConfig } = params;

  return async function assertTopology(channel: Channel) {
    const cfg = mergeInternalCfg(defaultCfg, exchangeConfig);

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
}
