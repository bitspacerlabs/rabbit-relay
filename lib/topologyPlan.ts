export type TopologyExchangeType = "topic" | "direct" | "fanout" | "headers";

export type TopologyRecord = Record<string, unknown>;

export interface TopologyExchangePlan {
  name: string;
  type: TopologyExchangeType;
  durable: boolean;
  options?: TopologyRecord;
}

export interface TopologyQueuePlan {
  name: string;
  durable: boolean;
  passive?: boolean;
  arguments?: TopologyRecord;
  options?: TopologyRecord;
}

export interface TopologyBindingPlan {
  queue: string;
  exchange: string;
  routingKey: string;
  arguments?: TopologyRecord;
}

export interface TopologyPlan {
  exchanges: TopologyExchangePlan[];
  queues: TopologyQueuePlan[];
  bindings: TopologyBindingPlan[];
}

export function emptyTopologyPlan(): TopologyPlan {
  return {
    exchanges: [],
    queues: [],
    bindings: [],
  };
}

function stableJson(value: unknown): string {
  if (value == null) return "";

  try {
    return JSON.stringify(value, Object.keys(value as object).sort());
  } catch {
    return String(value);
  }
}

function exchangeKey(exchange: TopologyExchangePlan): string {
  return `${exchange.name}:${exchange.type}`;
}

function queueKey(queue: TopologyQueuePlan): string {
  return queue.name;
}

function bindingKey(binding: TopologyBindingPlan): string {
  return [
    binding.queue,
    binding.exchange,
    binding.routingKey,
    stableJson(binding.arguments),
  ].join(":");
}

export function mergeTopologyPlans(...plans: TopologyPlan[]): TopologyPlan {
  const exchanges = new Map<string, TopologyExchangePlan>();
  const queues = new Map<string, TopologyQueuePlan>();
  const bindings = new Map<string, TopologyBindingPlan>();

  for (const plan of plans) {
    for (const exchange of plan.exchanges) {
      exchanges.set(exchangeKey(exchange), exchange);
    }

    for (const queue of plan.queues) {
      queues.set(queueKey(queue), queue);
    }

    for (const binding of plan.bindings) {
      bindings.set(bindingKey(binding), binding);
    }
  }

  return {
    exchanges: [...exchanges.values()],
    queues: [...queues.values()],
    bindings: [...bindings.values()],
  };
}