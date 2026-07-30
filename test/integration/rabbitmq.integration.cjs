const test = require("node:test");
const assert = require("node:assert/strict");

process.env.RABBITMQ_URL ??= "amqp://user:password@localhost:5672";

const {
  RabbitMQBroker,
  event,
} = require("../../dist/cjs/index.js");

const timeoutMs = 15_000;

function unique(prefix) {
  return `rabbit-relay.it.${prefix}.${process.pid}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitFor(check, message, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

test("publishes and consumes a typed event with confirms", { timeout: timeoutMs }, async () => {
  const id = unique("basic");
  const eventName = `${id}.created`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: `${id}.#`,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_deliveryTag, envelope) => {
      received.resolve(envelope);
    });

    await relay.consume({ prefetch: 2, concurrency: 1 });
    await relay.produce(makeEvent({ value: 42 }));

    const envelope = await received.promise;
    assert.equal(envelope.data.value, 42);
  } finally {
    await broker.close();
  }
});

test("retries, dead-letters, dry-runs, and redrives safely", { timeout: timeoutMs }, async () => {
  const id = unique("retry");
  const eventName = `${id}.failed`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: `${id}.#`,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async () => {
      throw new Error("intentional integration failure");
    });

    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "retry",
      retry: { attempts: 1, delayMs: 100, then: "dead-letter" },
    });

    await relay.produce(makeEvent({ value: "poison" }));

    await waitFor(
      () => broker.withChannel(async (channel) => {
        const info = await channel.checkQueue(`${id}.dlq`);
        return info.messageCount === 1;
      }),
      "message did not reach the DLQ"
    );

    await consumer.stop();

    const dryRun = await broker.redriveDlq({
      fromQueue: `${id}.dlq`,
      toExchange: `${id}.ex`,
      routingKey: eventName,
      limit: 1,
      dryRun: true,
    });
    assert.equal(dryRun.available, 1);
    assert.equal(dryRun.attempted, 0);

    const redrive = await broker.redriveDlq({
      fromQueue: `${id}.dlq`,
      toExchange: `${id}.ex`,
      routingKey: eventName,
      limit: 1,
    });
    assert.equal(redrive.republished, 1);
    assert.equal(redrive.acked, 1);
  } finally {
    await broker.close();
  }
});

test("supports request and reply with timeout configuration", { timeout: timeoutMs }, async () => {
  const id = unique("rpc");
  const eventName = `${id}.request`;
  const makeRequest = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_deliveryTag, envelope) => ({
      doubled: envelope.data.value * 2,
    }));
    await relay.consume({ prefetch: 1, concurrency: 1 });

    const reply = await relay.request(makeRequest({ value: 21 }), {
      timeoutMs: 3_000,
    });
    assert.deepEqual(reply, { doubled: 42 });
  } finally {
    await broker.close();
  }
});

test("reconnects after its AMQP channel closes", { timeout: timeoutMs }, async () => {
  const id = unique("reconnect");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        routingKey: eventName,
        publisherConfirms: true,
      });
    relay.handle(eventName, async (_deliveryTag, envelope) => {
      received.resolve(envelope.data.value);
    });
    await relay.consume({ prefetch: 1, concurrency: 1 });

    await relay.withChannel((channel) => channel.close());

    await waitFor(async () => {
      const health = await broker.health();
      return !health.reconnecting && health.channelOpen;
    }, "broker did not reconnect");

    await relay.produce(makeEvent({ value: "after-reconnect" }));
    assert.equal(await received.promise, "after-reconnect");
  } finally {
    await broker.close();
  }
});

test("closing one broker does not break another broker", { timeout: timeoutMs }, async () => {
  const id = unique("isolation");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const first = new RabbitMQBroker(`${id}.first`);
  const second = new RabbitMQBroker(`${id}.second`);
  let secondReconnects = 0;
  second.on("reconnect", () => {
    secondReconnects++;
  });

  try {
    await first
      .queue(`${id}.first.q`)
      .exchange(`${id}.first.ex`, { routingKey: `${id}.first` });

    const relay = await second
      .queue(`${id}.second.q`)
      .exchange(`${id}.second.ex`, {
        routingKey: eventName,
        publisherConfirms: true,
      });
    relay.handle(eventName, async () => received.resolve(true));
    await relay.consume({ prefetch: 1, concurrency: 1 });

    await first.close();
    assert.equal(secondReconnects, 0);
    assert.equal((await second.health()).connected, true);
    await relay.produce(makeEvent({ ok: true }));
    assert.equal(await received.promise, true);
    assert.equal(secondReconnects, 0);
  } finally {
    await first.close().catch(() => undefined);
    await second.close();
  }
});

