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
