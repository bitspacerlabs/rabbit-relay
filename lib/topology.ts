import { Channel, Options } from "amqplib";
import {
  DeadLetterConfig,
  ExchangeConfig,
  InternalCfg,
  QueueConfig,
} from "./types";
import {
  TopologyBindingPlan,
  TopologyExchangePlan,
  TopologyPlan,
  TopologyQueuePlan,
} from "./topologyPlan";

function mergeArguments(
  ...args: Array<Options.AssertQueue["arguments"] | undefined>
): Options.AssertQueue["arguments"] | undefined {
  const merged = Object.assign({}, ...args.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeBindArguments(
  ...args: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged = Object.assign({}, ...args.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;

  const obj = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

function omitKeys<T extends Record<string, unknown>>(
  value: T | undefined,
  keys: string[]
): Record<string, unknown> | undefined {
  if (!value) return undefined;

  const clean: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value)) {
    if (!keys.includes(key) && val !== undefined) {
      clean[key] = val;
    }
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

function buildDeadLetterQueueArguments(
  deadLetter?: DeadLetterConfig
): Options.AssertQueue["arguments"] | undefined {
  if (!deadLetter) return undefined;

  return {
    "x-dead-letter-exchange": deadLetter.exchange,
    ...(deadLetter.routingKey
      ? { "x-dead-letter-routing-key": deadLetter.routingKey }
      : {}),
  };
}

async function assertDeadLetterTopology(params: {
  channel: Channel;
  durable: boolean;
  deadLetter?: DeadLetterConfig;
}) {
  const { channel, durable, deadLetter } = params;

  if (!deadLetter || !deadLetter.autoDeclare) return;

  if (!deadLetter.queue) {
    throw new Error(
      "[broker] deadLetter.queue is required when deadLetter.autoDeclare=true"
    );
  }

  const exchangeType = deadLetter.exchangeType ?? "topic";
  const routingKey = deadLetter.routingKey ?? "#";

  await channel.assertExchange(deadLetter.exchange, exchangeType, {
    durable,
    ...(deadLetter.exchangeOptions ?? {}),
  });

  await channel.assertQueue(deadLetter.queue, {
    durable,
    ...(deadLetter.queueOptions ?? {}),
  });

  await channel.bindQueue(
    deadLetter.queue,
    deadLetter.exchange,
    routingKey,
    deadLetter.bindArguments
  );
}

export function mergeInternalCfg(
  defaultCfg: InternalCfg,
  exchangeConfig: ExchangeConfig
): InternalCfg {
  return {
    exchangeType: exchangeConfig.exchangeType ?? defaultCfg.exchangeType,
    routingKey: exchangeConfig.routingKey ?? defaultCfg.routingKey,
    durable: exchangeConfig.durable ?? defaultCfg.durable,
    publisherConfirms:
      exchangeConfig.publisherConfirms ?? defaultCfg.publisherConfirms,
    queueArgs: exchangeConfig.queueArgs ?? defaultCfg.queueArgs,
    topologyMode: exchangeConfig.topologyMode ?? defaultCfg.topologyMode,
    maxMessageBytes: exchangeConfig.maxMessageBytes ?? defaultCfg.maxMessageBytes,
    passiveQueue: exchangeConfig.passiveQueue ?? defaultCfg.passiveQueue,
    deadLetter: exchangeConfig.deadLetter ?? defaultCfg.deadLetter,
    amqp: {
      exchange: {
        ...(defaultCfg.amqp?.exchange ?? {}),
        ...(exchangeConfig.amqp?.exchange ?? {}),
      },
      queue: {
        ...(defaultCfg.amqp?.queue ?? {}),
        ...(exchangeConfig.amqp?.queue ?? {}),
      },
      bind: {
        ...(defaultCfg.amqp?.bind ?? {}),
        ...(exchangeConfig.amqp?.bind ?? {}),
      },
    },
  };
}

export function createTopologyPlan(params: {
  exchangeName: string;
  queueName: string;
  queueConfig?: QueueConfig;
  defaultCfg: InternalCfg;
  exchangeConfig: ExchangeConfig;
}): TopologyPlan {
  const { exchangeName, queueName, queueConfig, defaultCfg, exchangeConfig } =
    params;

  const cfg = mergeInternalCfg(defaultCfg, exchangeConfig);

  const exchanges: TopologyExchangePlan[] = [];
  const queues: TopologyQueuePlan[] = [];
  const bindings: TopologyBindingPlan[] = [];

  const exchangeOptions: Options.AssertExchange = {
    durable: cfg.durable,
    ...(cfg.amqp?.exchange ?? {}),
  };

  exchanges.push({
    name: exchangeName,
    type: cfg.exchangeType,
    durable: cfg.durable,
    options: omitKeys(
      exchangeOptions as Record<string, unknown>,
      ["durable"]
    ),
  });

  if (cfg.deadLetter?.autoDeclare) {
    if (!cfg.deadLetter.queue) {
      throw new Error(
        "[broker] deadLetter.queue is required when deadLetter.autoDeclare=true"
      );
    }

    const dlxType = cfg.deadLetter.exchangeType ?? "topic";
    const dlqRoutingKey = cfg.deadLetter.routingKey ?? "#";

    exchanges.push({
      name: cfg.deadLetter.exchange,
      type: dlxType,
      durable: cfg.durable,
      options: toRecord(cfg.deadLetter.exchangeOptions),
    });

    queues.push({
      name: cfg.deadLetter.queue,
      durable: cfg.durable,
      arguments: toRecord(cfg.deadLetter.queueOptions?.arguments),
      options: omitKeys(
        cfg.deadLetter.queueOptions as Record<string, unknown> | undefined,
        ["durable", "arguments"]
      ),
    });

    bindings.push({
      queue: cfg.deadLetter.queue,
      exchange: cfg.deadLetter.exchange,
      routingKey: dlqRoutingKey,
      arguments: toRecord(cfg.deadLetter.bindArguments),
    });
  }

  const queueAmqpOptions = {
    ...(cfg.amqp?.queue ?? {}),
    ...(queueConfig?.amqp?.queue ?? {}),
  } as Options.AssertQueue;

  const deadLetterArgs = buildDeadLetterQueueArguments(cfg.deadLetter);

  const mergedArgs = mergeArguments(
    cfg.queueArgs,
    deadLetterArgs,
    cfg.amqp?.queue?.arguments,
    queueConfig?.amqp?.queue?.arguments
  );

  queues.push({
    name: queueName,
    durable: cfg.durable,
    passive: cfg.passiveQueue || undefined,
    arguments: toRecord(mergedArgs),
    options: omitKeys(
      queueAmqpOptions as Record<string, unknown>,
      ["durable", "arguments"]
    ),
  });

  const bindArgs = mergeBindArguments(cfg.amqp?.bind);

  bindings.push({
    queue: queueName,
    exchange: exchangeName,
    routingKey: cfg.routingKey,
    arguments: toRecord(bindArgs),
  });

  return {
    exchanges,
    queues,
    bindings,
  };
}

export function createAssertTopology(params: {
  exchangeName: string;
  queueName: string;
  queueConfig?: QueueConfig;
  defaultCfg: InternalCfg;
  exchangeConfig: ExchangeConfig;
}) {
  const { exchangeName, queueName, queueConfig, defaultCfg, exchangeConfig } =
    params;

  return async function assertTopology(channel: Channel) {
    const cfg = mergeInternalCfg(defaultCfg, exchangeConfig);

    const exchangeOpts: Options.AssertExchange = {
      durable: cfg.durable,
      ...(cfg.amqp?.exchange ?? {}),
    };

    await channel.assertExchange(exchangeName, cfg.exchangeType, exchangeOpts);

    await assertDeadLetterTopology({
      channel,
      durable: cfg.durable,
      deadLetter: cfg.deadLetter,
    });

    const queueAmqpOptions = {
      ...(cfg.amqp?.queue ?? {}),
      ...(queueConfig?.amqp?.queue ?? {}),
    } as Options.AssertQueue;

    const deadLetterArgs = buildDeadLetterQueueArguments(cfg.deadLetter);

    if (cfg.passiveQueue) {
      if (cfg.queueArgs || queueAmqpOptions.arguments || deadLetterArgs) {
        console.warn(
          `[broker] passiveQueue=true: ignoring queue arguments for '${queueName}' (not declaring).`
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
              `or call with passiveQueue:false and queue options to auto-declare.`
          );
        }

        throw err;
      }
    } else {
      try {
        const mergedArgs = mergeArguments(
          cfg.queueArgs,
          deadLetterArgs,
          cfg.amqp?.queue?.arguments,
          queueConfig?.amqp?.queue?.arguments
        );

        const qOpts: Options.AssertQueue = {
          durable: cfg.durable,
          ...queueAmqpOptions,
          ...(mergedArgs ? { arguments: mergedArgs } : {}),
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

    const bindArgs = mergeBindArguments(cfg.amqp?.bind);

    // (Re)bind is idempotent - safe to call even if binding already exists
    await channel.bindQueue(queueName, exchangeName, cfg.routingKey, bindArgs);
  };
}