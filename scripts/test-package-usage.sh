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

log "START: Verifying native ESM output"

node <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve("dist/esm");
const queue = [root];

while (queue.length > 0) {
  const current = queue.pop();

  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const file = path.join(current, entry.name);

    if (entry.isDirectory()) {
      queue.push(file);
      continue;
    }

    if (!entry.name.endsWith(".js")) continue;

    const source = fs.readFileSync(file, "utf8");
    if (/\brequire\s*\(|\bmodule\.exports\b|\bexports\./.test(source)) {
      throw new Error(`CommonJS syntax found in ESM output: ${file}`);
    }
  }
}

const metadata = JSON.parse(fs.readFileSync("dist/esm/package.json", "utf8"));
if (metadata.type !== "module") {
  throw new Error("dist/esm/package.json must declare type=module");
}
EOF

log "DONE:  Verifying native ESM output"

log "START: Packing package"
PKG_FILE="$(npm pack --silent)"
PKG_PATH="$ROOT_DIR/$PKG_FILE"
log "DONE:  Packing package -> $PKG_FILE"

########################################
# ESM test
########################################

log "START: Preparing ESM test project"

mkdir -p "$TMP_DIR/esm"
cd "$TMP_DIR/esm"

npm init -y >/dev/null 2>&1

log "START: Installing package for ESM test"
npm install "$PKG_PATH" >/dev/null 2>&1
log "DONE:  Installing package for ESM test"

log "START: Running ESM import smoke test"

node --input-type=module <<'EOF'
import * as rabbitRelay from "@bitspacerlabs/rabbit-relay";
import { makeMemoryDedupe as makeMemoryDedupeSubpath } from "@bitspacerlabs/rabbit-relay/dedupe";
import {
  RabbitMQBroker,
  event,
  eventWithReply,
  expectReply,
  withMeta,
  withHeaders,
  withCorrelation,
  withCausation,
  traceFrom,
  pluginManager,
  makeMemoryDedupe,
  MessageTooLargeError,
  attachOpenTelemetry,
  redriveDlq,
  augmentEvents,
  PluginManager,
  LifecycleEmitter,
  emptyTopologyPlan,
  mergeTopologyPlans,
  validateTopologyPlan,
} from "@bitspacerlabs/rabbit-relay";

const expectedRuntimeExports = [
  "LifecycleEmitter",
  "MessageTooLargeError",
  "PluginManager",
  "RabbitMQBroker",
  "attachOpenTelemetry",
  "augmentEvents",
  "emptyTopologyPlan",
  "event",
  "eventWithReply",
  "expectReply",
  "makeMemoryDedupe",
  "mergeTopologyPlans",
  "pluginManager",
  "redriveDlq",
  "traceFrom",
  "validateTopologyPlan",
  "withCausation",
  "withCorrelation",
  "withHeaders",
  "withMeta",
];

for (const exportName of expectedRuntimeExports) {
  if (!(exportName in rabbitRelay)) {
    throw new Error(`ESM runtime export missing: ${exportName}`);
  }
}

if ("default" in rabbitRelay) {
  throw new Error("ESM entrypoint unexpectedly exposed a CommonJS default export");
}

if (typeof makeMemoryDedupeSubpath !== "function") {
  throw new Error("ESM dedupe subpath export missing");
}

if (!RabbitMQBroker) throw new Error("RabbitMQBroker export missing");
if (!event) throw new Error("event export missing");
if (!eventWithReply) throw new Error("eventWithReply export missing");
if (!expectReply) throw new Error("expectReply export missing");
if (!withMeta) throw new Error("withMeta export missing");
if (!withHeaders) throw new Error("withHeaders export missing");
if (!withCorrelation) throw new Error("withCorrelation export missing");
if (!withCausation) throw new Error("withCausation export missing");
if (!traceFrom) throw new Error("traceFrom export missing");
if (!pluginManager) throw new Error("pluginManager export missing");
if (!makeMemoryDedupe) throw new Error("makeMemoryDedupe export missing");
if (!MessageTooLargeError) throw new Error("MessageTooLargeError export missing");
if (!attachOpenTelemetry) throw new Error("attachOpenTelemetry export missing");
if (!redriveDlq) throw new Error("redriveDlq export missing");
if (!augmentEvents) throw new Error("augmentEvents export missing");
if (!PluginManager) throw new Error("PluginManager export missing");
if (!LifecycleEmitter) throw new Error("LifecycleEmitter export missing");
if (!emptyTopologyPlan) throw new Error("emptyTopologyPlan export missing");
if (!mergeTopologyPlans) throw new Error("mergeTopologyPlans export missing");
if (!validateTopologyPlan) throw new Error("validateTopologyPlan export missing");