test("preserves AMQP_CONN_NAME unless an explicit name overrides it", async () => {
  const previous = process.env.AMQP_CONN_NAME;
  process.env.AMQP_CONN_NAME = "rabbit-relay-env-name";

  const fromEnvironment = new RabbitMQBroker(unique("env-name"), {
    topologyMode: "plan-only",
  });
  const explicit = new RabbitMQBroker(unique("explicit-name"), {
    topologyMode: "plan-only",
    connectionName: "rabbit-relay-explicit-name",
  });

  try {
    assert.equal(fromEnvironment.connection.connectionName, "rabbit-relay-env-name");
    assert.equal(explicit.connection.connectionName, "rabbit-relay-explicit-name");
  } finally {
    await fromEnvironment.close();
    await explicit.close();

    if (previous === undefined) delete process.env.AMQP_CONN_NAME;
    else process.env.AMQP_CONN_NAME = previous;
  }
});

test("close waits for an active handler to drain", { timeout: timeoutMs }, async () => {
  const id = unique("drain");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const started = deferred();
  const release = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, { routingKey: eventName, publisherConfirms: true });
    relay.handle(eventName, async () => {
      started.resolve();
      await release.promise;
    });
    await relay.consume({ prefetch: 1, concurrency: 1 });
    await relay.produce(makeEvent({ ok: true }));
    await started.promise;

    let firstClosed = false;
    let secondClosed = false;
    const firstClose = broker.close();
    const secondClose = broker.close();

    assert.equal(firstClose, secondClose, "concurrent close calls must share one promise");

    void firstClose.then(() => {
      firstClosed = true;
    });
    void secondClose.then(() => {
      secondClosed = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(firstClosed, false, "first close returned before the active handler completed");
    assert.equal(secondClosed, false, "second close returned before the active handler completed");
    release.resolve();
    await Promise.all([firstClose, secondClose]);
  } finally {
    release.resolve();
    await broker.close().catch(() => undefined);
  }
});

test("close respects shutdownTimeoutMs when a handler does not drain", { timeout: timeoutMs }, async () => {
  const id = unique("drain-timeout");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const started = deferred();
  const release = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`, { shutdownTimeoutMs: 100 });

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, { routingKey: eventName, publisherConfirms: true });
    relay.handle(eventName, async () => {
      started.resolve();
      await release.promise;
    });
    await relay.consume({ prefetch: 1, concurrency: 1 });
    await relay.produce(makeEvent({ ok: true }));
    await started.promise;

    const start = Date.now();
    await broker.close();
    const elapsed = Date.now() - start;

    assert.ok(elapsed >= 80, `close returned too early after ${elapsed}ms`);
    assert.ok(elapsed < 1_000, `close exceeded its bounded timeout: ${elapsed}ms`);
  } finally {
    release.resolve();
    await broker.close().catch(() => undefined);
  }
});

test("validation reports every missing topology resource", { timeout: timeoutMs }, async () => {
  const id = unique("validation");
  const broker = new RabbitMQBroker(`${id}.broker`, {
    topologyMode: "plan-only",
  });

  try {
    const relay = await broker
      .queue(`${id}.missing.q`)
      .exchange(`${id}.missing.ex`, {
        routingKey: `${id}.#`,
      });

    const result = await relay.validateTopology();
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.type === "missing_exchange"));
    assert.ok(result.issues.some((issue) => issue.type === "missing_queue"));
  } finally {
    await broker.close();
  }
});

test("passive startup reports every missing resource without poisoning the broker channel", { timeout: timeoutMs }, async () => {
  const id = unique("passive-validation");
  const broker = new RabbitMQBroker(`${id}.broker`, {
    topologyMode: "passive",
  });

  try {
    await assert.rejects(
      broker
        .queue(`${id}.missing.q`)
        .exchange(`${id}.missing.ex`, { routingKey: `${id}.#` }),
      (error) => {
        assert.match(error.message, /missing_exchange/);
        assert.match(error.message, /missing_queue/);
        return true;
      }
    );

    await broker.withChannel(async (channel) => {
      const probeQueue = `${id}.probe.q`;
      await channel.assertQueue(probeQueue, { durable: false, autoDelete: true });
      await channel.deleteQueue(probeQueue);
    });

    assert.equal((await broker.health()).reconnecting, false);
  } finally {
    await broker.close();
  }
});

