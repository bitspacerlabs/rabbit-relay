#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const commands = ["plan", "validate", "diff", "dlq", "help"];

function usage(exitCode = 0) {
  console.log(
    [
      "Rabbit Relay CLI",
      "",
      "Usage:",
      "  rabbit-relay plan <script> [--output <file>]",
      "    Run a setup script in plan-only mode and output the topology plan.",
      "",
      "  rabbit-relay validate <plan.json> [--url <amqp-url>]",
      "    Validate a topology plan against a live RabbitMQ broker.",
      "",
      "  rabbit-relay diff <plan-a.json> <plan-b.json>",
      "    Show differences between two topology plans.",
      "",
      "  rabbit-relay dlq inspect <queue> [--url <amqp-url>]",
      "    Show queue depth and message statistics.",
      "",
      "  rabbit-relay dlq peek <queue> [--limit N] [--url <amqp-url>]",
      "    View messages in a DLQ without removing them.",
      "",
      "  rabbit-relay dlq redrive <from-queue> <to-exchange> [options]",
      "    Redrive messages from a DLQ to a target exchange.",
      "    Options:",
      "      --routing-key <key>  Target routing key (default: original)",
      "      --limit <N>          Max messages to redrive (default: 100)",
      "      --dry-run            Peek without consuming",
      "      --url <amqp-url>     RabbitMQ connection URL",
      "",
      "  rabbit-relay help",
      "    Show this help message.",
      "",
      "Examples:",
      "  rabbit-relay dlq inspect orders.dlq --url amqp://localhost",
      "  rabbit-relay dlq peek orders.dlq --limit 5",
      "  rabbit-relay dlq redrive orders.dlq orders.ex --limit 50",
      "  rabbit-relay dlq redrive orders.dlq orders.ex --dry-run",
    ].join("\n")
  );
  process.exit(exitCode);
}

function error(msg) {
  console.error(`[rabbit-relay] error: ${msg}`);
  process.exit(1);
}

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf-8"));
  } catch (err) {
    error(`cannot read '${path}': ${err.message}`);
  }
}

async function connect(url) {
  let amqplib;
  try {
    amqplib = await import("amqplib");
  } catch {
    error("amqplib is required. Run: npm install amqplib");
  }
  const resolved = url || process.env.RABBITMQ_URL || "amqp://localhost";
  let conn;
  try {
    conn = await amqplib.connect(resolved);
  } catch (err) {
    error(`cannot connect to RabbitMQ at '${resolved}': ${err.message}`);
  }
  conn.on("error", () => {});
  return conn;
}

async function getChannel(conn) {
  const ch = await conn.createChannel();
  ch.on("error", () => {});
  return ch;
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DLQ_FLAGS_WITH_VALUE = new Set(["--url", "--limit", "--routing-key"]);
const DLQ_FLAGS = new Set([...DLQ_FLAGS_WITH_VALUE, "--dry-run"]);

function dlqPositionals(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) {
      out.push(a);
      continue;
    }
    if (!DLQ_FLAGS.has(a)) error(`Unknown option: '${a}'`);
    if (DLQ_FLAGS_WITH_VALUE.has(a) && argValue(args, a) === undefined)
      error(`Option '${a}' requires a value`);
    if (DLQ_FLAGS_WITH_VALUE.has(a)) i++;
  }
  return out;
}

function formatHeaderValue(v) {
  if (v === null || v === undefined) return String(v);
  if (Buffer.isBuffer(v)) return v.toString("utf8");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatMessage(msg) {
  const fields = {
    deliveryTag: msg.fields.deliveryTag,
    routingKey: msg.fields.routingKey,
    exchange: msg.fields.exchange,
    redelivered: msg.fields.redelivered,
  };
  const props = {};
  for (const [k, v] of Object.entries(msg.properties)) {
    if (v != null && k !== "headers") props[k] = v;
  }
  let body;
  try {
    body = JSON.parse(msg.content.toString());
  } catch {
    body = msg.content.toString();
  }
  return { fields, properties: props, headers: msg.properties.headers, body };
}

// ── diff logic ────────────────────────────────────────────────────────

function exchangeKey(e) {
  return `${e.name}:${e.type}`;
}
function queueKey(q) {
  return q.name;
}
function bindingKey(b) {
  const args =
    b.arguments != null
      ? JSON.stringify(b.arguments, Object.keys(b.arguments).sort())
      : "";
  return `${b.queue}:${b.exchange}:${b.routingKey}:${args}`;
}

function indexBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) map.set(keyFn(item), item);
  return map;
}

