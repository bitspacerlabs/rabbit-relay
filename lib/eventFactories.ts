import { randomUUID as _randomUUID } from "crypto";

/** Optional metadata carried alongside the event payload. */
export interface EventMeta {
  corrId?: string;
  causationId?: string;
  /** Optional application headers. */
  headers?: Record<string, string>;
  expectsReply?: boolean;
  timeoutMs?: number;
}

export interface EventEnvelope<T = unknown> {
  id: string;
  name: string;
  v: string;
  time: number;
  data: T;
  meta?: EventMeta;
}

export type EnvelopeFactory<T> = (data: T, meta?: EventMeta) => EventEnvelope<T>;

export function expectReply(meta?: EventMeta, timeoutMs?: number): EventMeta {
  return { ...(meta ?? {}), expectsReply: true, ...(timeoutMs != null ? { timeoutMs } : {}) };
}

function randomId(): string {
  try {
    return (_randomUUID as any)?.() ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function event(name: string, v: string = "1.0.0") {
  return {
    of:
      <T = unknown>(): EnvelopeFactory<T> =>
      (data: T, meta?: EventMeta): EventEnvelope<T> => ({
        id: randomId(),
        name,
        v,
        time: Date.now(),
        data,
        meta,
      }),
  };
}

export function eventWithReply(name: string, v: string = "1.0.0") {
  return {
    of:
      <T = unknown, R = unknown>(): EnvelopeFactory<T> =>
      (data: T, meta?: EventMeta): EventEnvelope<T> => ({
        id: randomId(),
        name,
        v,
        time: Date.now(),
        data,
        meta: { expectsReply: false, ...(meta ?? {}) },
      }),
  };
}


/**
 * Augment an events map so calling a factory publishes via broker.produce().
 */
export function augmentEvents<T extends object>(
  events: Record<string, (...args: any[]) => EventEnvelope>,
  broker: { produce: (...evts: EventEnvelope[]) => Promise<unknown> }
): T & Record<string, (...args: any[]) => Promise<unknown>> {
  const augmented: any = { ...events, ...broker };
  for (const key of Object.keys(events)) {
    const factory = events[key];
    augmented[key] = async (...args: any[]) => broker.produce(factory(...args));
  }
  return augmented;
}