test("message size guard rejects oversized payloads at the exchange level", { timeout: timeoutMs }, async () => {
  const id = unique("size-guard");
  const eventName = `${id}.big`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const pub = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        maxMessageBytes: 256,
      });

    // Small message within limit
    await pub.produce(makeEvent({ data: "x".repeat(50) }));

    // Large message exceeding limit
    await assert.rejects(
      () => pub.produce(makeEvent({ data: "x".repeat(2000) })),
      (error) => {
        assert.match(error.message, /max allowed is/);
        return true;
      }
    );
  } finally {
    await broker.close();
  }
});

test("concurrent rpc requests all get correct replies", { timeout: timeoutMs }, async () => {
  const id = unique("concurrent-rpc");
  const eventName = `${id}.request`;
  const makeRequest = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    let counter = 0;
    relay.handle(eventName, async (_deliveryTag, envelope) => {
      counter++;
      return { n: envelope.data.n, sq: counter };
    });
    await relay.consume({ prefetch: 10, concurrency: 10 });

    // Fire 5 RPCs in parallel
    const results = await Promise.all(
      [10, 20, 30, 40, 50].map((n) =>
        relay.request(makeRequest({ n }), { timeoutMs: 5_000 })
      )
    );

    assert.equal(results.length, 5);
    const ns = results.map((r) => r.n).sort((a, b) => a - b);
    assert.deepEqual(ns, [10, 20, 30, 40, 50]);
  } finally {
    await broker.close();
  }
});

test("multiple event types on one queue route to correct handlers", { timeout: timeoutMs }, async () => {
  const id = unique("multi-event");
  const eventA = `${id}.a`;
  const eventB = `${id}.b`;
  const makeA = event(eventA, "v1").of();
  const makeB = event(eventB, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const received = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: `${id}.*`,
      });

    relay.handle(eventA, async (_dt, ev) => { received.push(`A:${ev.data.v}`); });
    relay.handle(eventB, async (_dt, ev) => { received.push(`B:${ev.data.v}`); });
    await relay.consume({ prefetch: 10, concurrency: 1 });

    await relay.produce(makeA({ v: 1 }));
    await relay.produce(makeB({ v: 2 }));
    await relay.produce(makeA({ v: 3 }));

    await waitFor(() => received.length === 3, "not all events processed");
    assert.deepEqual(received, ["A:1", "B:2", "A:3"]);
  } finally {
    await broker.close();
  }
});

test("recovers from connection drop during active consumption", { timeout: timeoutMs }, async () => {
  const id = unique("conn-drop");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const received = [];
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        routingKey: eventName,
        publisherConfirms: true,
      });
    relay.handle(eventName, async (_dt, ev) => {
      received.push(ev.data.v);
    });
    await relay.consume({ prefetch: 1, concurrency: 1 });

    await relay.produce(makeEvent({ v: "before" }));
    await waitFor(() => received.length === 1, "first message not received");

    // Force-close the underlying TCP connection by closing all channels
    await broker.withChannel((ch) =>
      new Promise((resolve, reject) => {
        ch.on("close", resolve);
        ch.connection.close();
      })
    );

    // Wait for connection-level recovery AND consumer re-registration
    await waitFor(
      () => broker.health().then((h) =>
        !h.reconnecting &&
        h.connected &&
        h.consumers.length > 0 &&
        h.consumers[0].active
      ),
      "consumer did not resume after connection drop",
      12_000
    );

    received.length = 0;
    await relay.produce(makeEvent({ v: "after-reconnect" }));
    await waitFor(() => received.length === 1, "message after reconnect not received");
    assert.equal(received[0], "after-reconnect");
  } finally {
    await broker.close();
  }
});

test("survives multiple rapid connection interruptions", { timeout: timeoutMs }, async () => {
  const id = unique("rapid");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  let received = 0;
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        routingKey: eventName,
        publisherConfirms: true,
      });
    relay.handle(eventName, async () => { received++; });
    await relay.consume({ prefetch: 1, concurrency: 1 });

    // Interrupt the connection 3 times in quick succession
    for (let i = 0; i < 3; i++) {
      await broker.withChannel((ch) =>
        new Promise((resolve, reject) => {
          ch.on("close", resolve);
          ch.connection.close();
        })
      );

      await waitFor(
        () => broker.health().then((h) =>
          !h.reconnecting &&
          h.connected &&
          h.consumers.length > 0 &&
          h.consumers[0].active
        ),
        `broker did not reconnect after interruption #${i + 1}`,
        12_000
      );
    }

    received = 0;
    await relay.produce(makeEvent({ v: "after-rapid" }));
    await waitFor(() => received === 1, "message after rapid reconnects not received");
  } finally {
    await broker.close();
  }
});