function formatExchange(e) {
  const parts = [`${e.name} (${e.type}`];
  if (e.durable) parts.push("durable");
  if (e.options && Object.keys(e.options).length > 0)
    parts.push(`opts=${JSON.stringify(e.options)}`);
  return parts.join(", ") + ")";
}

function formatQueue(q) {
  const parts = [q.name];
  if (q.durable) parts.push("durable");
  if (q.passive) parts.push("passive");
  if (q.arguments && Object.keys(q.arguments).length > 0)
    parts.push(`args=${JSON.stringify(q.arguments)}`);
  if (q.options && Object.keys(q.options).length > 0)
    parts.push(`opts=${JSON.stringify(q.options)}`);
  return parts.join(" ");
}

function formatBinding(b) {
  let s = `${b.queue} \u2192 ${b.exchange}`;
  if (b.routingKey) s += ` [routingKey: "${b.routingKey}"]`;
  if (b.arguments && Object.keys(b.arguments).length > 0)
    s += ` args=${JSON.stringify(b.arguments)}`;
  return s;
}

function diffPlans(a, b) {
  const aExs = indexBy(a.exchanges, exchangeKey);
  const bExs = indexBy(b.exchanges, exchangeKey);
  const aQs = indexBy(a.queues, queueKey);
  const bQs = indexBy(b.queues, queueKey);
  const aBs = indexBy(a.bindings, bindingKey);
  const bBs = indexBy(b.bindings, bindingKey);

  const lines = [];

  const onlyInAEx = a.exchanges.filter((e) => !bExs.has(exchangeKey(e)));
  const onlyInBEx = b.exchanges.filter((e) => !aExs.has(exchangeKey(e)));
  if (onlyInAEx.length > 0) {
    lines.push("# Exchanges only in first plan (new):");
    for (const e of onlyInAEx) lines.push(`+ ${formatExchange(e)}`);
    lines.push("");
  }
  if (onlyInBEx.length > 0) {
    lines.push("# Exchanges only in second plan (missing):");
    for (const e of onlyInBEx) lines.push(`- ${formatExchange(e)}`);
    lines.push("");
  }

  const onlyInAQ = a.queues.filter((q) => !bQs.has(queueKey(q)));
  const onlyInBQ = b.queues.filter((q) => !aQs.has(queueKey(q)));
  if (onlyInAQ.length > 0) {
    lines.push("# Queues only in first plan (new):");
    for (const q of onlyInAQ) lines.push(`+ ${formatQueue(q)}`);
    lines.push("");
  }
  if (onlyInBQ.length > 0) {
    lines.push("# Queues only in second plan (missing):");
    for (const q of onlyInBQ) lines.push(`- ${formatQueue(q)}`);
    lines.push("");
  }

  const onlyInAB = a.bindings.filter((b) => !bBs.has(bindingKey(b)));
  const onlyInBB = b.bindings.filter((b) => !aBs.has(bindingKey(b)));
  if (onlyInAB.length > 0) {
    lines.push("# Bindings only in first plan (new):");
    for (const b of onlyInAB) lines.push(`+ ${formatBinding(b)}`);
    lines.push("");
  }
  if (onlyInBB.length > 0) {
    lines.push("# Bindings only in second plan (missing):");
    for (const b of onlyInBB) lines.push(`- ${formatBinding(b)}`);
    lines.push("");
  }

  if (lines.length === 0) {
    lines.push("# Plans are identical.");
  }

  return lines.join("\n");
}

// ── validate command ──────────────────────────────────────────────────

