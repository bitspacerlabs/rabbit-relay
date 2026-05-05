import { Channel } from "amqplib";
import { getRabbitMQChannel } from "./config";

export class ReconnectController {
  /** The current live channel promise (replaced after reconnect). */
  private channelPromise!: Promise<Channel>;

  /** Reconnect state */
  private reconnecting = false;
  private closed = false;
  private backoffMs = 500;
  private readonly maxBackoffMs = 20000;

  /** Callbacks to run after a successful reconnect (like re-assert topology, resume consume). */
  private onReconnectCbs: Array<(ch: Channel) => void | Promise<void>> = [];

  constructor() {
    // no-op
  }

  public async initChannel() {
    if (this.closed) return;

    this.channelPromise = getRabbitMQChannel();
    const ch = await this.channelPromise;

    this.backoffMs = 500;

    const onClose = () => this.scheduleReconnect("channel.close");
    const onError = () => this.scheduleReconnect("channel.error");

    (ch as any).on?.("close", onClose);
    (ch as any).on?.("error", onError);
  }

  public getBackoffMs() {
    return this.backoffMs;
  }

  public isReconnecting() {
    return this.reconnecting;
  }

  public onReconnect(cb: (ch: Channel) => void | Promise<void>) {
    this.onReconnectCbs.push(cb);
  }

  public async getChannel(): Promise<Channel> {
    if (this.closed) {
      throw new Error("RabbitMQ broker is closed");
    }

    return this.channelPromise;
  }

  public close() {
    this.closed = true;
    this.reconnecting = false;
    this.onReconnectCbs = [];
  }

  private async scheduleReconnect(reason: string) {
    if (this.closed || this.reconnecting) return;

    this.reconnecting = true;

    while (!this.closed) {
      try {
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, this.backoffMs + jitter));

        if (this.closed) return;

        await this.initChannel();
        const ch = await this.channelPromise;

        this.backoffMs = 500;
        this.reconnecting = false;

        for (const cb of this.onReconnectCbs) {
          try {
            await cb(ch);
          } catch (e) {
            console.error("[broker] onReconnect callback failed:", e);
          }
        }

        return;
      } catch {
        this.backoffMs = Math.min(
          this.maxBackoffMs,
          Math.floor(this.backoffMs * 1.7 + Math.random() * 100)
        );

        console.error(`[broker] reconnect failed (${reason}), retrying in ~${this.backoffMs}ms`);
      }
    }
  }

  public isClosed() {
    return this.closed;
  }
}