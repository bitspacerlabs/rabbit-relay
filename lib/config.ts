import {
  connect,
  Channel,
  ConfirmChannel,
  ChannelModel,
} from "amqplib";
import os from "node:os";

export const rabbitMQUrl =
  process.env.RABBITMQ_URL ?? "amqp://user:password@localhost";

export type RabbitMQConnectionManagerOptions = {
  url?: string;
  connectionName?: string;
  connector?: typeof connect;
};

export class RabbitMQConnectionManager {
  private readonly url: string;
  private readonly connectionName: string;
  private readonly connector: typeof connect;

  private connection: ChannelModel | null = null;
  private connectionOpening: Promise<ChannelModel> | null = null;
  private channel: Channel | null = null;
  private channelOpening: Promise<Channel> | null = null;
  private confirmChannel: ConfirmChannel | null = null;
  private confirmChannelOpening: Promise<ConfirmChannel> | null = null;
  private isolatedConnections = new Set<ChannelModel>();
  private closed = false;
  private closePromise: Promise<void> | undefined;

  constructor(options: RabbitMQConnectionManagerOptions = {}) {
    this.url = options.url ?? rabbitMQUrl;
    this.connectionName =
      options.connectionName ??
      process.env.AMQP_CONN_NAME ??
      `app:${process.title || "node"}@${os.hostname()}#${process.pid}`;
    this.connector = options.connector ?? connect;
  }

  private attachConnectionHandlers(connection: ChannelModel): void {
    connection.on("blocked", (reason) =>
      console.warn("[amqp] connection blocked:", reason)
    );
    connection.on("unblocked", () =>
      console.log("[amqp] connection unblocked")
    );
    connection.on("close", () => {
      if (this.connection === connection) {
        this.connection = null;
        this.connectionOpening = null;
        this.channel = null;
        this.channelOpening = null;
        this.confirmChannel = null;
        this.confirmChannelOpening = null;
      }
    });
    connection.on("error", (error) => {
      if (!this.closed) {
        console.error("[amqp] connection error:", error);
      }
    });
  }

  private attachChannelHandlers(
    channel: Channel | ConfirmChannel,
    kind: "regular" | "confirm"
  ): void {
    channel.on("close", () => {
      if (kind === "regular" && this.channel === channel) {
        this.channel = null;
        this.channelOpening = null;
      }

      if (kind === "confirm" && this.confirmChannel === channel) {
        this.confirmChannel = null;
        this.confirmChannelOpening = null;
      }
    });

    channel.on("error", (error) => {
      if (!this.closed) {
        console.error(
          `[amqp] ${kind === "confirm" ? "confirm " : ""}channel error:`,
          error
        );
      }
    });
  }

  public async getConnection(): Promise<ChannelModel> {
    if (this.closed) {
      throw new Error("RabbitMQ connection manager is closed");
    }

    if (this.connection) return this.connection;
    if (this.connectionOpening) return this.connectionOpening;

    this.connectionOpening = (async () => {
      try {
        const connection = await this.connector(this.url, {
          clientProperties: {
            connection_name: this.connectionName,
          },
        });

        if (this.closed) {
          await connection.close().catch(() => undefined);
          throw new Error("RabbitMQ connection manager is closed");
        }

        this.attachConnectionHandlers(connection);
        this.connection = connection;
        return connection;
      } catch (error) {
        this.connection = null;
        throw error;
      } finally {
        this.connectionOpening = null;
      }
    })();

    return this.connectionOpening;
  }

  public async getChannel(): Promise<Channel> {
    if (this.closed) {
      throw new Error("RabbitMQ connection manager is closed");
    }

    if (this.channel) return this.channel;
    if (this.channelOpening) return this.channelOpening;

    this.channelOpening = (async () => {
      try {
        const connection = await this.getConnection();
        const channel = await connection.createChannel();

        if (this.closed) {
          await channel.close().catch(() => undefined);
          throw new Error("RabbitMQ connection manager is closed");
        }

        this.attachChannelHandlers(channel, "regular");
        this.channel = channel;
        return channel;
      } catch (error) {
        this.channel = null;
        throw error;
      } finally {
        this.channelOpening = null;
      }
    })();

    return this.channelOpening;
  }

