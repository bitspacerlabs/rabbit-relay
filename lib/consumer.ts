import { Channel, ConsumeMessage, Options } from "amqplib";
import { pluginManager } from "./pluginManager.js";
import { EventEnvelope, getEventSchema } from "./eventFactories.js";
import { SchemaValidationError } from "./errors.js";
import {
  ConsumeMiddleware,
  ConsumeMiddlewareContext,
  ConsumeOptions,
  ErrorAction,
  InvalidMessageContext,
  InvalidMessagePolicy,
  RetryBackoff,
  RetryThenAction,
  TopologyMode,
} from "./types.js";
import { publishWithBackpressure } from "./backpressure.js";
import { Dedupe, DedupeOpts, makeMemoryDedupe } from "./utils/dedupe.js";
import { LifecycleEmit } from "./lifecycle.js";

export type HandlerMap = Map<
  string,
  (id: string | number, event: EventEnvelope) => Promise<unknown>
>;

const RETRY_COUNT_HEADER = "x-rabbit-relay-retry-count";
const RETRY_DELAY_HEADER = "x-rabbit-relay-retry-delay-ms";
const FIRST_FAILED_AT_HEADER = "x-rabbit-relay-first-failed-at";
const LAST_FAILED_AT_HEADER = "x-rabbit-relay-last-failed-at";
const LAST_ERROR_HEADER = "x-rabbit-relay-last-error";

type FinalRetryAction = RetryThenAction;

type BuiltInDedupeConfig = DedupeOpts & {
  enabled?: boolean;
};