test("schema validation dead-letters invalid payload", { timeout: timeoutMs }, async () => {
  const id = unique("schema-dlq");
  const eventName = `${id}.validated`;
  const broker = new RabbitMQBroker(`${id}.broker`);

  // Register a schema for this event by creating a factory with .schema()
  const makeValid = event(eventName, "v1").schema({
    parse(input) {
      if (typeof input !== "object" || input === null) {
        throw new Error("payload must be an object");
      }
      if (typeof input.value !== "number") {
        throw new Error("value must be a number");
      }
      return { value: input.value };
    },
  });

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async (_dt, ev) => {
      throw new Error("handler should never be called for invalid payload");
    });

    await relay.consume({
      prefetch: 1,
      concurrency: 1,
      invalidMessage: "dead-letter",
      onError: "dead-letter",
    });

    // Publish a valid message — handler should process it (but it throws, hence DLQ)
    await relay.produce(makeValid({ value: 42 }));

    // Publish an INVALID message — schema validation should send it to DLQ
    // We need to publish raw because the factory types it correctly
    const EnvelopeFactory = event(eventName, "v1").of();
    const rawEvent = EnvelopeFactory({ value: "not-a-number" }); // invalid — value must be number
    // Use publish() to avoid schema check on produce side (schemas are consume-side only)
    await relay.publish(rawEvent);

    // Wait for 2 messages in DLQ
    await waitFor(
      () => broker.withChannel(async (channel) => {
        const info = await channel.checkQueue(`${id}.dlq`);
        return info.messageCount >= 2;
      }),
      "expected 2 messages in DLQ (handler error + schema rejection)"
    );
  } finally {
    await broker.close();
  }
});

test("direct exchange type routes by exact routing key", { timeout: timeoutMs }, async () => {
  const id = unique("direct");
  const eventName = `${id}.direct`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "direct",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, envelope) => {
      received.resolve(envelope.data.v);
    });

    await relay.consume({ prefetch: 1, concurrency: 1 });
    await relay.produce(makeEvent({ v: "direct-works" }));

    assert.equal(await received.promise, "direct-works");
  } finally {
    await broker.close();
  }
});

test("fanout exchange delivers to all bound queues", { timeout: timeoutMs }, async () => {
  const id = unique("fanout");
  const eventName = `${id}.broadcast`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const receivedA = deferred();
  const receivedB = deferred();

  try {
    const relayA = await broker
      .queue(`${id}.a.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "fanout",
        publisherConfirms: true,
      });

    const relayB = await broker
      .queue(`${id}.b.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "fanout",
      });

    relayA.handle(eventName, async (_dt, ev) => receivedA.resolve(ev.data.v));
    relayB.handle(eventName, async (_dt, ev) => receivedB.resolve(ev.data.v));

    await relayA.consume({ prefetch: 1, concurrency: 1 });
    await relayB.consume({ prefetch: 1, concurrency: 1 });

    // Use first subscriber to publish
    await relayA.produce(makeEvent({ v: "fanout-ok" }));

    assert.equal(await receivedA.promise, "fanout-ok");
    assert.equal(await receivedB.promise, "fanout-ok");
  } finally {
    await broker.close();
  }
});

test("middleware can transform event data before handler", { timeout: timeoutMs }, async () => {
  const id = unique("middleware");
  const eventName = `${id}.transform`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.use((ctx, next) => {
      ctx.event.data = { original: ctx.event.data, doubled: ctx.event.data.v * 2 };
      return next();
    });

    relay.handle(eventName, async (_dt, envelope) => {
      received.resolve(envelope.data);
    });

    await relay.consume({ prefetch: 1, concurrency: 1 });
    await relay.produce(makeEvent({ v: 7 }));

    const data = await received.promise;
    assert.equal(data.original.v, 7);
    assert.equal(data.doubled, 14);
  } finally {
    await broker.close();
  }
});