async function cmdValidate(planPath, amqpUrl) {
  const plan = readJSON(planPath);

  if (!plan.exchanges || !plan.queues || !plan.bindings) {
    error("invalid topology plan: expected { exchanges, queues, bindings }");
  }

  const conn = await connect(amqpUrl);
  const issues = [];
  let valid = true;

  async function checkExchange(name) {
    let ch;
    try {
      ch = await getChannel(conn);
      await ch.checkExchange(name);
    } catch (err) {
      const code = err && (err.code ?? err?.constructor?.name);
      const is404 =
        code === 404 || String(err.message ?? "").includes("404");
      issues.push({
        type: is404 ? "missing_exchange" : "validation_error",
        exchange: name,
        message: is404
          ? `Exchange '${name}' not found`
          : `Exchange '${name}' check failed: ${err.message}`,
      });
      valid = false;
    } finally {
      if (ch) try { await ch.close(); } catch {}
    }
  }

  async function checkQueue(name) {
    let ch;
    try {
      ch = await getChannel(conn);
      await ch.checkQueue(name);
    } catch (err) {
      const code = err && (err.code ?? err?.constructor?.name);
      const is404 =
        code === 404 || String(err.message ?? "").includes("404");
      issues.push({
        type: is404 ? "missing_queue" : "validation_error",
        queue: name,
        message: is404
          ? `Queue '${name}' not found`
          : `Queue '${name}' check failed: ${err.message}`,
      });
      valid = false;
    } finally {
      if (ch) try { await ch.close(); } catch {}
    }
  }

  for (const ex of plan.exchanges) await checkExchange(ex.name);
  for (const q of plan.queues) await checkQueue(q.name);
  for (const b of plan.bindings) {
    issues.push({
      type: "binding_not_validated",
      queue: b.queue,
      exchange: b.exchange,
      routingKey: b.routingKey,
      message: `Binding '${b.queue}' \u2192 '${b.exchange}' [${b.routingKey}] not validated (AMQP has no passive binding check)`,
    });
  }

  await conn.close();

  const result = { valid, issues };
  console.log(JSON.stringify(result, null, 2));

  if (!result.valid) process.exit(1);
}

// ── plan command ──────────────────────────────────────────────────────

