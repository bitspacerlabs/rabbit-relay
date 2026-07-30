#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspect } from "node:util";

const commands = ["plan", "validate", "diff", "help"];

function usage(exitCode = 0) {
  console.log(
    [
      "Rabbit Relay topology CLI",
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
      "  rabbit-relay help",
      "    Show this help message.",
      "",
      "Examples:",
      "  rabbit-relay plan ./setup.mjs > plan.json",
      "  rabbit-relay validate plan.json --url amqp://localhost",
      "  rabbit-relay diff plan.json plan.production.json",
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
  let s = `${b.queue} → ${b.exchange}`;
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

  let amqplib;
  try {
    amqplib = await import("amqplib");
  } catch {
    error("amqplib is required for validation. Run: npm install amqplib");
  }

  const url = amqpUrl || process.env.RABBITMQ_URL || "amqp://localhost";
  let conn;
  try {
    conn = await amqplib.connect(url);
  } catch (err) {
    error(`cannot connect to RabbitMQ at '${url}': ${err.message}`);
  }

  conn.on("error", () => {});
  const issues = [];
  let valid = true;

  async function checkExchange(name) {
    let ch;
    try {
      ch = await conn.createChannel();
      ch.on("error", () => {});
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
      ch = await conn.createChannel();
      ch.on("error", () => {});
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

  for (const ex of plan.exchanges) {
    await checkExchange(ex.name);
  }

  for (const q of plan.queues) {
    await checkQueue(q.name);
  }

  for (const b of plan.bindings) {
    issues.push({
      type: "binding_not_validated",
      queue: b.queue,
      exchange: b.exchange,
      routingKey: b.routingKey,
      message: `Binding '${b.queue}' → '${b.exchange}' [${b.routingKey}] not validated (AMQP has no passive binding check)`,
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

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    usage();
  }

  const cmd = args[0];

  if (!commands.includes(cmd) || cmd === "help") {
    console.error(`Unknown command: '${cmd}'`);
    usage(1);
  }

  if (cmd === "plan") {
    const script = args[1];
    if (!script) error("plan requires a script path");
    const outputIdx = args.indexOf("--output");
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    await cmdPlan(script, output);
    return;
  }

  if (cmd === "validate") {
    const planPath = args[1];
    if (!planPath) error("validate requires a plan JSON file path");
    const urlIdx = args.indexOf("--url");
    const url = urlIdx !== -1 ? args[urlIdx + 1] : undefined;
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
}

main().catch((err) => {
  console.error(`[rabbit-relay] unexpected error:`, err);
  process.exit(1);
});
