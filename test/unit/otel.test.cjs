const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const {
  attachOpenTelemetry,
} = require("../../dist/cjs/index.js");

function makeFakeTracer() {
  const spans = [];
  const tracer = {
    startSpan: (name, opts) => {
      const span = {
        name,
        opts,
        attributes: {},
        events: [],
        status: undefined,
        ended: false,
        setAttribute: (key, value) => { span.attributes[key] = value; },
        setAttributes: (attrs) => { Object.assign(span.attributes, attrs); },
        addEvent: (name, attrs) => { span.events.push({ name, attrs }); },
        recordException: (error) => { span.exception = error; },
        setStatus: (status) => { span.status = status; },
        end: () => { span.ended = true; },
      };
      spans.push(span);
      return span;
    },
  };
  return { tracer, spans };
}

function makeLifecycleSource() {
  const emitter = new EventEmitter();
  return {
    on: (eventName, handler) => {
      emitter.on(eventName, handler);
      return () => emitter.off(eventName, handler);
    },
    emit: (eventName, event) => { emitter.emit(eventName, event); },
  };
}

test("attachOpenTelemetry creates spans for lifecycle events", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer, serviceName: "my-svc" });

  source.emit("reconnect", { peerName: "peer1" });
  source.emit("topology.asserted", { peerName: "peer1", exchange: "ex", queue: "q" });

  assert.equal(spans.length, 2);
  assert.equal(spans[0].name, "rabbit-relay.reconnect");
  assert.equal(spans[1].name, "rabbit-relay.topology.asserted");

  assert.ok(spans[0].ended);
  assert.equal(spans[0].attributes["service.name"], "my-svc");

  handle.detach();
});

test("attachOpenTelemetry creates spans for consumer lifecycle", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });

  source.emit("consumer.started", { peerName: "p", queue: "q", prefetch: 5, concurrency: 2 });
  source.emit("consumer.stopped", { peerName: "p", queue: "q" });

  assert.equal(spans.length, 2);
  assert.equal(spans[0].name, "rabbit-relay.consumer.started");
  assert.equal(spans[0].attributes["rabbit-relay.consumer.prefetch"], 5);
  assert.equal(spans[0].attributes["rabbit-relay.consumer.concurrency"], 2);
  assert.equal(spans[1].name, "rabbit-relay.consumer.stopped");
  assert.equal(spans[1].attributes["messaging.rabbitmq.queue"], "q");

  handle.detach();
});

test("attachOpenTelemetry creates spans for handler lifecycle", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });

  source.emit("handler.completed", { peerName: "p", queue: "q", eventName: "evt", durationMs: 12 });
  source.emit("message.dead-lettered", { peerName: "p", queue: "q", exchange: "dlx", routingKey: "rk", eventName: "evt" });

  assert.equal(spans.length, 2);
  assert.equal(spans[0].name, "rabbit-relay.handler.completed");
  assert.equal(spans[0].attributes["rabbit-relay.handler.duration_ms"], 12);
  assert.equal(spans[1].name, "rabbit-relay.message.dead-lettered");

  handle.detach();
});

test("attachOpenTelemetry marks publish.failed spans as errors", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });

  source.emit("publish.failed", {
    peerName: "p", exchange: "ex", routingKey: "rk", eventName: "evt",
    error: new Error("publish failure"),
  });

  assert.equal(spans.length, 1);
  assert.equal(spans[0].status.code, 2);
  assert.ok(spans[0].exception);
  assert.equal(spans[0].status.message, "publish failure");

  handle.detach();
});

test("attachOpenTelemetry marks retry.scheduled with error", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });

  source.emit("retry.scheduled", {
    peerName: "p", exchange: "ex", queue: "q", routingKey: "rk",
    retryCount: 2, attempts: 3, delayMs: 100,
    error: new Error("handler error"),
  });

  assert.equal(spans.length, 1);
  assert.equal(spans[0].status.code, 1);
  assert.ok(spans[0].exception);
  assert.equal(spans[0].events[0].name, "retry.scheduled");

  handle.detach();
});

test("attachOpenTelemetry uses custom span prefix", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer, spanPrefix: "my-app" });

  source.emit("reconnect", { peerName: "p" });
  assert.equal(spans[0].name, "my-app.reconnect");

  handle.detach();
});

test("attachOpenTelemetry disables specified events", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, {
    tracer,
    disabledEvents: ["reconnect", "broker.closed"],
  });

  source.emit("reconnect", { peerName: "p" });
  source.emit("topology.asserted", { peerName: "p", exchange: "ex", queue: "q" });
  source.emit("broker.closed", { peerName: "p" });

  assert.equal(spans.length, 1);
  assert.equal(spans[0].name, "rabbit-relay.topology.asserted");

  handle.detach();
});

test("attachOpenTelemetry detach stops listening", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });
  handle.detach();

  source.emit("reconnect", { peerName: "p" });
  assert.equal(spans.length, 0);
});

test("attachOpenTelemetry uses custom status codes", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, {
    tracer,
    statusCode: { OK: 0, ERROR: 1 },
  });

  source.emit("handler.completed", { peerName: "p", queue: "q", eventName: "evt", durationMs: 5 });
  source.emit("publish.failed", {
    peerName: "p", exchange: "ex", routingKey: "rk", eventName: "evt",
    error: new Error("fail"),
  });

  assert.equal(spans[0].status.code, 0);
  assert.equal(spans[1].status.code, 1);

  handle.detach();
});

test("attachOpenTelemetry handles broker.closed event", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });
  source.emit("broker.closed", { peerName: "peer1" });

  assert.equal(spans.length, 1);
  assert.equal(spans[0].name, "rabbit-relay.broker.closed");
  assert.equal(spans[0].attributes["rabbit-relay.peer"], "peer1");

  handle.detach();
});

test("attachOpenTelemetry sets messaging.system attribute on all spans", () => {
  const { tracer, spans } = makeFakeTracer();
  const source = makeLifecycleSource();

  const handle = attachOpenTelemetry(source, { tracer });

  source.emit("reconnect", { peerName: "p" });
  source.emit("topology.asserted", { peerName: "p", exchange: "ex", queue: "q" });

  for (const span of spans) {
    assert.equal(span.attributes["messaging.system"], "rabbitmq");
  }

  handle.detach();
});
