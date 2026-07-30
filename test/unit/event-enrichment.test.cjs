const test = require("node:test");
const assert = require("node:assert/strict");

const {
  event,
  eventWithReply,
  withMeta,
  withHeaders,
  withCorrelation,
  withCausation,
  traceFrom,
  expectReply,
  augmentEvents,
  registerEventSchema,
  getEventSchema,
} = require("../../dist/cjs/index.js");

test("event().of() creates an envelope with correct fields", () => {
  const makeEvent = event("test.event", "v1").of();
  const env = makeEvent({ value: 42 });

  assert.equal(env.name, "test.event");
  assert.equal(env.v, "v1");
  assert.equal(env.data.value, 42);
  assert.equal(typeof env.id, "string");
  assert.equal(typeof env.time, "number");
  assert.equal(env.meta, undefined);
});

test("event().of() creates unique IDs for each call", () => {
  const makeEvent = event("unique.test", "v1").of();
  const a = makeEvent({ n: 1 });
  const b = makeEvent({ n: 2 });
  assert.notEqual(a.id, b.id);
});

test("event().schema() creates a factory that validates at produce time", () => {
  const makeEvent = event("schema.test", "v1").schema({
    parse(input) {
      if (typeof input.value !== "number") throw new Error("must be number");
      return { value: input.value };
    },
  });
  const env = makeEvent({ value: 10 });
  assert.equal(env.name, "schema.test");
  assert.equal(env.data.value, 10);
});

test("eventWithReply().of() creates an envelope with expectsReply=true", () => {
  const makeEvent = eventWithReply("rpc.event", "v1").of();
  const env = makeEvent({ query: "hello" });

  assert.equal(env.name, "rpc.event");
  assert.equal(env.meta.expectsReply, true);
});

test("eventWithReply().schema() creates a validated factory with expectsReply=true", () => {
  const makeEvent = eventWithReply("rpc.schema", "v1").schema({
    parse(input) {
      if (typeof input.x !== "number") throw new Error("x must be number");
      return { x: input.x };
    },
  });
  const env = makeEvent({ x: 99 });
  assert.equal(env.meta.expectsReply, true);
  assert.equal(env.data.x, 99);
});

test("eventWithReply respects explicit meta overrides", () => {
  const makeEvent = eventWithReply("rpc.override", "v1").of();
  const env = makeEvent({ ok: true }, { timeoutMs: 5000 });
  assert.equal(env.meta.expectsReply, true);
  assert.equal(env.meta.timeoutMs, 5000);
});

test("expectReply sets expectsReply and timeoutMs", () => {
  const result = expectReply({ corrId: "abc" }, 3000);
  assert.equal(result.expectsReply, true);
  assert.equal(result.timeoutMs, 3000);
  assert.equal(result.corrId, "abc");
});

test("expectReply without meta still sets expectsReply", () => {
  const result = expectReply();
  assert.equal(result.expectsReply, true);
  assert.equal(result.timeoutMs, undefined);
});

test("expectReply without timeoutMs omits timeoutMs", () => {
  const result = expectReply({ corrId: "x" });
  assert.equal(result.expectsReply, true);
  assert.equal(result.timeoutMs, undefined);
  assert.equal(result.corrId, "x");
});

test("withMeta merges metadata into an event envelope", () => {
  const makeEvent = event("meta.test", "v1").of();
  const env = makeEvent({ v: 1 });

  withMeta(env, { corrId: "corr-123", causationId: "cause-456" });
  assert.equal(env.meta.corrId, "corr-123");
  assert.equal(env.meta.causationId, "cause-456");
});

test("withMeta merges headers without losing existing ones", () => {
  const makeEvent = event("meta.headers", "v1").of();
  const env = makeEvent({ v: 1 }, { headers: { existing: "keep" } });

  withMeta(env, { headers: { added: "new" } });
  assert.equal(env.meta.headers.existing, "keep");
  assert.equal(env.meta.headers.added, "new");
});

test("withMeta overrides existing scalar metadata", () => {
  const makeEvent = event("meta.override", "v1").of();
  const env = makeEvent({ v: 1 }, { corrId: "old" });

  withMeta(env, { corrId: "new" });
  assert.equal(env.meta.corrId, "new");
});

test("withHeaders sets headers on an event", () => {
  const makeEvent = event("headers.test", "v1").of();
  const env = makeEvent({ v: 1 });

  withHeaders(env, { "x-trace": "abc" });
  assert.equal(env.meta.headers["x-trace"], "abc");
});

