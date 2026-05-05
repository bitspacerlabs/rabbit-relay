import { Channel, ConfirmChannel, Options } from "amqplib";

export type PublishChannel = Channel | ConfirmChannel;

export const waitForDrain = (ch: PublishChannel) =>
  new Promise<void>((resolve) => {
    const anyCh = ch as any;

    if (typeof anyCh.once === "function") {
      anyCh.once("drain", resolve);
      return;
    }

    resolve();
  });

function isConfirmChannel(ch: PublishChannel): ch is ConfirmChannel {
  return typeof (ch as any).waitForConfirms === "function";
}

export const publishWithBackpressure = async (
  ch: PublishChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  options?: Options.Publish
): Promise<void> => {
  if (isConfirmChannel(ch)) {
    let publishOk = true;

    const confirmed = new Promise<void>((resolve, reject) => {
      publishOk = (ch as any).publish(
        exchange,
        routingKey,
        content,
        options ?? {},
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (!publishOk) {
      console.warn(
        `[amqp] publish backpressure: waiting for 'drain' (exchange=${exchange}, key=${routingKey}, size=${content.length})`
      );

      const t0 = Date.now();
      await waitForDrain(ch);
      const dt = Date.now() - t0;

      if (dt >= 1) {
        console.warn(
          `[amqp] drain resolved after ${dt}ms (exchange=${exchange}, key=${routingKey})`
        );
      }
    }

    await confirmed;
    return;
  }

  const ok = ch.publish(exchange, routingKey, content, options);

  if (!ok) {
    console.warn(
      `[amqp] publish backpressure: waiting for 'drain' (exchange=${exchange}, key=${routingKey}, size=${content.length})`
    );

    const t0 = Date.now();
    await waitForDrain(ch);
    const dt = Date.now() - t0;

    if (dt >= 1) {
      console.warn(
        `[amqp] drain resolved after ${dt}ms (exchange=${exchange}, key=${routingKey})`
      );
    }
  }
};

export const maybeWaitForConfirms = async (ch: PublishChannel) => {
  const anyCh = ch as any;

  if (typeof anyCh.waitForConfirms === "function") {
    await anyCh.waitForConfirms();
  }
};