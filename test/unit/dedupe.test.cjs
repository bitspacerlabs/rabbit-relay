const test = require("node:test");
const assert = require("node:assert/strict");

const {
  makeMemoryDedupe,
} = require("../../dist/cjs/index.js");

test("makeMemoryDedupe treats a new string as not seen", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember("id-1"), true);
});

test("makeMemoryDedupe returns false for a duplicate string", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  dedupe.checkAndRemember("id-1");
  assert.equal(dedupe.checkAndRemember("id-1"), false);
});

test("makeMemoryDedupe treats different strings as unique", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  dedupe.checkAndRemember("id-1");
  assert.equal(dedupe.checkAndRemember("id-2"), true);
});

test("makeMemoryDedupe seen() returns true for known id", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  dedupe.checkAndRemember("known-id");
  assert.equal(dedupe.seen("known-id"), true);
});

test("makeMemoryDedupe seen() returns false for unknown id", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.seen("unknown"), false);
});

test("makeMemoryDedupe seen() returns false after TTL expires", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 1 });
  dedupe.checkAndRemember("expiring-id");
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(dedupe.seen("expiring-id"), false);
      resolve();
    }, 10);
  });
});

test("makeMemoryDedupe checkAndRemember with object using id field", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember({ id: "obj-1" }), true);
  assert.equal(dedupe.checkAndRemember({ id: "obj-1" }), false);
});

test("makeMemoryDedupe checkAndRemember with object using meta.id field", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember({ meta: { id: "meta-id" } }), true);
  assert.equal(dedupe.checkAndRemember({ meta: { id: "meta-id" } }), false);
});

test("makeMemoryDedupe checkAndRemember with object using meta.headers.messageId", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  const obj = { meta: { headers: { messageId: "header-id" } } };
  assert.equal(dedupe.checkAndRemember(obj), true);
  assert.equal(dedupe.checkAndRemember(obj), false);
});

test("makeMemoryDedupe checkAndRemember with object using meta.corrId", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember({ meta: { corrId: "corr-id" } }), true);
  assert.equal(dedupe.checkAndRemember({ meta: { corrId: "corr-id" } }), false);
});

test("makeMemoryDedupe checkAndRemember returns true when object has no identifiable id", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember({ data: "no-id-field" }), true);
});

test("makeMemoryDedupe checkAndRemember returns true for null/undefined", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.checkAndRemember(null), true);
  assert.equal(dedupe.checkAndRemember(undefined), true);
});

test("makeMemoryDedupe size() returns correct count", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000 });
  assert.equal(dedupe.size(), 0);
  dedupe.checkAndRemember("a");
  assert.equal(dedupe.size(), 1);
  dedupe.checkAndRemember("b");
  assert.equal(dedupe.size(), 2);
  dedupe.checkAndRemember("a"); // duplicate
  assert.equal(dedupe.size(), 2);
});

test("makeMemoryDedupe gc() evicts expired entries", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: -1 }); // already expired
  dedupe.checkAndRemember("will-expire");
  // seen() triggers lazy deletion on expired keys
  assert.equal(dedupe.seen("will-expire"), false);
});

test("makeMemoryDedupe custom keyOf function is used", () => {
  const dedupe = makeMemoryDedupe({
    ttlMs: 60_000,
    keyOf: (e) => e.customId,
  });
  assert.equal(dedupe.checkAndRemember({ customId: "custom-1" }), true);
  assert.equal(dedupe.checkAndRemember({ customId: "custom-1" }), false);
});

test("makeMemoryDedupe gc evicts oldest entries when maxKeys exceeded", () => {
  const dedupe = makeMemoryDedupe({ ttlMs: 60_000, maxKeys: 3 });
  dedupe.checkAndRemember("a");
  dedupe.checkAndRemember("b");
  dedupe.checkAndRemember("c");
  // gc runs inside remember() before adding the new entry,
  // so we need 4 entries in the map before maxKeys=3 triggers eviction
  dedupe.checkAndRemember("d"); // gc sees size=3, not > 3, so no eviction yet
  dedupe.checkAndRemember("e"); // gc sees size=4 > 3, evicts oldest ("a")
  // "a" should be evicted
  assert.equal(dedupe.seen("a"), false);
  // newer entries should still be known
  assert.equal(dedupe.seen("e"), true);
  assert.equal(dedupe.size(), 4); // a evicted, d and e present
});

test("makeMemoryDedupe with keyOf returning undefined treats as new", () => {
  const dedupe = makeMemoryDedupe({
    ttlMs: 60_000,
    keyOf: () => undefined,
  });
  assert.equal(dedupe.checkAndRemember("anything"), true);
});
