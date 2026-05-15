import {
  LifecycleEventMap,
  LifecycleEventName,
  LifecycleHandler,
} from "./lifecycle";

type SpanStatusCodeLike = {
  OK?: number;
  ERROR?: number;
};

type SpanLike = {
  setAttribute?(key: string, value: string | number | boolean): void;
  setAttributes?(
    attributes: Record<string, string | number | boolean | undefined>
  ): void;
  addEvent?(
    name: string,
    attributes?: Record<string, string | number | boolean | undefined>
  ): void;
  recordException?(error: unknown): void;
  setStatus?(status: { code: number; message?: string }): void;
  end?(): void;
};

type TracerLike = {
  startSpan(name: string, options?: Record<string, unknown>): SpanLike;
};

type LifecycleSource = {
  on<K extends LifecycleEventName>(
    eventName: K,
    handler: LifecycleHandler<K>
  ): () => void;
};

export interface OpenTelemetryAdapterOptions {
  /**
   * Tracer instance from @opentelemetry/api.
   *
   * Example:
   * import { trace } from "@opentelemetry/api";
   * attachOpenTelemetry(broker, {
   *   tracer: trace.getTracer("rabbit-relay")
   * });
   */
  tracer: TracerLike;

  /**
   * Optional service name added as a span attribute.
   */
  serviceName?: string;

  /**
   * Optional span status codes.
   *
   * If omitted, defaults are compatible with @opentelemetry/api:
   * - OK = 1
   * - ERROR = 2
   */
  statusCode?: SpanStatusCodeLike;

  /**
   * Prefix used for generated span names.
   * Default: "rabbit-relay"
   */
  spanPrefix?: string;

  /**
   * Disable specific lifecycle events.
   */
  disabledEvents?: LifecycleEventName[];
}

export interface OpenTelemetryDetachHandle {
  detach(): void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function setAttributes(
  span: SpanLike,
  attributes: Record<string, string | number | boolean | undefined>
): void {
  const clean: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }

  if (typeof span.setAttributes === "function") {
    span.setAttributes(clean);
    return;
  }

  if (typeof span.setAttribute === "function") {
    for (const [key, value] of Object.entries(clean)) {
      span.setAttribute(key, value);
    }
  }
}

function finishOk(span: SpanLike, okCode: number): void {
  span.setStatus?.({
    code: okCode,
  });

  span.end?.();
}

function finishError(span: SpanLike, error: unknown, errorCode: number): void {
  span.recordException?.(error);

  span.setStatus?.({
    code: errorCode,
    message: errorMessage(error),
  });

  span.end?.();
}

function spanName(prefix: string, eventName: LifecycleEventName): string {
  return `${prefix}.${eventName}`;
}

function baseAttributes(params: {
  eventName: LifecycleEventName;
  serviceName?: string;
}): Record<string, string | number | boolean | undefined> {
  return {
    "messaging.system": "rabbitmq",
    "rabbit-relay.lifecycle.event": params.eventName,
    "service.name": params.serviceName,
  };
}

function attributesForEvent<K extends LifecycleEventName>(
  eventName: K,
  event: LifecycleEventMap[K],
  serviceName?: string
): Record<string, string | number | boolean | undefined> {
  const base = baseAttributes({
    eventName,
    serviceName,
  });

  switch (eventName) {
    case "reconnect": {
      const ev = event as LifecycleEventMap["reconnect"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
      };
    }

    case "topology.asserted": {
      const ev = event as LifecycleEventMap["topology.asserted"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
        "messaging.destination.name": ev.exchange,
        "messaging.rabbitmq.queue": ev.queue,
      };
    }

    case "consumer.started": {
      const ev = event as LifecycleEventMap["consumer.started"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
        "messaging.rabbitmq.queue": ev.queue,
        "rabbit-relay.consumer.prefetch": ev.prefetch,
        "rabbit-relay.consumer.concurrency": ev.concurrency,
      };
    }

    case "consumer.stopped": {
      const ev = event as LifecycleEventMap["consumer.stopped"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
        "messaging.rabbitmq.queue": ev.queue,
      };
    }

    case "publish.failed": {
      const ev = event as LifecycleEventMap["publish.failed"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
        "messaging.destination.name": ev.exchange,
        "messaging.rabbitmq.routing_key": ev.routingKey,
        "messaging.message.type": ev.eventName,
      };
    }

    case "retry.scheduled": {
      const ev = event as LifecycleEventMap["retry.scheduled"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
        "messaging.destination.name": ev.exchange,
        "messaging.rabbitmq.queue": ev.queue,
        "messaging.rabbitmq.routing_key": ev.routingKey,
        "rabbit-relay.retry.count": ev.retryCount,
        "rabbit-relay.retry.attempts": ev.attempts,
        "rabbit-relay.retry.delay_ms": ev.delayMs,
      };
    }

    case "broker.closed": {
      const ev = event as LifecycleEventMap["broker.closed"];

      return {
        ...base,
        "rabbit-relay.peer": ev.peerName,
      };
    }

    default:
      return base;
  }
}

/**
 * Attach OpenTelemetry-style tracing to Rabbit Relay lifecycle hooks.
 *
 * This helper does not import @opentelemetry/api directly.
 * Pass a tracer from your application instead.
 */
export function attachOpenTelemetry(
  source: LifecycleSource,
  options: OpenTelemetryAdapterOptions
): OpenTelemetryDetachHandle {
  const spanPrefix = options.spanPrefix ?? "rabbit-relay";
  const okCode = options.statusCode?.OK ?? 1;
  const errorCode = options.statusCode?.ERROR ?? 2;
  const disabled = new Set(options.disabledEvents ?? []);

  const offFns: Array<() => void> = [];

  function attach<K extends LifecycleEventName>(eventName: K): void {
    if (disabled.has(eventName)) return;

    const off = source.on(eventName, async (event) => {
      const span = options.tracer.startSpan(spanName(spanPrefix, eventName));

      setAttributes(
        span,
        attributesForEvent(eventName, event, options.serviceName)
      );

      span.addEvent?.(eventName);

      if (eventName === "publish.failed") {
        const ev = event as LifecycleEventMap["publish.failed"];
        finishError(span, ev.error, errorCode);
        return;
      }

      if (eventName === "retry.scheduled") {
        const ev = event as LifecycleEventMap["retry.scheduled"];

        if (ev.error) {
          span.recordException?.(ev.error);
          span.addEvent?.("retry.scheduled", {
            "exception.message": errorMessage(ev.error),
          });
        }

        finishOk(span, okCode);
        return;
      }

      finishOk(span, okCode);
    });

    offFns.push(off);
  }

  attach("reconnect");
  attach("topology.asserted");
  attach("consumer.started");
  attach("consumer.stopped");
  attach("publish.failed");
  attach("retry.scheduled");
  attach("broker.closed");

  return {
    detach(): void {
      for (const off of offFns.splice(0)) {
        off();
      }
    },
  };
}