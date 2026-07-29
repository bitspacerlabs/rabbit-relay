const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const {
  RabbitMQConnectionManager,
} = require("../../dist/cjs/config.js");

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeChannel() {
  const channel = new EventEmitter();
  channel.closeCalls = 0;
  channel.close = async () => {
    channel.closeCalls++;
    channel.emit("close");
  };
  return channel;
}

async function raceCloseWithChannelCreation(kind) {
  const opening = deferred();
  const connection = new EventEmitter();
  const channel = fakeChannel();

  connection.close = async () => connection.emit("close");
  connection.createChannel = async () => opening.promise;
  connection.createConfirmChannel = async () => opening.promise;

  const manager = new RabbitMQConnectionManager({
    connector: async () => connection,
  });

  let channelPromise;
  if (kind === "regular") channelPromise = manager.getChannel();
  else if (kind === "confirm") channelPromise = manager.getConfirmChannel();
  else if (kind === "disposable") channelPromise = manager.createChannel();
  else {
    const session = await manager.createValidationSession();
    channelPromise = session.createChannel();
  }

  await new Promise((resolve) => setImmediate(resolve));
  await manager.close();
  opening.resolve(channel);

  await assert.rejects(channelPromise, /is closed/);
  assert.equal(channel.closeCalls, 1);
}

test("closes a regular channel that resolves after manager shutdown", async () => {
  await raceCloseWithChannelCreation("regular");
});

test("closes a confirm channel that resolves after manager shutdown", async () => {
  await raceCloseWithChannelCreation("confirm");
});

test("closes a disposable channel that resolves after manager shutdown", async () => {
  await raceCloseWithChannelCreation("disposable");
});

test("closes an isolated validation channel that resolves after manager shutdown", async () => {
  await raceCloseWithChannelCreation("isolated");
});

test("concurrent manager close calls await the same shutdown", async () => {
  const closing = deferred();
  const connection = new EventEmitter();
  connection.close = () => closing.promise;

  const manager = new RabbitMQConnectionManager({
    connector: async () => connection,
  });
  await manager.getConnection();

  const firstClose = manager.close();
  const secondClose = manager.close();
  assert.equal(firstClose, secondClose);

  let completed = false;
  void secondClose.then(() => {
    completed = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);

  closing.resolve();
  await Promise.all([firstClose, secondClose]);
  assert.equal(completed, true);
});

test("validation session reuses one isolated connection across channels", async () => {
  let connectorCalls = 0;
  let channelCalls = 0;
  const connection = new EventEmitter();
  connection.close = async () => connection.emit("close");
  connection.createChannel = async () => {
    channelCalls++;
    return fakeChannel();
  };

  const manager = new RabbitMQConnectionManager({
    connector: async () => {
      connectorCalls++;
      return connection;
    },
  });

  const session = await manager.createValidationSession();
  const first = await session.createChannel();
  const second = await session.createChannel();
  await first.close();
  await second.close();
  await session.close();
  await manager.close();

  assert.equal(connectorCalls, 1);
  assert.equal(channelCalls, 2);
});