  public async getConfirmChannel(): Promise<ConfirmChannel> {
    if (this.closed) {
      throw new Error("RabbitMQ connection manager is closed");
    }

    if (this.confirmChannel) return this.confirmChannel;
    if (this.confirmChannelOpening) return this.confirmChannelOpening;

    this.confirmChannelOpening = (async () => {
      try {
        const connection = await this.getConnection();
        const channel = await connection.createConfirmChannel();

        if (this.closed) {
          await channel.close().catch(() => undefined);
          throw new Error("RabbitMQ connection manager is closed");
        }

        this.attachChannelHandlers(channel, "confirm");
        this.confirmChannel = channel;
        return channel;
      } catch (error) {
        this.confirmChannel = null;
        throw error;
      } finally {
        this.confirmChannelOpening = null;
      }
    })();

    return this.confirmChannelOpening;
  }

  public async createChannel(): Promise<Channel> {
    const connection = await this.getConnection();
    const channel = await connection.createChannel();

    if (this.closed) {
      await channel.close().catch(() => undefined);
      throw new Error("RabbitMQ connection manager is closed");
    }

    return channel;
  }

  public async createIsolatedChannel(): Promise<{
    channel: Channel;
    close(): Promise<void>;
  }> {
    if (this.closed) {
      throw new Error("RabbitMQ connection manager is closed");
    }

    let connection: ChannelModel | undefined;
    let channel: Channel | undefined;

    try {
      connection = await this.connector(this.url, {
        clientProperties: {
          connection_name: `${this.connectionName}:validation`,
        },
      });
      connection.on("error", () => undefined);

      if (this.closed) {
        throw new Error("RabbitMQ connection manager is closed");
      }

      channel = await connection.createChannel();
      channel.on("error", () => undefined);

      if (this.closed) {
        throw new Error("RabbitMQ connection manager is closed");
      }

      return {
        channel,
        close: async () => {
          await channel?.close().catch(() => undefined);
          await connection?.close().catch(() => undefined);
        },
      };
    } catch (error) {
      await channel?.close().catch(() => undefined);
      await connection?.close().catch(() => undefined);
      throw error;
    }
  }

  public async createValidationSession(): Promise<{
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }> {
    if (this.closed) {
      throw new Error("RabbitMQ connection manager is closed");
    }

    const connection = await this.connector(this.url, {
      clientProperties: {
        connection_name: `${this.connectionName}:validation`,
      },
    });
    connection.on("error", () => undefined);

    if (this.closed) {
      await connection.close().catch(() => undefined);
      throw new Error("RabbitMQ connection manager is closed");
    }

    this.isolatedConnections.add(connection);
    let sessionClosed = false;

    const close = async (): Promise<void> => {
      if (sessionClosed) return;
      sessionClosed = true;
      this.isolatedConnections.delete(connection);
      await connection.close().catch(() => undefined);
    };

    return {
      createChannel: async (): Promise<Channel> => {
        if (this.closed || sessionClosed) {
          throw new Error("RabbitMQ validation session is closed");
        }

        const channel = await connection.createChannel();
        channel.on("error", () => undefined);

        if (this.closed || sessionClosed) {
          await channel.close().catch(() => undefined);
          throw new Error("RabbitMQ validation session is closed");
        }

        return channel;
      },
      close,
    };
  }

  public health() {
    const isOpen = (resource: any): boolean => {
      if (!resource) return false;
      if (resource.connection?.stream?.destroyed === true) return false;
      if (resource.stream?.destroyed === true) return false;
      return true;
    };

    return {
      connected: isOpen(this.connection),
      channelOpen: isOpen(this.channel),
      confirmChannelOpen: isOpen(this.confirmChannel),
    };
  }

  public close(): Promise<void> {
    if (!this.closePromise) {
      this.closePromise = this.performClose();
    }

    return this.closePromise;
  }

  private async performClose(): Promise<void> {
    this.closed = true;

    const confirmChannel = this.confirmChannel;
    const channel = this.channel;
    const connection = this.connection;
    const isolatedConnections = [...this.isolatedConnections];

    this.confirmChannel = null;
    this.confirmChannelOpening = null;
    this.channel = null;
    this.channelOpening = null;
    this.connection = null;
    this.connectionOpening = null;
    this.isolatedConnections.clear();

    await Promise.all(
      isolatedConnections.map((isolated) =>
        isolated.close().catch(() => undefined)
      )
    );
    await confirmChannel?.close().catch(() => undefined);
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }
}
