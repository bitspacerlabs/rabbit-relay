import { Channel, GetMessage, Options } from "amqplib";
import { publishWithBackpressure } from "./backpressure";

export interface DlqRedriveOptions {
  /**
   * DLQ queue to read messages from.
   */
  fromQueue: string;

  /**
   * Target exchange to republish messages to.
   */
  toExchange: string;

  /**
   * Target routing key.
   *
   * If omitted, Rabbit Relay reuses the message's original routing key.
   */
  routingKey?: string;

  /**
   * Maximum number of messages to redrive.
   *
   * Default: 100
   */
  limit?: number;

  /**
   * If true, do not consume, republish, or ACK messages.
   *
   * Dry-run only checks queue depth and returns a summary.
   */
  dryRun?: boolean;
}

export interface DlqRedriveResult {
  fromQueue: string;
  toExchange: string;
  routingKey?: string;
  dryRun: boolean;

  /**
   * Queue depth observed at the start of redrive.
   */
  available: number;

  /**
   * Number of DLQ messages read.
   */
  attempted: number;

  /**
   * Number of messages successfully republished.
   */
  republished: number;

  /**
   * Number of original DLQ messages ACKed after successful republish.
   */
  acked: number;

  /**
   * Number of messages that failed during redrive.
   */
  failed: number;

  /**
   * True if the DLQ was empty or became empty before reaching the limit.
   */
  empty: boolean;

  errors: Array<{
    message: string;
    error?: unknown;
  }>;
}

const REDRIVE_COUNT_HEADER = "x-rabbit-relay-redrive-count";
const REDRIVEN_AT_HEADER = "x-rabbit-relay-redriven-at";
const REDRIVEN_FROM_QUEUE_HEADER = "x-rabbit-relay-redriven-from-queue";
const REDRIVEN_TO_EXCHANGE_HEADER = "x-rabbit-relay-redriven-to-exchange";
const REDRIVEN_ROUTING_KEY_HEADER = "x-rabbit-relay-redriven-routing-key";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown DLQ redrive error";
  }
}

function getRedriveCount(msg: GetMessage): number {
  const raw = msg.properties.headers?.[REDRIVE_COUNT_HEADER];

  if (typeof raw === "number") return raw;

  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildRedrivePublishOptions(params: {
  msg: GetMessage;
  fromQueue: string;
  toExchange: string;
  routingKey: string;
}): Options.Publish {
  const { msg, fromQueue, toExchange, routingKey } = params;

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
    headers: {
      ...(msg.properties.headers ?? {}),
      [REDRIVE_COUNT_HEADER]: getRedriveCount(msg) + 1,
      [REDRIVEN_AT_HEADER]: new Date().toISOString(),
      [REDRIVEN_FROM_QUEUE_HEADER]: fromQueue,
      [REDRIVEN_TO_EXCHANGE_HEADER]: toExchange,
      [REDRIVEN_ROUTING_KEY_HEADER]: routingKey,
    },
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return 100;

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("[broker] redriveDlq limit must be a positive number");
  }

  return Math.floor(limit);
}

/**
 * Redrive messages from a DLQ to a target exchange/routing key.
 *
 * Safety behavior:
 * - bounded by limit
 * - dryRun does not consume messages
 * - ACKs original DLQ message only after successful republish
 * - preserves message body and AMQP properties
 */
export async function redriveDlq(
  channel: Channel,
  options: DlqRedriveOptions
): Promise<DlqRedriveResult> {
  const limit = normalizeLimit(options.limit);
  const dryRun = options.dryRun ?? false;

  const queueInfo = await channel.checkQueue(options.fromQueue);

  const result: DlqRedriveResult = {
    fromQueue: options.fromQueue,
    toExchange: options.toExchange,
    routingKey: options.routingKey,
    dryRun,
    available: queueInfo.messageCount,
    attempted: 0,
    republished: 0,
    acked: 0,
    failed: 0,
    empty: queueInfo.messageCount === 0,
    errors: [],
  };

  if (dryRun) {
    return result;
  }

  for (let i = 0; i < limit; i++) {
    const msg = await channel.get(options.fromQueue, {
      noAck: false,
    });

    if (!msg) {
      result.empty = true;
      break;
    }

    result.attempted++;

    const routingKey = options.routingKey ?? msg.fields.routingKey;

    try {
      await publishWithBackpressure(
        channel,
        options.toExchange,
        routingKey,
        msg.content,
        buildRedrivePublishOptions({
          msg,
          fromQueue: options.fromQueue,
          toExchange: options.toExchange,
          routingKey,
        })
      );

      channel.ack(msg);

      result.republished++;
      result.acked++;
    } catch (err) {
      result.failed++;

      result.errors.push({
        message: getErrorMessage(err),
        error: err,
      });

      try {
        // Do not lose the original DLQ message if republish failed.
        channel.nack(msg, false, true);
      } catch (nackErr) {
        result.errors.push({
          message: `Failed to requeue original DLQ message after redrive error: ${getErrorMessage(nackErr)}`,
          error: nackErr,
        });
      }

      break;
    }
  }

  return result;
}