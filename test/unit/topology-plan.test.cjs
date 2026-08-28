const test = require("node:test");
const assert = require("node:assert/strict");

const {
  emptyTopologyPlan,
  mergeTopologyPlans,
  buildRecoveryAdvisories,
} = require("../../dist/cjs/index.js");

test("emptyTopologyPlan returns an empty plan", () => {
  const plan = emptyTopologyPlan();
  assert.deepEqual(plan, { exchanges: [], queues: [], bindings: [] });
});

test("mergeTopologyPlans merges exchanges from multiple plans", () => {
  const planA = {
    exchanges: [{ name: "ex1", type: "topic", durable: true }],
    queues: [],
    bindings: [],
  };
  const planB = {
    exchanges: [{ name: "ex2", type: "direct", durable: true }],
    queues: [],
    bindings: [],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.exchanges.length, 2);
  assert.ok(merged.exchanges.some((e) => e.name === "ex1"));
  assert.ok(merged.exchanges.some((e) => e.name === "ex2"));
});

test("mergeTopologyPlans deduplicates exchanges with same name and type", () => {
  const planA = {
    exchanges: [{ name: "ex1", type: "topic", durable: true }],
    queues: [],
    bindings: [],
  };
  const planB = {
    exchanges: [{ name: "ex1", type: "topic", durable: true }],
    queues: [],
    bindings: [],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.exchanges.length, 1);
});

test("mergeTopologyPlans does not deduplicate exchanges with same name but different type", () => {
  const planA = {
    exchanges: [{ name: "ex1", type: "topic", durable: true }],
    queues: [],
    bindings: [],
  };
  const planB = {
    exchanges: [{ name: "ex1", type: "fanout", durable: true }],
    queues: [],
    bindings: [],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.exchanges.length, 2);
});

test("mergeTopologyPlans merges queues from multiple plans", () => {
  const planA = {
    exchanges: [],
    queues: [{ name: "q1", durable: true }],
    bindings: [],
  };
  const planB = {
    exchanges: [],
    queues: [{ name: "q2", durable: true }],
    bindings: [],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.queues.length, 2);
  assert.ok(merged.queues.some((q) => q.name === "q1"));
  assert.ok(merged.queues.some((q) => q.name === "q2"));
});

test("mergeTopologyPlans deduplicates queues with same name", () => {
  const planA = {
    exchanges: [],
    queues: [{ name: "q1", durable: true }],
    bindings: [],
  };
  const planB = {
    exchanges: [],
    queues: [{ name: "q1", durable: false }],
    bindings: [],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.queues.length, 1);
  // Last one wins (later plans overwrite earlier)
  assert.equal(merged.queues[0].durable, false);
});

test("mergeTopologyPlans merges bindings from multiple plans", () => {
  const planA = {
    exchanges: [],
    queues: [],
    bindings: [{ queue: "q1", exchange: "ex1", routingKey: "#" }],
  };
  const planB = {
    exchanges: [],
    queues: [],
    bindings: [{ queue: "q2", exchange: "ex2", routingKey: "*" }],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.bindings.length, 2);
});

test("mergeTopologyPlans deduplicates identical bindings", () => {
  const planA = {
    exchanges: [],
    queues: [],
    bindings: [{ queue: "q1", exchange: "ex1", routingKey: "#" }],
  };
  const planB = {
    exchanges: [],
    queues: [],
    bindings: [{ queue: "q1", exchange: "ex1", routingKey: "#" }],
  };

  const merged = mergeTopologyPlans(planA, planB);
  assert.equal(merged.bindings.length, 1);
});

test("mergeTopologyPlans with no arguments returns empty plan", () => {
  const merged = mergeTopologyPlans();
  assert.deepEqual(merged, { exchanges: [], queues: [], bindings: [] });
});

test("mergeTopologyPlans handles plans with binding arguments for dedupe", () => {
  const planA = {
    exchanges: [],
    queues: [],
    bindings: [
      { queue: "q1", exchange: "ex1", routingKey: "#", arguments: { k: "v" } },
    ],
  };
  const planB = {
    exchanges: [],
    queues: [],
    bindings: [
      { queue: "q1", exchange: "ex1", routingKey: "#", arguments: { k: "v" } },
    ],
  };
  const planC = {
    exchanges: [],
    queues: [],
    bindings: [
      { queue: "q1", exchange: "ex1", routingKey: "#", arguments: { k: "other" } },
    ],
  };

  const merged = mergeTopologyPlans(planA, planB, planC);
  assert.equal(merged.bindings.length, 2);
});

test("buildRecoveryAdvisories emits mild advisory for durable classic queue", () => {
  const issues = buildRecoveryAdvisories({
    exchanges: [],
    queues: [{ name: "q1", durable: true }],
    bindings: [],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "recovery_advisory");
  assert.equal(issues[0].queue, "q1");
});

test("buildRecoveryAdvisories emits severe advisory for durable classic with DLQ/retry args", () => {
  const issues = buildRecoveryAdvisories({
    exchanges: [],
    queues: [
      {
        name: "q1",
        durable: true,
        arguments: { "x-dead-letter-exchange": "dlx.exchange" },
      },
    ],
    bindings: [],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "recovery_advisory_severe");
  assert.equal(issues[0].queue, "q1");
});

test("buildRecoveryAdvisories ignores durable quorum queues", () => {
  const issues = buildRecoveryAdvisories({
    exchanges: [],
    queues: [
      { name: "q1", durable: true, arguments: { "x-queue-type": "quorum" } },
    ],
    bindings: [],
  });
  assert.equal(issues.length, 0);
});

test("buildRecoveryAdvisories ignores non-durable classic queues", () => {
  const issues = buildRecoveryAdvisories({
    exchanges: [],
    queues: [{ name: "q1", durable: false }],
    bindings: [],
  });
  assert.equal(issues.length, 0);
});
