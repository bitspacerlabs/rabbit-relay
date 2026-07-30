#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

cleanup() {
  cd "$ROOT_DIR" >/dev/null 2>&1 || true

  if [[ -n "${PKG_FILE:-}" && -f "$ROOT_DIR/$PKG_FILE" ]]; then
    rm -f "$ROOT_DIR/$PKG_FILE"
  fi

  if [[ -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

log "Root dir: $ROOT_DIR"
log "Temp test dir: $TMP_DIR"

log "START: Building package"
cd "$ROOT_DIR"
npm run build
log "DONE:  Building package"

log "START: Packing package"
PKG_FILE="$(npm pack --silent)"
PKG_PATH="$ROOT_DIR/$PKG_FILE"
log "DONE:  Packing package -> $PKG_FILE"

log "START: Preparing real-usage test project"

mkdir -p "$TMP_DIR/real"
cd "$TMP_DIR/real"

npm init -y >/dev/null 2>&1

log "START: Installing package for real-usage test"
npm install "$PKG_PATH" >/dev/null 2>&1
log "DONE:  Installing package for real-usage test"

cat > test.mjs <<'EOF'
import assert from "node:assert";
import {
  RabbitMQBroker,
  event,
  withHeaders,
  withMeta,
  withCorrelation,
  traceFrom,
  augmentEvents,
  attachOpenTelemetry,
  makeMemoryDedupe,
  emptyTopologyPlan,
  mergeTopologyPlans,
} from "@bitspacerlabs/rabbit-relay";

const PREFIX = `real-usage-${Date.now()}`;
const TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitFor(predicate, message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      try {
        if (predicate()) return resolve();
      } catch (err) {
        return reject(err);
      }
      if (Date.now() >= deadline) {
        return reject(new Error(`waitFor timeout: ${message}`));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

// --- Event contract (as documented) ----------------------------------------

const SchedulerEvents = {
  ScheduleTask: `${PREFIX}.scheduleTask`,
  TaskCompleted: `${PREFIX}.taskCompleted`,
};

const scheduleTask = event(SchedulerEvents.ScheduleTask, "v1").of();

const taskCompleted = event(SchedulerEvents.TaskCompleted, "v1").of();

let step = 0;
function logStep(name) {
  step++;
  console.log(`\n[step ${step}] ${name}`);
}

// --- Step 1: Publish and consume ---------------------------------------------

logStep("publish and consume");
{
  const pub = new RabbitMQBroker(`${PREFIX}.pub`);
  const sub = new RabbitMQBroker(`${PREFIX}.sub`);

  const pubRelay = await pub
    .queue(`${PREFIX}.pub.q`)
    .exchange(`${PREFIX}.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
    });

  const subRelay = await sub
    .queue(`${PREFIX}.sub.q`)
    .exchange(`${PREFIX}.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  const received = [];
  subRelay.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    received.push(ev.data.id);
  });

  await subRelay.consume({ prefetch: 10, concurrency: 5 });

  await pubRelay.produce(
    scheduleTask({ id: "task-1", when: Date.now() + 5000 })
  );

  await waitFor(() => received.length === 1, "basic consume");
  assert.deepEqual(received, ["task-1"]);

  await pub.close();
  await sub.close();
  console.log("  -> received task-1 OK");
}

// --- Step 2: with() typed publish API ---------------------------------------

logStep("with() typed publish API");
{
  const pub = new RabbitMQBroker(`${PREFIX}.with.pub`);
  const sub = new RabbitMQBroker(`${PREFIX}.with.sub`);

  const pubRelay = await pub
    .queue(`${PREFIX}.with.pub.q`)
    .exchange(`${PREFIX}.with.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
    });

  const subRelay = await sub
    .queue(`${PREFIX}.with.sub.q`)
    .exchange(`${PREFIX}.with.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  const received = [];
  subRelay.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    received.push(ev.data.id);
  });
  await subRelay.consume({ prefetch: 10, concurrency: 5 });

  const api = pubRelay.with({ scheduleTask });
  await api.scheduleTask({ id: "task-2", when: Date.now() + 10_000 });

  await waitFor(() => received.length === 1, "with() consume");
  assert.deepEqual(received, ["task-2"]);

  await pub.close();
  await sub.close();
  console.log("  -> with() received task-2 OK");
}

// --- Step 3: Retries and DLQ ------------------------------------------------

logStep("retries and DLQ");
{
  const pub = new RabbitMQBroker(`${PREFIX}.dlq.pub`);
  const sub = new RabbitMQBroker(`${PREFIX}.dlq.sub`);

  const pubRelay = await pub
    .queue(`${PREFIX}.dlq.pub.q`)
    .exchange(`${PREFIX}.dlq.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
      deadLetter: {
        exchange: `${PREFIX}.dlq.dlx`,
        queue: `${PREFIX}.dlq.dlq`,
        routingKey: `${PREFIX}.dlq.dead`,
        autoDeclare: true,
      },
    });

  const subRelay = await sub
    .queue(`${PREFIX}.dlq.q`)
    .exchange(`${PREFIX}.dlq.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
      deadLetter: {
        exchange: `${PREFIX}.dlq.dlx`,
        queue: `${PREFIX}.dlq.dlq`,
        routingKey: `${PREFIX}.dlq.dead`,
        autoDeclare: true,
      },
    });

  const attempts = [];
  const retryEvents = [];
  subRelay.on("retry.scheduled", (ev) => retryEvents.push(ev));

  subRelay.handle(SchedulerEvents.ScheduleTask, async () => {
    attempts.push(Date.now());
    throw new Error("forced failure for DLQ test");
  });

  await subRelay.consume({
    prefetch: 1,
    concurrency: 1,
    onError: "retry",
    retry: {
      attempts: 2,
      then: "dead-letter",
    },
  });

  await pubRelay.produce(
    scheduleTask({ id: "task-dlq", when: Date.now() })
  );

  await waitFor(() => attempts.length >= 3, "retry attempts exhausted", 10000);
  await waitFor(() => retryEvents.length >= 2, "retry.scheduled events", 5000);

  assert.equal(attempts.length, 3, "should attempt initial + 2 retries = 3");
  assert.equal(retryEvents.length, 2, "should schedule 2 retries");

  await pub.close();
  await sub.close();
  console.log("  -> 3 attempts, 2 retry.scheduled events OK");
}

// --- Step 4: Typed RPC ------------------------------------------------------

logStep("typed RPC");
{
  const srv = new RabbitMQBroker(`${PREFIX}.rpc.srv`);
  const cli = new RabbitMQBroker(`${PREFIX}.rpc.cli`);

  const cliRelay = await cli
    .queue(`${PREFIX}.rpc.cli.q`)
    .exchange(`${PREFIX}.rpc.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
    });

  const srvRelay = await srv
    .queue(`${PREFIX}.rpc.srv.q`)
    .exchange(`${PREFIX}.rpc.ex`, {
      exchangeType: "topic",
      routingKey: SchedulerEvents.ScheduleTask,
    });

  srvRelay.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    return { ok: true, echo: ev.data.id };
  });

  await srvRelay.consume({ prefetch: 1, concurrency: 1 });

  const reply = await cliRelay.request(
    scheduleTask({ id: "task-rpc", when: Date.now() }),
    { timeoutMs: 5000 }
  );

  assert.ok(reply.ok, "RPC reply.ok should be true");
  assert.equal(reply.echo, "task-rpc");

  await srv.close();
  await cli.close();
  console.log("  -> RPC reply OK", JSON.stringify(reply));
}

// --- Step 5: Message metadata (withHeaders, traceFrom) ----------------------

logStep("message metadata (withHeaders, traceFrom)");
{
  const pub = new RabbitMQBroker(`${PREFIX}.meta.pub`);
  const sub = new RabbitMQBroker(`${PREFIX}.meta.sub`);

  const pubRelay = await pub
    .queue(`${PREFIX}.meta.pub.q`)
    .exchange(`${PREFIX}.meta.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
    });

  const subRelay = await sub
    .queue(`${PREFIX}.meta.sub.q`)
    .exchange(`${PREFIX}.meta.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  const captured = [];
  subRelay.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    captured.push(ev);
  });

  await subRelay.consume({ prefetch: 1, concurrency: 1 });

  const parentEvt = scheduleTask({ id: "task-meta", when: Date.now() });

  const withHdr = withHeaders(parentEvt, { source: "scheduler_service" });
  assert.equal(withHdr.meta.headers.source, "scheduler_service");

  await pubRelay.produce(withHdr);

  await waitFor(() => captured.length === 1, "metadata consume");

  const consumed = captured[0];
  assert.equal(consumed.meta.headers.source, "scheduler_service");

  // traceFrom creates a child event with corrId preserved and causationId set
  const childMeta = traceFrom(consumed, {
    headers: { child: "yes" },
  });
  assert.equal(childMeta.causationId, consumed.id);
  assert.equal(childMeta.headers.child, "yes");

  await pub.close();
  await sub.close();
  console.log("  -> withHeaders + traceFrom OK");
}

// --- Step 6: Operations helpers (planTopology, validateTopology, redriveDlq) -

logStep("operations helpers (planTopology, validateTopology, redriveDlq dry-run)");
{
  const broker = new RabbitMQBroker(`${PREFIX}.ops`);

  const relay = await broker
    .queue(`${PREFIX}.ops.q`)
    .exchange(`${PREFIX}.ops.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
      publisherConfirms: true,
      deadLetter: {
        exchange: `${PREFIX}.ops.dlx`,
        queue: `${PREFIX}.ops.dlq`,
        routingKey: `${PREFIX}.ops.dead`,
        autoDeclare: true,
      },
    });

  const plan = broker.planTopology();
  assert.ok(Array.isArray(plan.exchanges), "plan.exchanges should be array");
  assert.ok(Array.isArray(plan.queues), "plan.queues should be array");
  assert.ok(Array.isArray(plan.bindings), "plan.bindings should be array");

  const subPlan = relay.planTopology();
  assert.ok(
    subPlan.exchanges.some((e) => e.name === `${PREFIX}.ops.ex`),
    "sub-plan should contain exchange"
  );
  assert.ok(
    subPlan.queues.some((q) => q.name === `${PREFIX}.ops.q`),
    "sub-plan should contain queue"
  );

  const validation = await relay.validateTopology();
  assert.ok(validation, "validateTopology should return a result");
  console.log("  -> validateTopology valid:", validation.valid);
  assert.equal(validation.valid, true, "topology should be valid after assert");

  const redrive = await broker.redriveDlq({
    fromQueue: `${PREFIX}.ops.dlq`,
    toExchange: `${PREFIX}.ops.ex`,
    routingKey: SchedulerEvents.ScheduleTask,
    limit: 10,
    dryRun: true,
  });

  assert.ok(redrive.dryRun === true, "redriveDlq dryRun should be true");
  console.log("  -> redriveDlq dry-run OK", JSON.stringify(redrive));

  await broker.close();
  console.log("  -> operations helpers OK");
}