test("middleware can reject a message before handler", { timeout: timeoutMs }, async () => {
  const id = unique("mw-reject");
  const eventName = `${id}.reject`;
  const makeEvent = event(eventName, "v1").of();
  let handlerInvoked = false;
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.use((_ctx, _next) => {
      throw new Error("middleware rejection");
    });

    relay.handle(eventName, async () => {
      handlerInvoked = true;
    });

    await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "dead-letter",
    });

    await relay.produce(makeEvent({ v: 1 }));

    await waitFor(
      () => broker.withChannel(async (channel) => {
        const info = await channel.checkQueue(`${id}.dlq`);
        return info.messageCount === 1;
      }),
      "middleware-rejected message did not reach the DLQ"
    );

    assert.equal(handlerInvoked, false, "handler should not be called when middleware rejects");
  } finally {
    await broker.close();
  }
});

test("wildcard handler catches events not explicitly handled", { timeout: timeoutMs }, async () => {
  const id = unique("wildcard");
  const eventA = `${id}.alpha`;
  const eventB = `${id}.beta`;
  const makeA = event(eventA, "v1").of();
  const makeB = event(eventB, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const received = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: `${id}.*`,
      });

    // Only register wildcard handler
    relay.handle("*", async (_dt, ev) => { received.push(`${ev.name}:${ev.data.v}`); });
    await relay.consume({ prefetch: 10, concurrency: 1 });

    await relay.produce(makeA({ v: 1 }));
    await relay.produce(makeB({ v: 2 }));

    await waitFor(() => received.length === 2, "wildcard handler did not receive both events");
    assert.deepEqual(received.sort(), [`${eventA}:1`, `${eventB}:2`].sort());
  } finally {
    await broker.close();
  }
});

test("onError requeue returns message to the queue", { timeout: timeoutMs }, async () => {
  const id = unique("requeue");
  const eventName = `${id}.fail`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  let deliveryCount = 0;

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, _ev) => {
      deliveryCount++;
      throw new Error(`attempt ${deliveryCount}`);
    });

    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "requeue",
    });

    await relay.produce(makeEvent({ v: 1 }));

    // Wait long enough for at least one requeue cycle
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.stop();

    // Message was requeued so it should still be in the queue
    const info = await broker.withChannel((ch) => ch.checkQueue(`${id}.q`));
    assert.equal(info.messageCount, 1, "requeued message should remain in queue");
    assert.ok(deliveryCount >= 1, "handler should have been called at least once");
  } finally {
    await broker.close();
  }
});

test("immediate retry without delayMs still retries then dead-letters", { timeout: timeoutMs }, async () => {
  const id = unique("immediate-retry");
  const eventName = `${id}.fail`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const attempts = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async () => {
      attempts.push("tried");
      throw new Error("immediate retry failure");
    });

    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "retry",
      retry: { attempts: 1, then: "dead-letter" },
    });

    await relay.produce(makeEvent({ v: 1 }));

    await waitFor(
      () => broker.withChannel(async (channel) => {
        const info = await channel.checkQueue(`${id}.dlq`);
        return info.messageCount === 1;
      }),
      "immediate-retry message did not reach the DLQ"
    );

    await consumer.stop();
    assert.equal(attempts.length, 2, "expected 2 attempts (initial + 1 immediate retry)");
  } finally {
    await broker.close();
  }
});

test("invalidMessage function callback handles schema failures", { timeout: timeoutMs }, async () => {
  const id = unique("invalid-fn");
  const eventName = `${id}.validated`;
  const broker = new RabbitMQBroker(`${id}.broker`);
  const invalidHandled = deferred();

  const makeValid = event(eventName, "v1").schema({
    parse(input) {
      if (typeof input !== "object" || input === null) {
        throw new Error("payload must be an object");
      }
      if (typeof input.value !== "number") {
        throw new Error("value must be a number");
      }
      return { value: input.value };
    },
  });

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async () => {
      throw new Error("should never be called for invalid payload");
    });

    await relay.consume({
      prefetch: 1,
      concurrency: 1,
      invalidMessage: (ctx) => {
        invalidHandled.resolve(ctx.error.message);
      },
      onError: "dead-letter",
    });

    // Publish an invalid payload directly (bypass produce-side schema)
    const raw = event(eventName, "v1").of();
    await relay.publish(raw({ value: "not-a-number" }));

    const msg = await invalidHandled.promise;
    assert.match(msg, /value must be a number/);
  } finally {
    await broker.close();
  }
});