test("withHeaders merges with existing headers", () => {
  const makeEvent = event("headers.merge", "v1").of();
  const env = makeEvent({ v: 1 }, { headers: { a: "1" } });

  withHeaders(env, { b: "2" });
  assert.equal(env.meta.headers.a, "1");
  assert.equal(env.meta.headers.b, "2");
});

test("withCorrelation sets correlation ID", () => {
  const makeEvent = event("corr.test", "v1").of();
  const env = makeEvent({ v: 1 });

  withCorrelation(env, "my-corr-id");
  assert.equal(env.meta.corrId, "my-corr-id");
});

test("withCorrelation overrides existing corrId", () => {
  const makeEvent = event("corr.override", "v1").of();
  const env = makeEvent({ v: 1 }, { corrId: "old" });

  withCorrelation(env, "new-corr");
  assert.equal(env.meta.corrId, "new-corr");
});

test("withCausation sets causation ID", () => {
  const makeEvent = event("causation.test", "v1").of();
  const env = makeEvent({ v: 1 });

  withCausation(env, "cause-789");
  assert.equal(env.meta.causationId, "cause-789");
});

test("withCausation overrides existing causationId", () => {
  const makeEvent = event("causation.override", "v1").of();
  const env = makeEvent({ v: 1 }, { causationId: "old-cause" });

  withCausation(env, "new-cause");
  assert.equal(env.meta.causationId, "new-cause");
});

test("traceFrom uses parent.corrId when available", () => {
  const makeEvent = event("trace.corr", "v1").of();
  const parent = makeEvent({ v: 1 }, { corrId: "parent-corr" });

  const meta = traceFrom(parent);
  assert.equal(meta.corrId, "parent-corr");
  assert.equal(meta.causationId, parent.id);
});

test("traceFrom falls back to parent.id when no parent corrId", () => {
  const makeEvent = event("trace.fallback", "v1").of();
  const parent = makeEvent({ v: 1 });

  const meta = traceFrom(parent);
  assert.equal(meta.corrId, parent.id);
  assert.equal(meta.causationId, parent.id);
});

test("traceFrom copies parent headers", () => {
  const makeEvent = event("trace.headers", "v1").of();
  const parent = makeEvent({ v: 1 }, { headers: { trace: "abc" } });

  const meta = traceFrom(parent);
  assert.equal(meta.headers.trace, "abc");
});

test("traceFrom merges extra headers from meta argument", () => {
  const makeEvent = event("trace.extra", "v1").of();
  const parent = makeEvent({ v: 1 }, { headers: { a: "1" } });

  const meta = traceFrom(parent, { headers: { b: "2" } });
  assert.equal(meta.headers.a, "1");
  assert.equal(meta.headers.b, "2");
});

test("traceFrom allows overriding meta fields", () => {
  const makeEvent = event("trace.override", "v1").of();
  const parent = makeEvent({ v: 1 }, { corrId: "original" });

  const meta = traceFrom(parent, { corrId: "overridden" });
  assert.equal(meta.corrId, "overridden");
});

test("augmentEvents wraps factories to produce via broker", async () => {
  const makeFoo = event("augment.foo", "v1").of();
  const makeBar = event("augment.bar", "v1").of();
  const produced = [];

  const broker = {
    produce: async (...events) => {
      produced.push(...events);
    },
  };

  const augmented = augmentEvents({ foo: makeFoo, bar: makeBar }, broker);

  assert.equal(typeof augmented.foo, "function");
  assert.equal(typeof augmented.bar, "function");

  await augmented.foo({ v: 1 });
  await augmented.bar({ v: 2 });

  assert.equal(produced.length, 2);
  assert.equal(produced[0].name, "augment.foo");
  assert.equal(produced[0].data.v, 1);
  assert.equal(produced[1].name, "augment.bar");
  assert.equal(produced[1].data.v, 2);
});

test("augmentEvents preserves original factories and broker", () => {
  const makeEvent = event("augment.preserve", "v1").of();
  const broker = { produce: async () => {} };

  const augmented = augmentEvents({ evt: makeEvent }, broker);
  assert.equal(typeof augmented.evt, "function");
  assert.equal(typeof augmented.produce, "function");
});

test("registerEventSchema and getEventSchema round-trip", () => {
  const schema = {
    parse(input) {
      if (typeof input.x !== "number") throw new Error("x must be number");
      return { x: input.x };
    },
  };

  registerEventSchema("schema.roundtrip", schema);
  const retrieved = getEventSchema("schema.roundtrip");
  assert.equal(retrieved, schema);
});

test("getEventSchema returns undefined for unknown event", () => {
  const retrieved = getEventSchema("nonexistent.event");
  assert.equal(retrieved, undefined);
});