// --- Step 7: OpenTelemetry --------------------------------------------------

logStep("OpenTelemetry spans");
{
  const broker = new RabbitMQBroker(`${PREFIX}.otel`);
  const spans = [];

  const tracer = {
    startSpan(name) {
      const span = { name, ended: false, status: undefined };
      span.setStatus = (s) => { span.status = s; };
      span.end = () => { span.ended = true; };
      span.setAttribute = () => {};
      span.setAttributes = () => {};
      span.addEvent = () => {};
      span.recordException = () => {};
      spans.push(span);
      return span;
    },
  };

  const handle = attachOpenTelemetry(broker, { tracer, serviceName: "real-usage-svc" });

  const relay = await broker
    .queue(`${PREFIX}.otel.q`)
    .exchange(`${PREFIX}.otel.ex`, {
      exchangeType: "topic",
      routingKey: SchedulerEvents.ScheduleTask,
      publisherConfirms: true,
    });

  relay.handle(SchedulerEvents.ScheduleTask, async () => { /* noop */ });
  const consumer = await relay.consume({ prefetch: 1, concurrency: 1 });

  await relay.produce(scheduleTask({ id: "task-otel", when: Date.now() }));

  await waitFor(
    () => spans.some((s) => s.name === "rabbit-relay.handler.completed"),
    "handler.completed span",
    5000
  );

  await consumer.stop();
  handle.detach();

  for (const span of spans) {
    assert.ok(span.ended, `span ${span.name} should be ended`);
  }

  console.log("  -> created", spans.length, "spans, all ended OK");
  assert.ok(spans.some((s) => s.name === "rabbit-relay.consumer.started"));
  assert.ok(spans.some((s) => s.name === "rabbit-relay.consumer.stopped"));
  assert.ok(spans.some((s) => s.name === "rabbit-relay.handler.completed"));

  await broker.close();
}

