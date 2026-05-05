import { Channel, ConsumeMessage, Options } from "amqplib";
import { pluginManager } from "./pluginManager";
import { EventEnvelope } from "./eventFactories";
import { ConsumeOptions } from "./types";
import { publishWithBackpressure } from "./backpressure";

export type HandlerMap = Map<
  string,
  (id: string | number, event: EventEnvelope) => Promise<unknown>
>;

const RETRY_COUNT_HEADER = "x-rabbit-relay-retry-count";
const FIRST_FAILED_AT_HEADER = "x-rabbit-relay-first-failed-at";
const LAST_FAILED_AT_HEADER = "x-rabbit-relay-last-failed-at";
const LAST_ERROR_HEADER = "x-rabbit-relay-last-error";

type ErrorAction = "ack" | "requeue" | "dead-letter" | "retry";
type FinalRetryAction = "ack" | "requeue" | "dead-letter";

export function createConsumer(params: {
  queueName: string;
  handlers: HandlerMap;
}) {
  const { queueName, handlers } = params;

  let consumerTag: string | undefined;
  let isConsuming = false;
  let consumeCh: Channel | null = null;

  let prefetchCount = 1;
  let concurrency = 1;
  let onError: ErrorAction = "ack";
  let consumeOptions: ConsumeOptions | undefined;

  let retryAttempts = 0;
  let retryThen: FinalRetryAction = "dead-letter";

  const pendingMessages: ConsumeMessage[] = [];
  let activeHandlers = 0;
  let stopping = false;

  function getRetryCount(msg: ConsumeMessage): number {
    const raw = msg.properties.headers?.[RETRY_COUNT_HEADER];

    if (typeof raw === "number") return raw;

    if (typeof raw === "string") {
      const parsed = Number(raw);
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

    return {
      ...(msg.properties.headers ?? {}),
      [RETRY_COUNT_HEADER]: retryCount + 1,
      [FIRST_FAILED_AT_HEADER]:
        msg.properties.headers?.[FIRST_FAILED_AT_HEADER] ?? now,
      [LAST_FAILED_AT_HEADER]: now,
      [LAST_ERROR_HEADER]: errorMessage.slice(0, 500),
    };
  }

  function buildRetryPublishOptions(
    msg: ConsumeMessage,
    err: unknown
  ): Options.Publish {
    return {
      contentType: msg.properties.contentType,
      contentEncoding: msg.properties.contentEncoding,
      correlationId: msg.properties.correlationId,
      replyTo: msg.properties.replyTo,
      expiration: msg.properties.expiration,
      messageId: msg.properties.messageId,
      timestamp: msg.properties.timestamp,
      type: msg.properties.type,
      appId: msg.properties.appId,
      deliveryMode: msg.properties.deliveryMode,
      priority: msg.properties.priority,
      headers: buildRetryHeaders(msg, err),
    };
  }

  async function republishForRetry(
    msg: ConsumeMessage,
    err: unknown
  ): Promise<void> {
    const ch = consumeCh;

    if (!ch) {
      throw new Error(
        "Cannot retry message because consumer channel is not available"
      );
    }

    await publishWithBackpressure(
      ch,
      msg.fields.exchange,
      msg.fields.routingKey,
      msg.content,
      buildRetryPublishOptions(msg, err)
    );
  }

  function applyFinalFailureAction(ch: Channel, msg: ConsumeMessage) {
    if (retryThen === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (retryThen === "dead-letter") {
      ch.nack(msg, false, false);
      return;
    }

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

  async function handleFailure(
    ch: Channel,
    msg: ConsumeMessage,
    err: unknown
  ): Promise<void> {
    if (onError === "retry") {
      const currentRetryCount = getRetryCount(msg);

      if (currentRetryCount < retryAttempts) {
        try {
          await republishForRetry(msg, err);

          // ACK original only after retry copy is successfully published.
          ch.ack(msg);
          return;
        } catch (retryErr) {
          console.error("Retry publish failed:", retryErr);

          // If retry publish fails, do not silently lose the original.
          // Prefer DLQ if configured; otherwise requeue.
          if (retryThen === "dead-letter") {
            ch.nack(msg, false, false);
          } else {
            ch.nack(msg, false, true);
          }

          return;
        }
      }

      applyFinalFailureAction(ch, msg);
      return;
    }

    if (onError === "requeue") {
      ch.nack(msg, false, true);
      return;
    }

    if (onError === "dead-letter") {
      ch.nack(msg, false, false);
      return;
    }

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
      console.error("Reply publish failed:", e);
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
    } catch (err) {
      console.error("Invalid message payload:", err);

      try {
        ackOrNackParseFailure(ch, msg);
      } catch (e) {
        console.error("Ack/Nack failed:", e);
      }

      return;
    }

    const handler =
      (handlers.get(payload.name) as any) || (handlers.get("*") as any);

    try {
      await pluginManager.executeHook("beforeProcess", id, payload);

      if (handler) {
        result = await handler(id, payload as any);
      }

      await pluginManager.executeHook("afterProcess", id, payload, result);
    } catch (err) {
      errored = true;
      errorValue = err;
      result = err;

      console.error("Handler error:", err);
    }

    const shouldRetry =
      errored &&
      onError === "retry" &&
      getRetryCount(msg) < retryAttempts;

    // For RPC + retry, do not send a failure reply on an intermediate retry.
    // The retried message preserves replyTo/correlationId and may eventually reply.
    await maybeReplyToRpc(ch, msg, result, errored, shouldRetry);

    try {
      if (errored) {
        await handleFailure(ch, msg, errorValue);
      } else {
        ch.ack(msg);
      }
    } catch (e) {
      console.error("Ack/Nack failed:", e);
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
          console.error("Unexpected consumer processing error:", err);
        })
        .finally(() => {
          activeHandlers--;
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
    retryThen = opts?.retry?.then ?? "dead-letter";

    if (onError === "retry" && retryAttempts <= 0) {
      throw new Error(
        "[broker] consume retry.attempts must be greater than 0 when onError='retry'"
      );
    }

    stopping = false;

    const ch = await getChannel();
    consumeCh = ch;

    await ch.prefetch(prefetchCount, false);

    const ok = await ch.consume(
      queueName,
      onMessage,
      opts?.amqp?.consume
    );

    consumerTag = ok.consumerTag;
    isConsuming = true;

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
      },
    };
  }

  async function resumeOnReconnect(ch: Channel) {
    if (!isConsuming) return;

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