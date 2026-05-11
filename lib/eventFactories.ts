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

export type EnvelopeFactory<T> = (
  data: T,
  meta?: EventMeta
) => EventEnvelope<T>;

export function expectReply(meta?: EventMeta, timeoutMs?: number): EventMeta {
  return {
    ...(meta ?? {}),
    expectsReply: true,
    ...(timeoutMs != null ? { timeoutMs } : {}),
  };
}

/**
 * Merge metadata into an event envelope.
 *
 * Existing event metadata is preserved unless explicitly overridden.
 * Headers are merged separately so existing headers are not lost.
 */
export function withMeta<T extends EventEnvelope>(
  event: T,
  meta: EventMeta
): T {
  event.meta = {
    ...(event.meta ?? {}),
    ...(meta ?? {}),
    headers: {
      ...(event.meta?.headers ?? {}),
      ...(meta.headers ?? {}),
    },
  };

  return event;
}

/**
 * Merge application headers into an event envelope.
 */
export function withHeaders<T extends EventEnvelope>(
  event: T,
  headers: Record<string, string>
): T {
  return withMeta(event, {
    headers,
  });
}

/**
 * Set or override the correlation ID for an event.
 */
export function withCorrelation<T extends EventEnvelope>(
  event: T,
  corrId: string
): T {
  return withMeta(event, {
    corrId,
  });
}

/**
 * Set or override the causation ID for an event.
 */
export function withCausation<T extends EventEnvelope>(
  event: T,
  causationId: string
): T {
  return withMeta(event, {
    causationId,
  });
}

function randomId(): string {
  try {
    return (
      (_randomUUID as any)?.() ??
      `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
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
      <T = unknown>(): EnvelopeFactory<T> =>
      (data: T, meta?: EventMeta): EventEnvelope<T> => ({
        id: randomId(),
        name,
        v,
        time: Date.now(),
        data,
        meta: { ...(meta ?? {}), expectsReply: true },
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