test("produceMany publishes all events", { timeout: timeoutMs }, async () => {
  const id = unique("batch");
  const eventName = `${id}.batch`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const received = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, ev) => { received.push(ev.data.v); });
    await relay.consume({ prefetch: 10, concurrency: 1 });

    await relay.produceMany(
      makeEvent({ v: 1 }),
      makeEvent({ v: 2 }),
      makeEvent({ v: 3 })
    );

    await waitFor(() => received.length === 3, "produceMany did not deliver all events");
    assert.deepEqual(received, [1, 2, 3]);
  } finally {
    await broker.close();
  }
});

test("publish with per-message routingKey override", { timeout: timeoutMs }, async () => {
  const id = unique("publish-opts");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const received = deferred();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    // Exchange has a binding key that would NOT match the event name
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: `${id}.custom`,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, ev) => { received.resolve(ev.data.v); });
    await relay.consume({ prefetch: 1, concurrency: 1 });

    // Without override this would publish to `${id}.event` which doesn't match `${id}.custom`
    await relay.publish(makeEvent({ v: "custom-rk" }), { routingKey: `${id}.custom` });

    assert.equal(await received.promise, "custom-rk");
  } finally {
    await broker.close();
  }
});

test("publish with per-message maxMessageBytes override", { timeout: timeoutMs }, async () => {
  const id = unique("msgbytes");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        // No maxMessageBytes at exchange level
      });

    // Large payload succeeds with generous per-publish limit
    await relay.publish(makeEvent({ data: "x".repeat(5000) }), { maxMessageBytes: 10_000 });

    // Same payload fails with strict per-publish limit
    await assert.rejects(
      () => relay.publish(makeEvent({ data: "x".repeat(5000) }), { maxMessageBytes: 100 }),
      (error) => {
        assert.match(error.message, /max allowed is/);
        return true;
      }
    );
  } finally {
    await broker.close();
  }
});

test("topologyMode passive succeeds when resources already exist", { timeout: timeoutMs }, async () => {
  const id = unique("passive-happy");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const setupBroker = new RabbitMQBroker(`${id}.setup`);

  try {
    // First create the resources normally
    const setupRelay = await setupBroker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });
    await setupRelay.consume({ prefetch: 1, concurrency: 1 });
    await setupBroker.close();

    // Now connect in passive mode — should succeed since resources exist
    const passiveBroker = new RabbitMQBroker(`${id}.passive`, {
      topologyMode: "passive",
    });

    try {
      const passiveRelay = await passiveBroker
        .queue(`${id}.q`)
        .exchange(`${id}.ex`, {
          exchangeType: "topic",
          routingKey: eventName,
          publisherConfirms: true,
        });

      const received = deferred();
      passiveRelay.handle(eventName, async (_dt, ev) => { received.resolve(ev.data.v); });
      await passiveRelay.consume({ prefetch: 1, concurrency: 1 });

      await passiveRelay.produce(makeEvent({ v: "passive-works" }));
      assert.equal(await received.promise, "passive-works");
    } finally {
      await passiveBroker.close();
    }
  } finally {
    await setupBroker.close().catch(() => undefined);
  }
});

test("consume rejects invalid concurrency", { timeout: timeoutMs }, async () => {
  const id = unique("bad-concurrency");
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, { routingKey: `${id}.#` });

    await assert.rejects(
      () => relay.consume({ concurrency: 0 }),
      /concurrency must be greater than 0/
    );
  } finally {
    await broker.close();
  }
});

test("consume rejects invalid prefetch", { timeout: timeoutMs }, async () => {
  const id = unique("bad-prefetch");
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, { routingKey: `${id}.#` });

    await assert.rejects(
      () => relay.consume({ prefetch: 0, concurrency: 1 }),
      /prefetch must be greater than 0/
    );
  } finally {
    await broker.close();
  }
});

test("consume rejects retry attempts <= 0 when onError is retry", { timeout: timeoutMs }, async () => {
  const id = unique("bad-retry");
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, { routingKey: `${id}.#` });

    await assert.rejects(
      () => relay.consume({ onError: "retry", retry: { attempts: 0, then: "dead-letter" } }),
      /retry\.attempts must be greater than 0/
    );
  } finally {
    await broker.close();
  }
});