export function createConsumer(params: {
  peerName: string;
  queueName: string;
  exchangeName: string;
  topologyMode: TopologyMode;
  handlers: HandlerMap;
  middlewares: ConsumeMiddleware[];
  emitLifecycle: LifecycleEmit;
  shutdownTimeoutMs: number;
}) {
  const {
    peerName,
    queueName,
    exchangeName,
    topologyMode,
    handlers,
    middlewares,
    emitLifecycle,
    shutdownTimeoutMs,
  } = params;

  let consumerTag: string | undefined;
  let isConsuming = false;
  let consumeCh: Channel | null = null;

  let prefetchCount = 1;
  let concurrency = 1;
  let onError: ErrorAction = "ack";
  let consumeOptions: ConsumeOptions | undefined;

  let retryAttempts = 0;
  let retryDelayMs: number | undefined;
  let retryBackoff: RetryBackoff | undefined;
  let retryThen: FinalRetryAction = "dead-letter";

  let dedupe: Dedupe | undefined;
  let invalidMessagePolicy: InvalidMessagePolicy | undefined;

  const pendingMessages: ConsumeMessage[] = [];
  let activeHandlers = 0;
  let stopping = false;
  const drainWaiters = new Set<() => void>();

  function notifyDrained(): void {
    if (activeHandlers !== 0) return;
    for (const resolve of drainWaiters) resolve();
    drainWaiters.clear();
  }

  async function waitForActiveHandlers(): Promise<void> {
    if (activeHandlers === 0) return;

    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (timer) clearTimeout(timer);
        drainWaiters.delete(done);
        resolve();
      };

      drainWaiters.add(done);
      timer = setTimeout(done, shutdownTimeoutMs);
    });
  }

  function isDedupeInstance(value: unknown): value is Dedupe {
    return (
      typeof value === "object" &&
      value !== null &&
      "checkAndRemember" in value &&
      typeof (value as Dedupe).checkAndRemember === "function"
    );
  }

  function resolveDedupe(opts?: ConsumeOptions): Dedupe | undefined {
    const configured = opts?.dedupe;

    if (!configured) return undefined;

    if (isDedupeInstance(configured)) {
      return configured;
    }

    const config = configured as BuiltInDedupeConfig;

    if (config.enabled === false) return undefined;

    return makeMemoryDedupe(config);
  }

  async function runMiddlewareChain(
    ctx: ConsumeMiddlewareContext,
    handler: () => Promise<void>
  ): Promise<void> {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("[broker] next() called multiple times in middleware");
      }

      index = i;

      const middleware = middlewares[i];

      if (!middleware) {
        await handler();
        return;
      }

      await middleware(ctx, () => dispatch(i + 1));
    }

    await dispatch(0);
  }

  function getRetryExchangeName(attempt = 1): string {
    if (retryBackoff === "exponential") {
      return `${queueName}.retry.a${attempt}.exchange`;
    }
    return `${queueName}.retry.exchange`;
  }

  function retryDelayForAttempt(attempt: number): number {
    const base = retryDelayMs ?? 0;

    if (retryBackoff !== "exponential") return base;

    // RabbitMQ TTL arguments are 32-bit signed integers.
    return Math.min(base * 2 ** (attempt - 1), 2 ** 31 - 1);
  }

  function getRetryQueueName(attempt = 1): string {
    if (retryBackoff === "exponential") {
      return `${queueName}.retry.a${attempt}.${retryDelayForAttempt(attempt)}.queue`;
    }
    return `${queueName}.retry.${retryDelayMs}.queue`;
  }

  function getRetryCount(msg: ConsumeMessage): number {
    const raw = msg.properties.headers?.[RETRY_COUNT_HEADER];

    if (typeof raw === "number") return raw;

    if (typeof raw === "string") {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (Buffer.isBuffer(raw)) {
      const parsed = Number(raw.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;

    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown handler error";
    }
  }

  function buildRetryHeaders(
    msg: ConsumeMessage,
    err: unknown
  ): Record<string, unknown> {
    const now = new Date().toISOString();
    const retryCount = getRetryCount(msg);
    const errorMessage = getErrorMessage(err);
    const nextAttempt = retryCount + 1;

    return {
      ...(msg.properties.headers ?? {}),
      [RETRY_COUNT_HEADER]: nextAttempt,
      ...(retryDelayMs != null
        ? { [RETRY_DELAY_HEADER]: retryDelayForAttempt(nextAttempt) }
        : {}),
      [FIRST_FAILED_AT_HEADER]:
        msg.properties.headers?.[FIRST_FAILED_AT_HEADER] ?? now,
      [LAST_FAILED_AT_HEADER]: now,
      [LAST_ERROR_HEADER]: errorMessage.slice(0, 500),
    };
  }

  function hydrateEventMetaFromMessage(
    event: EventEnvelope,
    msg: ConsumeMessage
  ): EventEnvelope {
    const headers = msg.properties.headers ?? {};

    event.meta = {
      ...(event.meta ?? {}),
      ...(msg.properties.correlationId && !event.meta?.corrId
        ? { corrId: msg.properties.correlationId }
        : {}),
      headers: {
        ...(event.meta?.headers ?? {}),
        ...headers,
      } as Record<string, string>,
    };

    return event;
  }

  function buildRetryPublishOptions(
    msg: ConsumeMessage,
    err: unknown,
    opts: { preserveExpiration: boolean }
  ): Options.Publish {
    return {
      contentType: msg.properties.contentType,
      contentEncoding: msg.properties.contentEncoding,
      correlationId: msg.properties.correlationId,
      replyTo: msg.properties.replyTo,
      ...(opts.preserveExpiration ? { expiration: msg.properties.expiration } : {}),
      messageId: msg.properties.messageId,
      timestamp: msg.properties.timestamp,
      type: msg.properties.type,
      appId: msg.properties.appId,
      deliveryMode: msg.properties.deliveryMode,
      priority: msg.properties.priority,
      headers: buildRetryHeaders(msg, err),
    };
  }

  async function assertDelayedRetryTopology(ch: Channel): Promise<void> {
    if (retryDelayMs == null) return;

    if (topologyMode === "plan-only") {
      return;
    }

    const attemptCount =
      retryBackoff === "exponential" ? Math.max(retryAttempts, 1) : 1;

    for (let attempt = 1; attempt <= attemptCount; attempt++) {
      await assertRetryParkingTopology(ch, attempt);
    }
  }

  async function assertRetryParkingTopology(
    ch: Channel,
    attempt: number
  ): Promise<void> {
    const retryExchange = getRetryExchangeName(attempt);
    const retryQueue = getRetryQueueName(attempt);

    if (topologyMode === "passive") {
      try {
        await ch.checkExchange(retryExchange);
        await ch.checkQueue(retryQueue);
        await ch.bindQueue(retryQueue, retryExchange, "#");
      } catch (err) {
        throw new Error(
          `[broker] topologyMode='passive' delayed retry topology check failed for ` +
            `'${retryExchange}' / '${retryQueue}': ${getErrorMessage(err)}`
        );
      }

      return;
    }

    await ch.assertExchange(retryExchange, "topic", {
      durable: true,
    });

    await ch.assertQueue(retryQueue, {
      durable: true,
      arguments: {
        "x-message-ttl": retryDelayForAttempt(attempt),
        "x-dead-letter-exchange": exchangeName,
      },
    });

    await ch.bindQueue(retryQueue, retryExchange, "#");
  }

  async function republishForImmediateRetry(
    msg: ConsumeMessage,
    err: unknown
  ): Promise<void> {
    const ch = consumeCh;

    if (!ch) {
      throw new Error(
        `[broker] Cannot retry message for queue '${queueName}': consumer channel is not available`
      );
    }

    await publishWithBackpressure(
      ch,
      msg.fields.exchange,
      msg.fields.routingKey,
      msg.content,
      buildRetryPublishOptions(msg, err, { preserveExpiration: true })
    );
  }

  async function republishForDelayedRetry(
    msg: ConsumeMessage,
    err: unknown
  ): Promise<void> {
    const ch = consumeCh;

    if (!ch) {
      throw new Error(
        `[broker] Cannot delayed-retry message for queue '${queueName}': consumer channel is not available`
      );
    }

    const nextAttempt = getRetryCount(msg) + 1;
    const retryExchange = getRetryExchangeName(nextAttempt);

    await assertRetryParkingTopology(ch, nextAttempt);

    await publishWithBackpressure(
      ch,
      retryExchange,
      msg.fields.routingKey,
      msg.content,
      buildRetryPublishOptions(msg, err, { preserveExpiration: false })
    );
  }

  async function republishForRetry(
    msg: ConsumeMessage,
    err: unknown
  ): Promise<void> {
    if (retryDelayMs != null) {
      await republishForDelayedRetry(msg, err);
      return;
    }

    await republishForImmediateRetry(msg, err);
  }

  function applyFinalFailureAction(ch: Channel, msg: ConsumeMessage, payload?: EventEnvelope) {
    if (retryThen === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (retryThen === "dead-letter") {
      emitLifecycle("message.dead-lettered", {
        peerName,
        queue: queueName,
        exchange: msg.fields.exchange,
        routingKey: msg.fields.routingKey,
        eventName: payload?.name ?? "unknown",
        reason: "retry attempts exhausted",
      }).catch(() => {});
      ch.nack(msg, false, false);
      return;
    }

    emitLifecycle("message.dropped", {
      peerName,
      queue: queueName,
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      eventName: payload?.name ?? "unknown",
      reason: "retry attempts exhausted, retry.then=ack",
    }).catch(() => {});
    ch.ack(msg);
  }

  function ackOrNackParseFailure(ch: Channel, msg: ConsumeMessage) {
    if (onError === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (onError === "dead-letter" || onError === "retry") {
      ch.nack(msg, false, false);
      return;
    }

    ch.ack(msg);
  }

  async function applyInvalidMessagePolicy(
    ch: Channel,
    msg: ConsumeMessage,
    payload: EventEnvelope,
    error: Error
  ): Promise<void> {
    const policy = invalidMessagePolicy ?? onError ?? "dead-letter";

    if (typeof policy === "function") {
      const ctx: InvalidMessageContext = {
        id: msg.fields.deliveryTag,
        event: payload,
        error,
        queue: queueName,
        ack: async () => {
          try { ch.ack(msg); } catch { /* channel may be closed */ }
        },
        nack: async (requeue: boolean) => {
          try { ch.nack(msg, false, requeue); } catch { /* channel may be closed */ }
        },
      };
      await policy(ctx);
      return;
    }

    if (policy === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (policy === "dead-letter") {
      ch.nack(msg, false, false);
      return;
    }

    ch.ack(msg);
  }

  async function handleFailure(
    ch: Channel,
    msg: ConsumeMessage,
    err: unknown,
    payload?: EventEnvelope
  ): Promise<void> {
    if (onError === "retry") {
      const currentRetryCount = getRetryCount(msg);

      if (currentRetryCount < retryAttempts) {
        try {
          await republishForRetry(msg, err);

          const nextRetryCount = currentRetryCount + 1;

          await emitLifecycle("retry.scheduled", {
            peerName,
            queue: queueName,
            exchange: msg.fields.exchange,
            routingKey: msg.fields.routingKey,
            retryCount: nextRetryCount,
            attempts: retryAttempts,
            ...(retryDelayMs != null
              ? { delayMs: retryDelayForAttempt(nextRetryCount) }
              : {}),
            ...(retryBackoff != null ? { backoff: retryBackoff } : {}),
            error: err,
          });

          // ACK original only after retry copy is successfully published.
          ch.ack(msg);
          return;
        } catch (retryErr) {
          console.error(`[peer=${peerName}, queue=${queueName}] Retry publish failed:`, retryErr);

          // If retry publish fails, do not silently lose the original.
          // Prefer DLQ if configured; otherwise requeue.
          if (retryThen === "dead-letter") {
            await emitLifecycle("message.dead-lettered", {
              peerName,
              queue: queueName,
              exchange: msg.fields.exchange,
              routingKey: msg.fields.routingKey,
              eventName: payload?.name ?? "unknown",
              reason: retryErr,
            });
            ch.nack(msg, false, false);
          } else {
            ch.nack(msg, false, true);
          }

          return;
        }
      }

      applyFinalFailureAction(ch, msg, payload);
      return;
    }

    if (onError === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (onError === "dead-letter") {
      await emitLifecycle("message.dead-lettered", {
        peerName,
        queue: queueName,
        exchange: msg.fields.exchange,
        routingKey: msg.fields.routingKey,
        eventName: payload?.name ?? "unknown",
        reason: err,
      });
      ch.nack(msg, false, false);
      return;
    }

    await emitLifecycle("message.dropped", {
      peerName,
      queue: queueName,
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      eventName: payload?.name ?? "unknown",
      reason: err,
    });
    ch.ack(msg);
  }

  async function maybeReplyToRpc(
    ch: Channel,
    msg: ConsumeMessage,
    result: unknown,
    errored: boolean,
    shouldSkipReply: boolean
  ) {
    if (!msg.properties.replyTo || shouldSkipReply) return;

    try {
      await publishWithBackpressure(
        ch,
        "",
        msg.properties.replyTo,
        Buffer.from(JSON.stringify({ reply: errored ? null : result })),
        { correlationId: msg.properties.correlationId }
      );
    } catch (e) {
      console.error(`[peer=${peerName}, queue=${queueName}] Reply publish failed:`, e);
    }
  }

  const processMessage = async (msg: ConsumeMessage) => {
    const ch = consumeCh;

    if (!ch) return;

    const id = msg.fields.deliveryTag;

    let payload: EventEnvelope;
    let result: unknown = null;
    let errored = false;
    let errorValue: unknown = null;

    try {
      payload = JSON.parse(msg.content.toString()) as EventEnvelope;
      payload = hydrateEventMetaFromMessage(payload, msg);
    } catch (err) {
      console.error(`[peer=${peerName}, queue=${queueName}] Invalid message payload:`, err);

      try {
        ackOrNackParseFailure(ch, msg);
      } catch (e) {
        console.error(`[peer=${peerName}, queue=${queueName}] Ack/Nack failed after parse failure:`, e);
      }

      return;
    }

    if (dedupe && !dedupe.checkAndRemember(payload)) {
      try {
        ch.ack(msg);
      } catch (e) {
        console.error(`[peer=${peerName}, queue=${queueName}] Ack duplicate failed:`, e);
      }

      return;
    }

    const schema = getEventSchema(payload.name);

    if (schema) {
      try {
        payload.data = schema.parse(payload.data) as EventEnvelope["data"];
      } catch (err) {
        const validationError = new SchemaValidationError({
          eventName: payload.name,
          eventVersion: payload.v,
          eventId: payload.id,
          originalError: err,
        });

        console.error(validationError);

        try {
          await applyInvalidMessagePolicy(ch, msg, payload, validationError);
        } catch (e) {
          console.error(`[peer=${peerName}, queue=${queueName}] Invalid message policy failed:`, e);
        }

        return;
      }
    }

    const handler =
      (handlers.get(payload.name) as any) || (handlers.get("*") as any);

    const handlerStart = Date.now();
    const handlerEventName = payload.name;

    try {
      await pluginManager.executeHook("beforeProcess", id, payload);

      await runMiddlewareChain(
        {
          id,
          event: payload,
          queue: queueName,
        },
        async () => {
          if (handler) {
            result = await handler(id, payload as any);
          }
        }
      );

      await pluginManager.executeHook("afterProcess", id, payload, result);
    } catch (err) {
      errored = true;
      errorValue = err;
      result = err;

      console.error(`[peer=${peerName}, queue=${queueName}] Handler error:`, err);
    }

    const handlerDuration = Date.now() - handlerStart;

    await emitLifecycle("handler.completed", {
      peerName,
      queue: queueName,
      eventName: handlerEventName,
      durationMs: handlerDuration,
      ...(errored ? { error: errorValue } : {}),
    });

    const shouldRetry =
      errored &&
      onError === "retry" &&
      getRetryCount(msg) < retryAttempts;

    // For RPC + retry, do not send a failure reply on an intermediate retry.
    // The retried message preserves replyTo/correlationId and may eventually reply.
    await maybeReplyToRpc(ch, msg, result, errored, shouldRetry);

    try {
      if (errored) {
        await handleFailure(ch, msg, errorValue, payload);
      } else {
        ch.ack(msg);
      }
    } catch (e) {
      console.error(`[peer=${peerName}, queue=${queueName}] Ack/Nack failed after handler:`, e);
    }
  };

  const processNext = () => {
    if (stopping) return;

    while (activeHandlers < concurrency && pendingMessages.length > 0) {
      const msg = pendingMessages.shift();

      if (!msg) return;

      activeHandlers++;

      void processMessage(msg)
        .catch((err) => {
          console.error(`[peer=${peerName}, queue=${queueName}] Unexpected consumer processing error:`, err);
        })
        .finally(() => {
          activeHandlers--;
          notifyDrained();
          processNext();
        });
    }
  };

  const onMessage = (msg: ConsumeMessage | null) => {
    if (!msg) return;

    if (stopping) {
      try {
        consumeCh?.nack(msg, false, true);
      } catch {
        // channel may be closed
      }

      return;
    }

    pendingMessages.push(msg);
    processNext();
  };

  async function startConsume(
    getChannel: () => Promise<Channel>,
    opts?: ConsumeOptions
  ) {
    consumeOptions = opts;

    prefetchCount = opts?.prefetch ?? opts?.concurrency ?? 1;
    concurrency = opts?.concurrency ?? prefetchCount;

    if (concurrency <= 0) {
      throw new Error("[broker] consume concurrency must be greater than 0");
    }

    if (prefetchCount <= 0) {
      throw new Error("[broker] consume prefetch must be greater than 0");
    }

    if (concurrency > prefetchCount) {
      console.warn(
        `[broker] consume concurrency (${concurrency}) is greater than prefetch (${prefetchCount}). ` +
        `Concurrency will be limited by RabbitMQ prefetch.`
      );
    }

    onError = opts?.onError ?? (opts?.requeueOnError ? "requeue" : "ack");

    retryAttempts = opts?.retry?.attempts ?? 0;
    retryDelayMs = opts?.retry?.delayMs;
    retryBackoff = opts?.retry?.backoff;
    retryThen = opts?.retry?.then ?? "dead-letter";

    if (onError === "retry" && retryAttempts <= 0) {
      throw new Error(
        "[broker] consume retry.attempts must be greater than 0 when onError='retry'"
      );
    }

    if (onError === "retry" && retryDelayMs != null) {
      if (!Number.isFinite(retryDelayMs) || retryDelayMs <= 0) {
        throw new Error(
          "[broker] consume retry.delayMs must be a positive number when provided"
        );
      }
    }

    if (
      onError === "retry" &&
      retryBackoff != null &&
      retryBackoff !== "fixed" &&
      retryBackoff !== "exponential"
    ) {
      throw new Error(
        "[broker] consume retry.backoff must be 'fixed' or 'exponential'"
      );
    }

    if (onError === "retry" && retryBackoff != null && retryDelayMs == null) {
      throw new Error(
        "[broker] consume retry.backoff requires retry.delayMs to be set"
      );
    }

    dedupe = resolveDedupe(opts);
    invalidMessagePolicy = opts?.invalidMessage;

    stopping = false;

    const ch = await getChannel();
    consumeCh = ch;

    await assertDelayedRetryTopology(ch);

    await ch.prefetch(prefetchCount, false);

    const ok = await ch.consume(
      queueName,
      onMessage,
      opts?.amqp?.consume
    );

    consumerTag = ok.consumerTag;
    isConsuming = true;

    await emitLifecycle("consumer.started", {
      peerName,
      queue: queueName,
      prefetch: prefetchCount,
      concurrency,
    });

    return {
      stop: async (): Promise<void> => {
        isConsuming = false;
        stopping = true;

        try {
          const c = consumeCh;

          if (consumerTag && c) {
            await c.cancel(consumerTag);
          }
        } catch {
          // channel may be closed, ignore
        }

        const c = consumeCh;
        while (pendingMessages.length > 0) {
          const pending = pendingMessages.shift();
          if (!pending || !c) continue;
          try {
            c.nack(pending, false, true);
          } catch {
            // channel may be closed
          }
        }

        await waitForActiveHandlers();

        await emitLifecycle("consumer.stopped", {
          peerName,
          queue: queueName,
        });
      },
    };
  }

  async function resumeOnReconnect(ch: Channel) {
    if (!isConsuming) return;

    await assertDelayedRetryTopology(ch);

    await ch.prefetch(prefetchCount, false);

    consumeCh = ch;
    stopping = false;

    const ok = await ch.consume(
      queueName,
      onMessage,
      consumeOptions?.amqp?.consume
    );

    consumerTag = ok.consumerTag;
  }

  function getState() {
    return {
      isConsuming,
      prefetchCount,
      concurrency,
      activeHandlers,
      pendingMessages: pendingMessages.length,
      onError,
      retry:
        onError === "retry"
          ? {
              attempts: retryAttempts,
              then: retryThen,
              ...(retryDelayMs != null ? { delayMs: retryDelayMs } : {}),
              ...(retryBackoff != null ? { backoff: retryBackoff } : {}),
            }
          : undefined,
    };
  }

  return {
    startConsume,
    resumeOnReconnect,
    getState,
  };
}