const makeTest = event("test.event", "v1").of();
const ev = makeTest({ ok: true });

if (ev.name !== "test.event") throw new Error("event factory produced wrong name");
if (ev.v !== "v1") throw new Error("event factory produced wrong version");
if (!ev.id) throw new Error("event factory did not produce id");

const withHeadersEv = withHeaders(ev, {
  tenantId: "tenant-1",
  source: "esm-test",
});

if (withHeadersEv.meta?.headers?.tenantId !== "tenant-1") {
  throw new Error("withHeaders did not set tenantId");
}

const withMetaEv = withMeta(withHeadersEv, {
  corrId: "corr-1",
  headers: {
    feature: "package-test",
  },
});

if (withMetaEv.meta?.corrId !== "corr-1") {
  throw new Error("withMeta did not set corrId");
}

if (withMetaEv.meta?.headers?.tenantId !== "tenant-1") {
  throw new Error("withMeta did not preserve existing headers");
}

if (withMetaEv.meta?.headers?.feature !== "package-test") {
  throw new Error("withMeta did not merge new headers");
}

withCorrelation(withMetaEv, "corr-2");
if (withMetaEv.meta?.corrId !== "corr-2") {
  throw new Error("withCorrelation did not update corrId");
}

withCausation(withMetaEv, "cause-1");
if (withMetaEv.meta?.causationId !== "cause-1") {
  throw new Error("withCausation did not update causationId");
}

const childMeta = traceFrom(withMetaEv, {
  headers: {
    child: "yes",
  },
});

if (childMeta.corrId !== "corr-2") {
  throw new Error("traceFrom did not preserve parent corrId");
}

if (childMeta.causationId !== withMetaEv.id) {
  throw new Error("traceFrom did not set causationId to parent id");
}

if (childMeta.headers?.tenantId !== "tenant-1") {
  throw new Error("traceFrom did not copy parent headers");
}

if (childMeta.headers?.child !== "yes") {
  throw new Error("traceFrom did not merge child headers");
}

const makeRpc = eventWithReply("test.rpc", "v1").of();
const rpcEv = makeRpc({ ok: true });

if (rpcEv.meta?.expectsReply !== true) {
  throw new Error("eventWithReply did not set expectsReply=true");
}

const replyMeta = expectReply({ corrId: "corr-rpc" }, 1234);

if (replyMeta.expectsReply !== true) {
  throw new Error("expectReply did not set expectsReply=true");
}

if (replyMeta.timeoutMs !== 1234) {
  throw new Error("expectReply did not set timeoutMs");
}

const err = new MessageTooLargeError({
  eventName: "test.event",
  sizeBytes: 200,
  maxBytes: 100,
});

if (!(err instanceof Error)) {
  throw new Error("MessageTooLargeError is not an Error");
}

if (err.eventName !== "test.event" || err.sizeBytes !== 200 || err.maxBytes !== 100) {
  throw new Error("MessageTooLargeError properties are wrong");
}

const dedupe = makeMemoryDedupe({ ttlMs: 1000 });

if (!dedupe.checkAndRemember(ev)) {
  throw new Error("dedupe should accept first event");
}

if (dedupe.checkAndRemember(ev)) {
  throw new Error("dedupe should reject duplicate event");
}

if (dedupe.size() !== 1 || !dedupe.seen(ev.id)) {
  throw new Error("dedupe size/seen behavior is wrong");
}

const produced = [];
const augmented = augmentEvents(
  { ping: event("test.ping", "v1").of() },
  {
    async produce(...events) {
      produced.push(...events);
      return "published";
    },
  }
);

const augmentedResult = await augmented.ping({ value: 1 });
if (augmentedResult !== "published" || produced[0]?.name !== "test.ping") {
  throw new Error("augmentEvents did not create and publish the event");
}

const localPluginManager = new PluginManager();
const pluginCalls = [];
localPluginManager.register({
  async beforeProduce(event) {
    pluginCalls.push(event.name);
  },
});
await localPluginManager.executeHook("beforeProduce", ev);
if (pluginCalls.join(",") !== "test.event") {
  throw new Error("PluginManager did not execute a registered hook");
}