test("dedupe skips duplicate messages", { timeout: timeoutMs }, async () => {
  const id = unique("dedupe");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const received = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, ev) => { received.push(ev.data.v); });

    // Enable dedupe with a TTL long enough to cover both publishes
    await relay.consume({
      prefetch: 1,
      concurrency: 1,
      dedupe: { ttlMs: 30_000, enabled: true },
    });

    // Publish two messages with the same ID
    const evt = makeEvent({ v: 42 });
    await relay.produce(evt);
    await relay.produce({ ...evt, id: evt.id, time: Date.now() });

    await waitFor(() => received.length === 1, "duplicate was not deduplicated");
    assert.equal(received.length, 1);
    assert.equal(received[0], 42);
  } finally {
    await broker.close();
  }
});

test("lifecycle consumer.started and consumer.stopped events fire", { timeout: timeoutMs }, async () => {
  const id = unique("lc-consume");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const events = [];

  try {
    broker.on("consumer.started", (ev) => {
      events.push({ type: "consumer.started", queue: ev.queue, prefetch: ev.prefetch, concurrency: ev.concurrency });
    });
    broker.on("consumer.stopped", (ev) => {
      events.push({ type: "consumer.stopped", queue: ev.queue });
    });

    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async (_dt, ev) => { /* noop */ });
    const consumer = await relay.consume({ prefetch: 2, concurrency: 2 });
    await consumer.stop();

    assert.equal(events.length, 2);
    assert.equal(events[0].type, "consumer.started");
    assert.equal(events[0].queue, `${id}.q`);
    assert.equal(events[0].prefetch, 2);
    assert.equal(events[0].concurrency, 2);
    assert.equal(events[1].type, "consumer.stopped");
    assert.equal(events[1].queue, `${id}.q`);
  } finally {
    await broker.close();
  }
});

test("lifecycle handler.completed event fires on success and error", { timeout: timeoutMs }, async () => {
  const id = unique("lc-handler");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const completed = [];

  try {
    broker.on("handler.completed", (ev) => {
      completed.push({ eventName: ev.eventName, durationMs: ev.durationMs, error: ev.error ? true : false });
    });

    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    let callCount = 0;
    relay.handle(eventName, async () => {
      callCount++;
      if (callCount === 2) throw new Error("fail on purpose");
    });

    await relay.consume({ prefetch: 10, concurrency: 1 });
    await relay.produce(makeEvent({ v: 1 }));
    await relay.produce(makeEvent({ v: 2 }));

    await waitFor(() => completed.length === 2, "handler.completed did not fire twice");
    assert.equal(completed.length, 2);
    assert.equal(completed[0].error, false, "first handler should succeed");
    assert.equal(completed[1].error, true, "second handler should error");
    assert.ok(completed[0].durationMs >= 0, "duration should be non-negative");
  } finally {
    await broker.close();
  }
});

test("lifecycle retry.scheduled fires with correct count", { timeout: timeoutMs }, async () => {
  const id = unique("lc-retry");
  const eventName = `${id}.event`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const retries = [];

  try {
    broker.on("retry.scheduled", (ev) => {
      retries.push({ retryCount: ev.retryCount, attempts: ev.attempts });
    });

    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async () => { throw new Error("retry me"); });
    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "retry",
      retry: { attempts: 2, delayMs: 50, then: "dead-letter" },
    });

    await relay.produce(makeEvent({ v: 1 }));

    // Wait for 2 retry events + final dead-letter
    await waitFor(
      () => broker.withChannel(async (ch) => {
        const info = await ch.checkQueue(`${id}.dlq`);
        return info.messageCount === 1;
      }),
      "message did not reach DLQ after retries"
    );

    await consumer.stop();

    assert.equal(retries.length, 2, "expected 2 retry.scheduled events");
    assert.equal(retries[0].retryCount, 1);
    assert.equal(retries[1].retryCount, 2);
    assert.equal(retries[0].attempts, 2);
  } finally {
    await broker.close();
  }
});

test("lifecycle message.dead-lettered fires with reason", { timeout: timeoutMs }, async () => {
  const id = unique("lc-dlq");
  const eventName = `${id}.dlq`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const dlqEvents = [];

  try {
    broker.on("message.dead-lettered", (ev) => {
      dlqEvents.push({ reason: typeof ev.reason === "string" ? ev.reason : "Error" });
    });

    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async () => { throw new Error("dead-letter reason"); });
    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "dead-letter",
    });

    await relay.produce(makeEvent({ v: 1 }));

    await waitFor(() => dlqEvents.length === 1, "message.dead-lettered did not fire");
    await consumer.stop();

    assert.equal(dlqEvents.length, 1);
    assert.equal(dlqEvents[0].reason, "Error");
  } finally {
    await broker.close();
  }
});

