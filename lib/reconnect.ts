import { Channel } from "amqplib";
import { getRabbitMQChannel } from "./config";

export class ReconnectController {
  /** The current live channel promise (replaced after reconnect). */
  private channelPromise!: Promise<Channel>;

  /** Reconnect state */
  private reconnecting = false;
  private backoffMs = 500;
  private readonly maxBackoffMs = 20000;

  /** Callbacks to run after a successful reconnect (like re-assert topology, resume consume). */
  private onReconnectCbs: Array<(ch: Channel) => void | Promise<void>> = [];

  constructor() {
    // no-op
  }

  public async initChannel() {
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

  public onReconnect(cb: (ch: Channel) => void | Promise<void>) {
    this.onReconnectCbs.push(cb);
  }

  public async getChannel(): Promise<Channel> {
    return this.channelPromise;
  }

  private async scheduleReconnect(reason: string) {
    if (this.reconnecting) return;
    this.reconnecting = true;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, this.backoffMs + jitter));

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
}