const lifecycle = new LifecycleEmitter();
let lifecycleCalls = 0;
const offLifecycle = lifecycle.on("reconnect", async ({ peerName }) => {
  if (peerName !== "test-peer") throw new Error("bad lifecycle payload");
  lifecycleCalls++;
});
await lifecycle.emit("reconnect", { peerName: "test-peer" });
offLifecycle();
await lifecycle.emit("reconnect", { peerName: "test-peer" });
if (lifecycleCalls !== 1) {
  throw new Error("LifecycleEmitter subscribe/unsubscribe behavior is wrong");
}

const emptyPlan = emptyTopologyPlan();
if (emptyPlan.exchanges.length || emptyPlan.queues.length || emptyPlan.bindings.length) {
  throw new Error("emptyTopologyPlan was not empty");
}

const topologyPart = {
  exchanges: [{ name: "test.ex", type: "topic", durable: true }],
  queues: [{ name: "test.q", durable: true }],
  bindings: [{ queue: "test.q", exchange: "test.ex", routingKey: "test.*" }],
};
const mergedPlan = mergeTopologyPlans(topologyPart, topologyPart);
if (
  mergedPlan.exchanges.length !== 1 ||
  mergedPlan.queues.length !== 1 ||
  mergedPlan.bindings.length !== 1
) {
  throw new Error("mergeTopologyPlans did not deduplicate topology");
}

const missingError = Object.assign(new Error("not found"), { code: 404 });
const validation = await validateTopologyPlan(
  {
    async checkExchange() {
      return undefined;
    },
    async checkQueue() {
      throw missingError;
    },
  },
  topologyPart
);
if (
  validation.valid ||
  !validation.issues.some((issue) => issue.type === "missing_queue") ||
  !validation.issues.some((issue) => issue.type === "binding_not_validated")
) {
  throw new Error("validateTopologyPlan did not report passive validation issues");
}

let acked = 0;
const redriveMessage = {
  content: Buffer.from("payload"),
  fields: { routingKey: "original.key" },
  properties: { headers: { "x-rabbit-relay-redrive-count": 1 } },
};
const redriveResult = await redriveDlq(
  {
    async checkQueue() {
      return { messageCount: 1 };
    },
    async get() {
      return redriveMessage;
    },
    publish(_exchange, routingKey, _content, options) {
      if (routingKey !== "original.key") throw new Error("routing key was not preserved");
      if (options.headers["x-rabbit-relay-redrive-count"] !== 2) {
        throw new Error("redrive count was not incremented");
      }
      return true;
    },
    ack(message) {
      if (message !== redriveMessage) throw new Error("wrong message ACKed");
      acked++;
    },
  },
  {
    fromQueue: "test.dlq",
    toExchange: "test.ex",
    limit: 1,
  }
);
if (redriveResult.republished !== 1 || redriveResult.acked !== 1 || acked !== 1) {
  throw new Error("redriveDlq did not republish and ACK successfully");
}

await redriveDlq(
  {
    async checkQueue() {
      return { messageCount: 4 };
    },
  },
  {
    fromQueue: "test.dlq",
    toExchange: "test.ex",
    limit: 2,
    dryRun: true,
  }
).then((result) => {
  if (!result.dryRun || result.available !== 4 || result.attempted !== 0) {
    throw new Error("redriveDlq dry-run result is wrong");
  }
});

const fakeTracer = {
  startSpan() {
    return {
      setAttributes() {},
      addEvent() {},
      setStatus() {},
      end() {},
    };
  },
};

let invalidTopologyModeFailed = false;

try {
  new RabbitMQBroker("package-test-invalid-topology-mode-esm", {
    topologyMode: "invalid-mode",
  });
} catch (err) {
  invalidTopologyModeFailed =
    err instanceof Error &&
    err.message.includes("invalid topologyMode");
}

if (!invalidTopologyModeFailed) {
  throw new Error("Invalid topologyMode did not fail fast in ESM");
}

const broker = new RabbitMQBroker("package-test-otel-esm", {
  topologyMode: "plan-only",
});

const otel = attachOpenTelemetry(broker, {
  tracer: fakeTracer,
  serviceName: "package-test-esm",
});