test("onError ack silently consumes on handler error", { timeout: timeoutMs }, async () => {
  const id = unique("onerror-ack");
  const eventName = `${id}.fail`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async () => { throw new Error("silently acked"); });

    await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "ack",
    });

    await relay.produce(makeEvent({ v: 1 }));

    // Give it time to be consumed and acked
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Queue should be empty — message was acked despite the error
    const info = await broker.withChannel((ch) => ch.checkQueue(`${id}.q`));
    assert.equal(info.messageCount, 0);
  } finally {
    await broker.close();
  }
});

test("requeueOnError legacy option requeues on handler error", { timeout: timeoutMs }, async () => {
  const id = unique("legacy-req");
  const eventName = `${id}.fail`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
      });

    relay.handle(eventName, async () => { throw new Error("requeue me (legacy)"); });
    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      requeueOnError: true,
    });

    await relay.produce(makeEvent({ v: 1 }));

    await new Promise((resolve) => setTimeout(resolve, 300));
    await consumer.stop();

    // Message requeued — still in queue
    const info = await broker.withChannel((ch) => ch.checkQueue(`${id}.q`));
    assert.equal(info.messageCount, 1);
  } finally {
    await broker.close();
  }
});

test("multiple exchanges on one broker operate independently", { timeout: timeoutMs }, async () => {
  const id = unique("multi-ex");
  const eventA = `${id}.a`;
  const eventB = `${id}.b`;
  const makeA = event(eventA, "v1").of();
  const makeB = event(eventB, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const received = [];

  try {
    const relayA = await broker
      .queue(`${id}.a.q`)
      .exchange(`${id}.a.ex`, {
        exchangeType: "topic",
        routingKey: eventA,
        publisherConfirms: true,
      });

    const relayB = await broker
      .queue(`${id}.b.q`)
      .exchange(`${id}.b.ex`, {
        exchangeType: "topic",
        routingKey: eventB,
        publisherConfirms: true,
      });

    relayA.handle(eventA, async (_dt, ev) => { received.push({ relay: "A", v: ev.data.v }); });
    relayB.handle(eventB, async (_dt, ev) => { received.push({ relay: "B", v: ev.data.v }); });

    await relayA.consume({ prefetch: 10, concurrency: 1 });
    await relayB.consume({ prefetch: 10, concurrency: 1 });

    await relayA.produce(makeA({ v: 1 }));
    await relayA.produce(makeA({ v: 2 }));
    await relayB.produce(makeB({ v: 3 }));

    await waitFor(() => received.length === 3, "multi-exchange events not all received");

    assert.equal(received[0].relay, "A");
    assert.equal(received[1].relay, "A");
    assert.equal(received[2].relay, "B");
    assert.deepEqual(received.map((r) => r.v).sort(), [1, 2, 3]);
  } finally {
    await broker.close();
  }
});

test("handler that throws a non-error value still retries and dead-letters", { timeout: timeoutMs }, async () => {
  const id = unique("non-error-throw");
  const eventName = `${id}.fail`;
  const makeEvent = event(eventName, "v1").of();
  const broker = new RabbitMQBroker(`${id}.broker`);
  const attempts = [];

  try {
    const relay = await broker
      .queue(`${id}.q`)
      .exchange(`${id}.ex`, {
        exchangeType: "topic",
        routingKey: eventName,
        publisherConfirms: true,
        deadLetter: {
          exchange: `${id}.dlx`,
          queue: `${id}.dlq`,
          routingKey: `${id}.dead`,
          autoDeclare: true,
        },
      });

    relay.handle(eventName, async () => {
      attempts.push("tried");
      throw "string error, not an Error object";
    });
    const consumer = await relay.consume({
      prefetch: 1,
      concurrency: 1,
      onError: "retry",
      retry: { attempts: 1, delayMs: 200, then: "dead-letter" },
    });

    await relay.produce(makeEvent({ v: 1 }));

    await waitFor(
      () => broker.withChannel(async (channel) => {
        const info = await channel.checkQueue(`${id}.dlq`);
        return info.messageCount === 1;
      }),
      "message did not reach the DLQ"
    );

    await consumer.stop();

    assert.equal(attempts.length, 2, "expected 2 attempts (initial + 1 retry)");
  } finally {
    await broker.close();
  }
});
