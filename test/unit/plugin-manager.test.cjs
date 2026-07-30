const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PluginManager,
  pluginManager: sharedManager,
} = require("../../dist/cjs/index.js");

test("PluginManager registers and executes beforeProduce hooks", async () => {
  const manager = new PluginManager();
  const calls = [];

  manager.register({
    beforeProduce: async (event) => {
      calls.push({ hook: "beforeProduce", name: event.name });
    },
  });

  await manager.executeHook("beforeProduce", { name: "test.event", data: {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hook, "beforeProduce");
  assert.equal(calls[0].name, "test.event");
});

test("PluginManager registers and executes afterProduce hooks", async () => {
  const manager = new PluginManager();
  const calls = [];

  manager.register({
    afterProduce: async (event, result) => {
      calls.push({ hook: "afterProduce", result });
    },
  });

  await manager.executeHook("afterProduce", { name: "test" }, "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, "ok");
});

test("PluginManager registers and executes beforeProcess hooks", async () => {
  const manager = new PluginManager();
  const calls = [];

  manager.register({
    beforeProcess: async (id, event) => {
      calls.push({ id, name: event.name });
    },
  });

  await manager.executeHook("beforeProcess", 42, { name: "test" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 42);
  assert.equal(calls[0].name, "test");
});

test("PluginManager registers and executes afterProcess hooks", async () => {
  const manager = new PluginManager();
  const calls = [];

  manager.register({
    afterProcess: async (id, event, result) => {
      calls.push({ id, name: event.name, result });
    },
  });

  await manager.executeHook("afterProcess", 1, { name: "test" }, "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 1);
  assert.equal(calls[0].result, "ok");
});

test("PluginManager runs hooks on all registered plugins in order", async () => {
  const manager = new PluginManager();
  const order = [];

  manager.register({
    beforeProduce: async () => { order.push("first"); },
  });
  manager.register({
    beforeProduce: async () => { order.push("second"); },
  });

  await manager.executeHook("beforeProduce", {});
  assert.deepEqual(order, ["first", "second"]);
});

test("PluginManager does not fail when plugin lacks hook method", async () => {
  const manager = new PluginManager();
  manager.register({});
  // Should not throw
  await manager.executeHook("beforeProduce", {});
});

test("PluginManager does not fail when plugin hook throws", async () => {
  const manager = new PluginManager();
  manager.register({
    beforeProduce: async () => { throw new Error("hook error"); },
  });
  // Should not propagate the error
  await manager.executeHook("beforeProduce", {});
});

test("PluginManager allows mixing plugins with different hooks", async () => {
  const manager = new PluginManager();
  const beforeCalls = [];
  const afterCalls = [];

  manager.register({
    beforeProduce: async () => { beforeCalls.push("called"); },
    afterProduce: async () => { afterCalls.push("called"); },
  });

  await manager.executeHook("beforeProduce", {});
  assert.equal(beforeCalls.length, 1);
  assert.equal(afterCalls.length, 0);

  await manager.executeHook("afterProduce", {}, "ok");
  assert.equal(afterCalls.length, 1);
});

test("PluginManager does not fail when with no plugins registered", async () => {
  const manager = new PluginManager();
  await manager.executeHook("beforeProduce", {});
  await manager.executeHook("afterProduce", {}, "ok");
  await manager.executeHook("beforeProcess", 1, {});
  await manager.executeHook("afterProcess", 1, {}, "ok");
});

test("shared pluginManager singleton is an instance of PluginManager", () => {
  assert.ok(sharedManager instanceof PluginManager);
  assert.equal(typeof sharedManager.register, "function");
  assert.equal(typeof sharedManager.executeHook, "function");
});

test("shared pluginManager can register and execute hooks", async () => {
  const manager = new PluginManager();
  let called = false;
  manager.register({
    beforeProduce: async () => { called = true; },
  });
  await manager.executeHook("beforeProduce", { name: "test" });
  assert.equal(called, true);
});