async function cmdPlan(scriptPath, outputPath) {
  const absPath = resolve(scriptPath);

  let setupFn;
  try {
    const mod = await import(absPath);
    setupFn = mod.default || mod.setup;
  } catch (err) {
    error(
      `cannot load '${absPath}': ${err.message}\n` +
        `The script must use ESM (.mjs) and export a default function or named export 'setup'.`
    );
  }

  if (typeof setupFn !== "function") {
    error(
      `'${absPath}' must export a default function or named export 'setup' that receives a broker.`
    );
  }

  let pkg;
  try {
    pkg = await import("../dist/esm/index.js");
  } catch {
    try {
      pkg = await import("@bitspacerlabs/rabbit-relay");
    } catch {
      error(
        "Cannot find rabbit-relay. Make sure it is installed or run from the package root."
      );
    }
  }

  const { RabbitMQBroker } = pkg;
  const broker = new RabbitMQBroker("rabbit-relay-cli", {
    topologyMode: "plan-only",
  });

  try {
    await setupFn(broker);
  } catch (err) {
    error(`setup script failed: ${err.message}`);
  }

  const plan = broker.planTopology();
  const json = JSON.stringify(plan, null, 2);

  if (outputPath) {
    writeFileSync(resolve(outputPath), json, "utf-8");
    console.log(`Plan written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

// ── dlq commands ──────────────────────────────────────────────────────

async function cmdDlqInspect(queue, amqpUrl) {
  const conn = await connect(amqpUrl);
  const ch = await getChannel(conn);

  let info;
  try {
    info = await ch.checkQueue(queue);
  } catch (err) {
    const is404 =
      (err.code ?? err?.constructor?.name) === 404 ||
      String(err.message ?? "").includes("404");
    error(is404 ? `Queue '${queue}' not found` : `Queue check failed: ${err.message}`);
  }

  await ch.close();
  await conn.close();

  console.log(JSON.stringify({ queue, ...info }, null, 2));
}

async function cmdDlqPeek(queue, limit, amqpUrl) {
  const conn = await connect(amqpUrl);
  const ch = await getChannel(conn);

  let info;
  try {
    info = await ch.checkQueue(queue);
  } catch (err) {
    const is404 =
      (err.code ?? err?.constructor?.name) === 404 ||
      String(err.message ?? "").includes("404");
    error(is404 ? `Queue '${queue}' not found` : `Queue check failed: ${err.message}`);
  }

  if (info.messageCount === 0) {
    console.log(`Queue '${queue}' is empty.`);
    try {
      await ch.close();
    } catch {}
    await conn.close();
    return;
  }

  const count = Math.min(limit, info.messageCount);
  const messages = [];

  for (let i = 0; i < count; i++) {
    const msg = await ch.get(queue, { noAck: false });
    if (!msg) break;
    messages.push(msg);
  }

  console.log(
    `Queue: ${queue} (${info.messageCount} available, showing ${messages.length})`
  );
  console.log("");

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const formatted = formatMessage(msg);

    console.log(`--- Message ${i + 1} ---`);
    console.log(`Exchange: ${formatted.fields.exchange}`);
    console.log(`Routing key: ${formatted.fields.routingKey}`);
    console.log(`Redelivered: ${formatted.fields.redelivered}`);

    if (formatted.properties.contentType)
      console.log(`Content-Type: ${formatted.properties.contentType}`);
    if (formatted.properties.messageId)
      console.log(`Message-ID: ${formatted.properties.messageId}`);
    if (formatted.properties.correlationId)
      console.log(`Correlation-ID: ${formatted.properties.correlationId}`);
    if (formatted.properties.timestamp)
      console.log(`Timestamp: ${formatted.properties.timestamp}`);

    if (formatted.headers && Object.keys(formatted.headers).length > 0) {
      console.log("Headers:");
      for (const [hk, hv] of Object.entries(formatted.headers)) {
        console.log(`  ${hk}: ${formatHeaderValue(hv)}`);
      }
    }

    console.log("Body:");
    console.log(JSON.stringify(formatted.body, null, 2));
    console.log("");
  }

  try {
    await ch.close();
  } catch {}
  await conn.close();
}

async function cmdDlqRedrive(fromQueue, toExchange, opts) {
  const conn = await connect(opts.url);
  const ch = await getChannel(conn);

  let pkg;
  try {
    pkg = await import("../dist/esm/index.js");
  } catch {
    try {
      pkg = await import("@bitspacerlabs/rabbit-relay");
    } catch {
      error("Cannot find rabbit-relay. Run from the package root.");
    }
  }

  const result = await pkg.redriveDlq(ch, {
    fromQueue,
    toExchange,
    routingKey: opts.routingKey,
    limit: opts.limit,
    dryRun: opts.dryRun,
  });

  await ch.close();
  await conn.close();

  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) process.exit(1);
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    usage();
  }

  const cmd = args[0];

  if (!commands.includes(cmd)) {
    console.error(`Unknown command: '${cmd}'`);
    usage(1);
  }

  if (cmd === "plan") {
    const script = args[1];
    if (!script) error("plan requires a script path");
    const output = argValue(args, "--output");
    await cmdPlan(script, output);
    return;
  }

  if (cmd === "validate") {
    const planPath = args[1];
    if (!planPath) error("validate requires a plan JSON file path");
    const url = argValue(args, "--url");
    await cmdValidate(planPath, url);
    return;
  }

  if (cmd === "diff") {
    const aPath = args[1];
    const bPath = args[2];
    if (!aPath || !bPath) error("diff requires two plan JSON file paths");
    const a = readJSON(aPath);
    const b = readJSON(bPath);
    console.log(diffPlans(a, b));
    return;
  }

  if (cmd === "dlq") {
    const sub = args[1];
    if (!sub || sub === "help") {
      console.log(
        [
          "DLQ commands:",
          "",
          "  rabbit-relay dlq inspect <queue> [--url <amqp-url>]",
          "    Show queue depth and message statistics.",
          "",
          "  rabbit-relay dlq peek <queue> [--limit N] [--url <amqp-url>]",
          "    View messages in a DLQ without removing them.",
          "",
          "  rabbit-relay dlq redrive <from-queue> <to-exchange> [options]",
          "    Redrive messages from a DLQ to a target exchange.",
          "",
          "Options:",
          "  --url <amqp-url>       RabbitMQ connection URL",
          "  --limit <N>            Max messages (default 100)",
          "  --routing-key <key>    Target routing key",
          "  --dry-run              Validate without consuming",
        ].join("\n")
      );
      return;
    }

    const url = argValue(args, "--url");
    const pos = dlqPositionals(args).slice(2);

    if (sub === "inspect") {
      const queue = pos[0];
      if (!queue) error("dlq inspect requires a queue name");
      await cmdDlqInspect(queue, url);
      return;
    }

    if (sub === "peek") {
      const queue = pos[0];
      if (!queue) error("dlq peek requires a queue name");
      const limit = parseInt(argValue(args, "--limit") || "1", 10);
      if (!Number.isFinite(limit) || limit < 1)
        error("--limit must be a positive number");
      await cmdDlqPeek(queue, Math.min(limit, 100), url);
      return;
    }

    if (sub === "redrive") {
      const fromQueue = pos[0];
      const toExchange = pos[1];
      if (!fromQueue || !toExchange)
        error("dlq redrive requires <from-queue> <to-exchange>");
      const limit = parseInt(argValue(args, "--limit") || "100", 10);
      const routingKey = argValue(args, "--routing-key");
      const dryRun = args.includes("--dry-run");
      await cmdDlqRedrive(fromQueue, toExchange, {
        url,
        limit,
        routingKey,
        dryRun,
      });
      return;
    }

    error(`Unknown dlq subcommand: '${sub}'`);
  }
}

main().catch((err) => {
  console.error(`[rabbit-relay] unexpected error:`, err);
  process.exit(1);
});