// --- Step 8: Health checks --------------------------------------------------

logStep("health checks");
{
  const broker = new RabbitMQBroker(`${PREFIX}.health`);
  const relay = await broker
    .queue(`${PREFIX}.health.q`)
    .exchange(`${PREFIX}.health.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  const health = await broker.health();
  assert.equal(typeof health.connected, "boolean");
  assert.equal(health.peerName, `${PREFIX}.health`);
  assert.ok(Array.isArray(health.consumers));

  await broker.close();
  console.log("  -> health OK", JSON.stringify({ connected: health.connected, peerName: health.peerName }));
}

// --- Step 9: augmentEvents (typed publish via factory group) -----------------

logStep("augmentEvents");
{
  const broker = new RabbitMQBroker(`${PREFIX}.aug`);
  const relay = await broker
    .queue(`${PREFIX}.aug.q`)
    .exchange(`${PREFIX}.aug.ex`, {
      exchangeType: "topic",
      publisherConfirms: true,
    });

  const subBroker = new RabbitMQBroker(`${PREFIX}.aug.sub`);
  const sub = await subBroker
    .queue(`${PREFIX}.aug.sub.q`)
    .exchange(`${PREFIX}.aug.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  const received = [];
  sub.handle(SchedulerEvents.ScheduleTask, async (_id, ev) => {
    received.push(ev.data.id);
  });
  await sub.consume({ prefetch: 1, concurrency: 1 });

  const api = augmentEvents(
    { schedule: scheduleTask },
    {
      async produce(ev) {
        await relay.produce(ev);
      },
    }
  );

  await api.schedule({ id: "task-aug", when: Date.now() });

  await waitFor(() => received.length === 1, "augmentEvents consume");
  assert.equal(received[0], "task-aug");

  await broker.close();
  await subBroker.close();
  console.log("  -> augmentEvents publish OK");
}

// --- Step 10: topology plan helpers (emptyTopologyPlan, mergeTopologyPlans) --

logStep("topology plan helpers");
{
  const empty = emptyTopologyPlan();
  assert.equal(empty.exchanges.length, 0);
  assert.equal(empty.queues.length, 0);
  assert.equal(empty.bindings.length, 0);

  const part = {
    exchanges: [{ name: `${PREFIX}.merge.ex`, type: "topic", durable: true }],
    queues: [{ name: `${PREFIX}.merge.q`, durable: true }],
    bindings: [{ queue: `${PREFIX}.merge.q`, exchange: `${PREFIX}.merge.ex`, routingKey: `${PREFIX}.*` }],
  };

  const merged = mergeTopologyPlans(part, part);
  assert.equal(merged.exchanges.length, 1, "merge should dedupe exchanges");
  assert.equal(merged.queues.length, 1, "merge should dedupe queues");
  assert.equal(merged.bindings.length, 1, "merge should dedupe bindings");

  console.log("  -> mergeTopologyPlans dedupe OK");
}

// --- Step 11: makeMemoryDedupe (idempotency helper) -------------------------

logStep("makeMemoryDedupe");
{
  const dedupe = makeMemoryDedupe({ ttlMs: 5000 });
  const ev = scheduleTask({ id: "task-dedupe", when: Date.now() });

  assert.ok(dedupe.checkAndRemember(ev), "first check should pass");
  assert.ok(!dedupe.checkAndRemember(ev), "duplicate should be rejected");
  assert.equal(dedupe.size(), 1);
  assert.ok(dedupe.seen(ev.id), "seen should return true for remembered id");

  const ev2 = scheduleTask({ id: "task-dedupe-2", when: Date.now() });
  assert.ok(dedupe.checkAndRemember(ev2), "second unique event should pass");
  assert.equal(dedupe.size(), 2);

  console.log("  -> dedupe OK");
}

// --- Step 12: Graceful shutdown (broker.closed event) ------------------------

logStep("graceful shutdown");
{
  const broker = new RabbitMQBroker(`${PREFIX}.shutdown`);
  let closedPeer = null;
  broker.on("broker.closed", (ev) => { closedPeer = ev.peerName; });

  await broker
    .queue(`${PREFIX}.shutdown.q`)
    .exchange(`${PREFIX}.shutdown.ex`, {
      exchangeType: "topic",
      routingKey: `${PREFIX}.*`,
    });

  await broker.close();

  assert.equal(closedPeer, `${PREFIX}.shutdown`, "broker.closed should fire with peerName");
  console.log("  -> graceful shutdown emitted broker.closed OK");
}

console.log("\n========================================");
console.log("ALL REAL-USAGE TESTS PASSED");
console.log("========================================");
EOF

log "START: Running real-usage end-to-end test"
node test.mjs
log "DONE:  Running real-usage end-to-end test"

cd "$ROOT_DIR"

log "Real usage tests passed"