import {
  RabbitMQBroker,
  event,
  traceFrom,
} from "../../lib";
import type { EventEnvelope } from "../../lib";

type OrderCreated = {
  orderId: string;
  amount: number;
};

type PaymentRequested = {
  orderId: string;
  amount: number;
};

type Ping = {
  id: string;
};

type Pong = {
  ok: boolean;
  message: string;
};

(async () => {
  const broker = new RabbitMQBroker("dx.consumer", {
    maxMessageBytes: 256 * 1024,
  });

  const orders = await broker
    .queue("dx.orders.q")
    .exchange<{
      "dx.order.created": EventEnvelope<OrderCreated>;
      "dx.ping": EventEnvelope<Ping>;
    }>("dx.orders.ex", {
      exchangeType: "topic",
      routingKey: "dx.#",
      publisherConfirms: true,
      maxMessageBytes: 256 * 1024,
    });

  const payments = await broker
    .queue("dx.payments.publisher.q")
    .exchange<{
      "dx.payment.requested": EventEnvelope<PaymentRequested>;
    }>("dx.payments.ex", {
      exchangeType: "topic",
      routingKey: "dx.payment.requested",
      publisherConfirms: true,
    });

  const paymentRequested = event("dx.payment.requested", "v1").of<PaymentRequested>();

  orders.use(async (ctx, next) => {
    console.log("[middleware] before", {
      queue: ctx.queue,
      event: ctx.event.name,
      corrId: ctx.event.meta?.corrId,
      causationId: ctx.event.meta?.causationId,
    });

    await next();

    console.log("[middleware] after", ctx.event.name);
  });

  orders.handle("dx.order.created", async (_id, ev) => {
    console.log("[consumer] order received:", ev.data);

    await payments.produce(
      paymentRequested(
        {
          orderId: ev.data.orderId,
          amount: ev.data.amount,
        },
        traceFrom(ev, {
          headers: {
            source: "dx.consumer",
          },
        })
      )
    );

    console.log("[consumer] emitted dx.payment.requested");
  });

  orders.handle("dx.ping", async (_id, ev): Promise<Pong> => {
    console.log("[consumer] ping received:", ev.data);

    return {
      ok: true,
      message: `pong for ${ev.data.id}`,
    };
  });

  await orders.consume({
    prefetch: 10,
    concurrency: 2,
    dedupe: {
      enabled: true,
      ttlMs: 60_000,
    },
  });

  console.log("[consumer] developer experience consumer listening");

  process.on("SIGTERM", async () => {
    await broker.close();
    process.exit(0);
  });
})();
