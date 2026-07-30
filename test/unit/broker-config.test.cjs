const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RabbitMQBroker,
} = require("../../dist/cjs/index.js");

test("broker rejects invalid topologyMode string", () => {
  assert.throws(
    () => new RabbitMQBroker("test", { topologyMode: "invalid" }),
    /invalid topologyMode/
  );
});

test("broker rejects topologyMode as number", () => {
  assert.throws(
    () => new RabbitMQBroker("test", { topologyMode: 123 }),
    /invalid topologyMode/
  );
});

test("broker rejects topologyMode as empty string", () => {
  assert.throws(
    () => new RabbitMQBroker("test", { topologyMode: "" }),
    /invalid topologyMode/
  );
});

test("broker accepts undefined topologyMode (defaults to assert)", () => {
  const broker = new RabbitMQBroker("no-mode");
  assert.ok(broker);
  return broker.close();
});

test("broker rejects negative shutdownTimeoutMs", () => {
  assert.throws(
    () => new RabbitMQBroker("bad-timeout", { shutdownTimeoutMs: -100 }),
    /shutdownTimeoutMs/
  );
});

test("broker rejects NaN shutdownTimeoutMs", () => {
  assert.throws(
    () => new RabbitMQBroker("nan-timeout", { shutdownTimeoutMs: NaN }),
    /shutdownTimeoutMs/
  );
});

test("broker accepts shutdownTimeoutMs of 0 (no timeout)", () => {
  const broker = new RabbitMQBroker("zero-timeout", { topologyMode: "plan-only", shutdownTimeoutMs: 0 });
  assert.ok(broker);
  return broker.close();
});

test("broker accepts valid maxMessageBytes", () => {
  const broker = new RabbitMQBroker("valid-bytes", {
    topologyMode: "plan-only",
    maxMessageBytes: 1024,
  });
  assert.ok(broker);
  return broker.close();
});

test("broker accepts valid topologyMode values", () => {
  const brokers = [
    new RabbitMQBroker("assert-mode", { topologyMode: "assert", shutdownTimeoutMs: 0 }),
    new RabbitMQBroker("passive-mode", { topologyMode: "passive", shutdownTimeoutMs: 0 }),
    new RabbitMQBroker("plan-mode", { topologyMode: "plan-only", shutdownTimeoutMs: 0 }),
  ];

  for (const b of brokers) b.close();
  assert.equal(brokers.length, 3);
});
