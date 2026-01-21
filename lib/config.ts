import {
  connect,
  Channel,
  ConfirmChannel,
  ChannelModel
} from "amqplib";
import os from "node:os";

export const rabbitMQUrl =
  process.env.RABBITMQ_URL ?? "amqp://user:password@localhost";

let conn: ChannelModel | null = null;

let ch: Channel | null = null;
let opening: Promise<Channel> | null = null;

let cch: ConfirmChannel | null = null;
let cOpening: Promise<ConfirmChannel> | null = null;

function attachConnHandlers(c: ChannelModel) {
  c.on("blocked", (reason) =>
    console.warn("[amqp] connection blocked:", reason)
  );
  c.on("unblocked", () =>
    console.log("[amqp] connection unblocked")
  );
  c.on("close", () => {
    console.error("[amqp] connection closed");
    conn = null;
    ch = null;
    opening = null;
    cch = null;
    cOpening = null;
  });
  c.on("error", (err) => {
    console.error("[amqp] connection error:", err);
    // 'close' will clear caches
  });
}

function attachChannelHandlers(
  channel: Channel | ConfirmChannel,
  kind: "ch" | "confirm"
) {
  channel.on("close", () => {
    console.error(
      `[amqp] ${kind === "confirm" ? "confirm channel" : "channel"} closed`
    );
    if (kind === "ch") {
      ch = null;
      opening = null;
    } else {
      cch = null;
      cOpening = null;
    }
  });

  channel.on("error", (err) => {
    console.error(
      `[amqp] ${kind === "confirm" ? "confirm channel" : "channel"} error:`,
      err
    );
  });
}

async function getConn(): Promise<ChannelModel> {
  if (conn) return conn;

  const c = await connect(rabbitMQUrl, {
    clientProperties: {
      connection_name:
        process.env.AMQP_CONN_NAME ||
        `app:${process.title || "node"}@${os.hostname()}#${process.pid}`,
    },
  });

  attachConnHandlers(c);
  conn = c;
  return c;
}

/** Always return a live channel */
async function openChannelFresh(): Promise<Channel> {
  if (ch) return ch;
  if (opening) return opening;

  opening = (async () => {
    try {
      const c = await getConn();
      const channel = await c.createChannel();
      attachChannelHandlers(channel, "ch");
      ch = channel;
      return channel;
    } catch (err) {
      opening = null;
      ch = null;
      conn = null;
      throw err;
    }
  })();

  return opening;
}

async function openConfirmChannelFresh(): Promise<ConfirmChannel> {
  if (cch) return cch;
  if (cOpening) return cOpening;

  cOpening = (async () => {
    try {
      const c = await getConn();
      const channel = await c.createConfirmChannel();
      attachChannelHandlers(channel, "confirm");
      cch = channel;
      return channel;
    } catch (err) {
      cOpening = null;
      cch = null;
      conn = null;
      throw err;
    }
  })();

  return cOpening;
}

export async function getRabbitMQConnection(): Promise<ChannelModel> {
  if (conn) return conn;
  await openChannelFresh();
  return conn!;
}

export async function getRabbitMQChannel(): Promise<Channel> {
  return openChannelFresh();
}

export async function getRabbitMQConfirmChannel(): Promise<ConfirmChannel> {
  return openConfirmChannelFresh();
}