if (!otel || typeof otel.detach !== "function") {
  throw new Error("attachOpenTelemetry did not return detach handle");
}

const planOnlySub = await broker
  .queue("package-test-plan-only-esm.q")
  .exchange("package-test-plan-only-esm.ex", {
    exchangeType: "topic",
    routingKey: "package.*",
    topologyMode: "plan-only",
  });

const plan = broker.planTopology();

if (!plan || !Array.isArray(plan.exchanges) || !Array.isArray(plan.queues) || !Array.isArray(plan.bindings)) {
  throw new Error("planTopology did not return a valid topology plan");
}

const subPlan = planOnlySub.planTopology();

if (subPlan.exchanges[0]?.name !== "package-test-plan-only-esm.ex") {
  throw new Error("plan-only sub topology plan missing exchange");
}

if (subPlan.queues[0]?.name !== "package-test-plan-only-esm.q") {
  throw new Error("plan-only sub topology plan missing queue");
}

if (subPlan.bindings[0]?.routingKey !== "package.*") {
  throw new Error("plan-only sub topology plan missing binding");
}

const health = await broker.health();
if (health.peerName !== "package-test-otel-esm" || health.consumers[0]?.queue !== "package-test-plan-only-esm.q") {
  throw new Error("broker health did not include peer and registered consumer");
}

let brokerClosed = false;
broker.on("broker.closed", ({ peerName }) => {
  brokerClosed = peerName === "package-test-otel-esm";
});

otel.detach();
await broker.close();
if (!brokerClosed) throw new Error("broker.closed lifecycle event was not emitted");

console.log("ESM import OK");
EOF

log "DONE:  Running ESM import smoke test"

########################################
# CommonJS test
########################################

log "START: Preparing CommonJS test project"

mkdir -p "$TMP_DIR/cjs"
cd "$TMP_DIR/cjs"

npm init -y >/dev/null 2>&1

log "START: Installing package for CommonJS test"
npm install "$PKG_PATH" >/dev/null 2>&1
log "DONE:  Installing package for CommonJS test"

log "START: Running CommonJS require smoke test"

