import { Channel, Options } from "amqplib";

export const waitForDrain = (ch: Channel) =>
  new Promise<void>((resolve) => {
    const anyCh = ch as any;
    if (typeof anyCh.once === "function") anyCh.once("drain", resolve);
    else resolve(); // if not supported, resolve immediately
  });

export const publishWithBackpressure = async (
  ch: Channel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  options?: Options.Publish
) => {
  const ok = ch.publish(exchange, routingKey, content, options);
  if (!ok) {
    console.warn(
      `[amqp] publish backpressure: waiting for 'drain' (exchange=${exchange}, key=${routingKey}, size=${content.length})`
    );
    const t0 = Date.now();
    await waitForDrain(ch);
    const dt = Date.now() - t0;
    if (dt >= 1) {
      console.warn(`[amqp] drain resolved after ${dt}ms (exchange=${exchange}, key=${routingKey})`);
    }
  }
};

export const maybeWaitForConfirms = async (ch: Channel) => {
  const anyCh = ch as any;
  if (typeof anyCh.waitForConfirms === "function") {
    await anyCh.waitForConfirms();
  }
};
