export type LifecycleEventMap = {
  reconnect: {
    peerName: string;
  };

  "topology.asserted": {
    peerName: string;
    exchange: string;
    queue: string;
  };

  "consumer.started": {
    peerName: string;
    queue: string;
    prefetch: number;
    concurrency: number;
  };

  "consumer.stopped": {
    peerName: string;
    queue: string;
  };

  "publish.failed": {
    peerName: string;
    exchange: string;
    routingKey: string;
    eventName?: string;
    error: unknown;
  };

  "retry.scheduled": {
    peerName: string;
    queue: string;
    exchange: string;
    routingKey: string;
    retryCount: number;
    attempts: number;
    delayMs?: number;
    error: unknown;
  };

  "broker.closed": {
    peerName: string;
  };
};

export type LifecycleEventName = keyof LifecycleEventMap;

export type LifecycleHandler<K extends LifecycleEventName> = (
  event: LifecycleEventMap[K]
) => void | Promise<void>;

export type LifecycleEmit = <K extends LifecycleEventName>(
  eventName: K,
  event: LifecycleEventMap[K]
) => Promise<void>;

export class LifecycleEmitter {
  private handlers = new Map<
    LifecycleEventName,
    Set<LifecycleHandler<any>>
  >();

  on<K extends LifecycleEventName>(
    eventName: K,
    handler: LifecycleHandler<K>
  ): () => void {
    const set = this.handlers.get(eventName) ?? new Set();

    set.add(handler as LifecycleHandler<any>);
    this.handlers.set(eventName, set);

    return () => {
      set.delete(handler as LifecycleHandler<any>);
    };
  }

  async emit<K extends LifecycleEventName>(
    eventName: K,
    event: LifecycleEventMap[K]
  ): Promise<void> {
    const set = this.handlers.get(eventName);

    if (!set) return;

    for (const handler of set) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[broker] lifecycle hook '${eventName}' failed:`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}