node <<'EOF'
(async () => {
  const rabbitRelay = require("@bitspacerlabs/rabbit-relay");
  const dedupeSubpath = require("@bitspacerlabs/rabbit-relay/dedupe");
  const {
    RabbitMQBroker,
    event,
    eventWithReply,
    expectReply,
    withMeta,
    withHeaders,
    withCorrelation,
    withCausation,
    traceFrom,
    pluginManager,
    makeMemoryDedupe,
    MessageTooLargeError,
    attachOpenTelemetry,
    redriveDlq,
    augmentEvents,
    PluginManager,
    LifecycleEmitter,
    emptyTopologyPlan,
    mergeTopologyPlans,
    validateTopologyPlan,
  } = rabbitRelay;

  const expectedRuntimeExports = [
    "LifecycleEmitter",
    "MessageTooLargeError",
    "PluginManager",
    "RabbitMQBroker",
    "attachOpenTelemetry",
    "augmentEvents",
    "emptyTopologyPlan",
    "event",
    "eventWithReply",
    "expectReply",
    "makeMemoryDedupe",
    "mergeTopologyPlans",
    "pluginManager",
    "redriveDlq",
    "traceFrom",
    "validateTopologyPlan",
    "withCausation",
    "withCorrelation",
    "withHeaders",
    "withMeta",
  ];

  for (const exportName of expectedRuntimeExports) {
    if (!(exportName in rabbitRelay)) {
      throw new Error(`CommonJS runtime export missing: ${exportName}`);
    }
  }

  if (typeof dedupeSubpath.makeMemoryDedupe !== "function") {
    throw new Error("CommonJS dedupe subpath export missing");
  }

  if (!RabbitMQBroker) throw new Error("RabbitMQBroker export missing");
  if (!event) throw new Error("event export missing");
  if (!eventWithReply) throw new Error("eventWithReply export missing");
  if (!expectReply) throw new Error("expectReply export missing");
  if (!withMeta) throw new Error("withMeta export missing");
  if (!withHeaders) throw new Error("withHeaders export missing");
  if (!withCorrelation) throw new Error("withCorrelation export missing");
  if (!withCausation) throw new Error("withCausation export missing");
  if (!traceFrom) throw new Error("traceFrom export missing");
  if (!pluginManager) throw new Error("pluginManager export missing");
  if (!makeMemoryDedupe) throw new Error("makeMemoryDedupe export missing");
  if (!MessageTooLargeError) throw new Error("MessageTooLargeError export missing");
  if (!attachOpenTelemetry) throw new Error("attachOpenTelemetry export missing");
  if (!redriveDlq) throw new Error("redriveDlq export missing");
  if (!augmentEvents) throw new Error("augmentEvents export missing");
  if (!PluginManager) throw new Error("PluginManager export missing");
  if (!LifecycleEmitter) throw new Error("LifecycleEmitter export missing");
  if (!emptyTopologyPlan) throw new Error("emptyTopologyPlan export missing");
  if (!mergeTopologyPlans) throw new Error("mergeTopologyPlans export missing");
  if (!validateTopologyPlan) throw new Error("validateTopologyPlan export missing");

  const makeTest = event("test.event", "v1").of();
  const ev = makeTest({ ok: true });

  if (ev.name !== "test.event") throw new Error("event factory produced wrong name");
  if (ev.v !== "v1") throw new Error("event factory produced wrong version");
  if (!ev.id) throw new Error("event factory did not produce id");

  const withHeadersEv = withHeaders(ev, {
    tenantId: "tenant-1",
    source: "cjs-test",
  });

  if (!withHeadersEv.meta || withHeadersEv.meta.headers.tenantId !== "tenant-1") {
    throw new Error("withHeaders did not set tenantId");
  }

  const withMetaEv = withMeta(withHeadersEv, {
    corrId: "corr-1",
    headers: {
      feature: "package-test",
    },
  });

  if (!withMetaEv.meta || withMetaEv.meta.corrId !== "corr-1") {
    throw new Error("withMeta did not set corrId");
  }

  if (withMetaEv.meta.headers.tenantId !== "tenant-1") {
    throw new Error("withMeta did not preserve existing headers");
  }

  if (withMetaEv.meta.headers.feature !== "package-test") {
    throw new Error("withMeta did not merge new headers");
  }

  withCorrelation(withMetaEv, "corr-2");
  if (withMetaEv.meta.corrId !== "corr-2") {
    throw new Error("withCorrelation did not update corrId");
  }

  withCausation(withMetaEv, "cause-1");
  if (withMetaEv.meta.causationId !== "cause-1") {
    throw new Error("withCausation did not update causationId");
  }

  const childMeta = traceFrom(withMetaEv, {
    headers: {
      child: "yes",
    },
  });

  if (childMeta.corrId !== "corr-2") {
    throw new Error("traceFrom did not preserve parent corrId");
  }

  if (childMeta.causationId !== withMetaEv.id) {
    throw new Error("traceFrom did not set causationId to parent id");
  }

  if (childMeta.headers.tenantId !== "tenant-1") {
    throw new Error("traceFrom did not copy parent headers");
  }

  if (childMeta.headers.child !== "yes") {
    throw new Error("traceFrom did not merge child headers");
  }

  const makeRpc = eventWithReply("test.rpc", "v1").of();
  const rpcEv = makeRpc({ ok: true });

  if (!rpcEv.meta || rpcEv.meta.expectsReply !== true) {
    throw new Error("eventWithReply did not set expectsReply=true");
  }

  const replyMeta = expectReply({ corrId: "corr-rpc" }, 1234);

  if (replyMeta.expectsReply !== true) {
    throw new Error("expectReply did not set expectsReply=true");
  }

  if (replyMeta.timeoutMs !== 1234) {
    throw new Error("expectReply did not set timeoutMs");
  }

  const err = new MessageTooLargeError({
    eventName: "test.event",
    sizeBytes: 200,
    maxBytes: 100,
  });

  if (!(err instanceof Error)) {
    throw new Error("MessageTooLargeError is not an Error");
  }

  if (err.eventName !== "test.event" || err.sizeBytes !== 200 || err.maxBytes !== 100) {
    throw new Error("MessageTooLargeError properties are wrong");
  }

  const dedupe = makeMemoryDedupe({ ttlMs: 1000 });

  if (!dedupe.checkAndRemember(ev)) {
    throw new Error("dedupe should accept first event");
  }

  if (dedupe.checkAndRemember(ev)) {
    throw new Error("dedupe should reject duplicate event");
  }

  const fakeTracer = {
    startSpan() {
      return {
        setAttributes() {},
        addEvent() {},
        setStatus() {},
        end() {},
      };
    },
  };

  let invalidTopologyModeFailed = false;

  try {
    new RabbitMQBroker("package-test-invalid-topology-mode-cjs", {
      topologyMode: "invalid-mode",
    });
  } catch (err) {
    invalidTopologyModeFailed =
      err instanceof Error &&
      err.message.includes("invalid topologyMode");
  }

  if (!invalidTopologyModeFailed) {
    throw new Error("Invalid topologyMode did not fail fast in CommonJS");
  }

  const broker = new RabbitMQBroker("package-test-otel-cjs", {
    topologyMode: "plan-only",
  });

  const otel = attachOpenTelemetry(broker, {
    tracer: fakeTracer,
    serviceName: "package-test-cjs",
  });

  if (!otel || typeof otel.detach !== "function") {
    throw new Error("attachOpenTelemetry did not return detach handle");
  }

  const planOnlySub = await broker
    .queue("package-test-plan-only-cjs.q")
    .exchange("package-test-plan-only-cjs.ex", {
      exchangeType: "topic",
      routingKey: "package.*",
      topologyMode: "plan-only",
    });

  const plan = broker.planTopology();

  if (!plan || !Array.isArray(plan.exchanges) || !Array.isArray(plan.queues) || !Array.isArray(plan.bindings)) {
    throw new Error("planTopology did not return a valid topology plan");
  }

  const subPlan = planOnlySub.planTopology();

  if (subPlan.exchanges[0]?.name !== "package-test-plan-only-cjs.ex") {
    throw new Error("plan-only sub topology plan missing exchange");
  }

  if (subPlan.queues[0]?.name !== "package-test-plan-only-cjs.q") {
    throw new Error("plan-only sub topology plan missing queue");
  }

  if (subPlan.bindings[0]?.routingKey !== "package.*") {
    throw new Error("plan-only sub topology plan missing binding");
  }

  otel.detach();
  await broker.close();

  console.log("CommonJS require OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF

log "DONE:  Running CommonJS require smoke test"

########################################
# TypeScript compile smoke test
########################################

log "START: Preparing TypeScript test project"

mkdir -p "$TMP_DIR/ts"
cd "$TMP_DIR/ts"

npm init -y >/dev/null 2>&1

log "START: Installing package for TypeScript test"
npm install "$PKG_PATH" typescript@5.8.3 @types/node@18 >/dev/null 2>&1
log "DONE:  Installing package for TypeScript test"

cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  }
}
EOF

cat > index.ts <<'EOF'
import {
  RabbitMQBroker,
  event,
  traceFrom,
  MessageTooLargeError,
  attachOpenTelemetry,
  type EventEnvelope,
  type BrokerConfig,
  type TopologyMode,
  type TopologyPlan,
  type TopologyValidationResult,
  type DlqRedriveResult,
} from "@bitspacerlabs/rabbit-relay";
import { makeMemoryDedupe as makeMemoryDedupeFromSubpath } from "@bitspacerlabs/rabbit-relay/dedupe";

type Ping = {
  id: string;
};

type Pong = {
  ok: boolean;
};

const ping = event("ping", "v1").of<Ping>();
const subpathDedupe = makeMemoryDedupeFromSubpath({ ttlMs: 1000 });
const subpathSize: number = subpathDedupe.size();
void subpathSize;

const defaultMode: TopologyMode = "assert";
const passiveMode: TopologyMode = "passive";
const planOnlyMode: TopologyMode = "plan-only";
const brokerConfig: BrokerConfig = {
  topologyMode: planOnlyMode,
  connectionUrl: "amqp://user:password@localhost",
  connectionName: "type-test-connection",
  shutdownTimeoutMs: 5000,
};

void defaultMode;
void passiveMode;

async function main() {
  const broker = new RabbitMQBroker("type-test", {
    ...brokerConfig,
    maxMessageBytes: 1024,
  });

  const otel = attachOpenTelemetry(broker, {
    tracer: {
      startSpan() {
        return {
          setAttributes() {},
          addEvent() {},
          setStatus() {},
          end() {},
        };
      },
    },
    serviceName: "type-test",
  });

  otel.detach();

  broker.on("broker.closed", (event) => {
    const peerName: string = event.peerName;

    if (!peerName) {
      throw new Error("missing peerName");
    }
  });

  const brokerPlan: TopologyPlan = broker.planTopology();

  if (!Array.isArray(brokerPlan.exchanges)) {
    throw new Error("bad broker topology plan");
  }

  const sub = await broker
    .queue("type-test.q")
    .exchange<{
      ping: EventEnvelope<Ping>;
    }>("type-test.ex", {
      exchangeType: "topic",
      routingKey: "ping",
      topologyMode: "plan-only",
      maxMessageBytes: 1024,
      deadLetter: {
        exchange: "type-test.dlx",
        queue: "type-test.dlq",
        routingKey: "ping.dead",
        autoDeclare: true,
      },
    });

  const passiveSub = await broker
    .queue("type-test-passive.q")
    .exchange<{
      ping: EventEnvelope<Ping>;
    }>("type-test-passive.ex", {
      exchangeType: "topic",
      routingKey: "ping",
      topologyMode: "plan-only",
    });

  const subPlan: TopologyPlan = sub.planTopology();
  const passiveSubPlan: TopologyPlan = passiveSub.planTopology();

  if (!Array.isArray(subPlan.bindings)) {
    throw new Error("bad sub topology plan");
  }

  if (!Array.isArray(passiveSubPlan.queues)) {
    throw new Error("bad passive sub topology plan");
  }

  sub.use(async (ctx, next) => {
    const name: string = ctx.event.name;
    const queue: string = ctx.queue;

    if (!name || !queue) {
      throw new Error("bad ctx");
    }

    await next();
  });

  sub.on("consumer.started", (event) => {
    const queue: string = event.queue;
    const prefetch: number = event.prefetch;
    const concurrency: number = event.concurrency;

    if (!queue || prefetch <= 0 || concurrency <= 0) {
      throw new Error("bad lifecycle event");
    }
  });

  sub.on("retry.scheduled", (event) => {
    const retryCount: number = event.retryCount;
    const attempts: number = event.attempts;
    const delayMs: number | undefined = event.delayMs;

    if (retryCount < 0 || attempts <= 0 || delayMs === 0) {
      throw new Error("bad retry event");
    }
  });

  sub.handle("ping", async (_id, ev) => {
    const value: string = ev.data.id;
    return { ok: Boolean(value) };
  });

  await sub.consume({
    dedupe: {
      enabled: true,
      ttlMs: 1000,
      keyOf: (ev) => ev.id,
    },
    onError: "retry",
    retry: {
      attempts: 1,
      delayMs: 1000,
      then: "dead-letter",
    },
  });

  const reply = await sub.request<Pong>(
    ping({ id: "p-1" }, traceFrom(ping({ id: "root" }))),
    {
      timeoutMs: 1000,
      maxMessageBytes: 1024,
    }
  );

  const ok: boolean = reply.ok;

  try {
    await sub.publish(ping({ id: "p-2" }), {
      maxMessageBytes: 1024,
    });
  } catch (err) {
    if (err instanceof MessageTooLargeError) {
      const size: number = err.sizeBytes;
      console.log(size);
    }
  }

  const validationPromise: Promise<TopologyValidationResult> =
    sub.validateTopology();

  const brokerValidationPromise: Promise<TopologyValidationResult> =
    broker.validateTopology();

  const redrivePromise: Promise<DlqRedriveResult> = broker.redriveDlq({
    fromQueue: "type-test.dlq",
    toExchange: "type-test.ex",
    routingKey: "ping",
    limit: 1,
    dryRun: true,
  });

  const subRedrivePromise: Promise<DlqRedriveResult> = sub.redriveDlq({
    fromQueue: "type-test.dlq",
    toExchange: "type-test.ex",
    routingKey: "ping",
    limit: 1,
    dryRun: true,
  });

  void validationPromise;
  void brokerValidationPromise;
  void redrivePromise;
  void subRedrivePromise;

  await broker.close();

  return ok;
}

void main;
EOF

log "START: Running TypeScript compile smoke test"
npx tsc --noEmit
log "DONE:  Running TypeScript compile smoke test"

log "START: Running ESM TypeScript compile smoke test"
npm pkg set type=module >/dev/null 2>&1
npx tsc --noEmit
log "DONE:  Running ESM TypeScript compile smoke test"

########################################
# Cleanup
########################################

cd "$ROOT_DIR"

log "Package usage tests passed"
