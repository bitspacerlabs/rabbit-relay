# Changelog

All notable changes to Rabbit Relay will be documented in this file.

This project follows semantic versioning.

---

## [Unreleased]

### Documentation

- Replaced VitePress documentation site with Fumadocs (Next.js 16 +
  Tailwind 4) deployed to GitHub Pages at `/rabbit-relay/docs/`.
- Redesigned docs with LLM Gateway-inspired layout: compact cards, Clerk-
  style table of contents, indigo theme, responsive sidebar.
- Added `llms.txt` and `llms-full.txt` route handlers for machine-readable
  documentation.
- Added OpenGraph image generation for all doc pages.
- Generated redirect pages for old VitePress URLs for backward
  compatibility.
- Added installable AI coding skills package reference (`ai-skills` page).
- Removed old VitePress configuration, theme, and unused public assets.

### Changed

- CI workflow now builds Fumadocs from `website/` directory.
- Deploy workflow builds Fumadocs static export and restructures for
  GitHub Pages with `basePath: /rabbit-relay`.
- Updated `package.json` docs scripts to use Fumadocs (`docs:dev`,
  `docs:build`, `docs:preview`).
- Updated `.gitignore` for website build artifacts (`website/.next`,
  `website/out`, `website/tsconfig.tsbuildinfo`).
- Removed dead files: `website/proxy.ts`, `website/src/components/ai/search.tsx`,
  stale VitePress cache entry from `.gitignore`.

### Added

- `broker.exchange(name, config)` is now public and creates an
  exchange-only (publisher-only) broker interface: declares just the
  exchange with no queue, binding, or consumer. `consume()` throws on an
  exchange-only interface. Useful for producers that only publish and
  don't need to own queue topology.

---

## [1.5.0] - 2026-08-24

### Added

- `broker.queue(...).exchange(...)` now returns a thenable that also
  forwards `with()`, `handle()`, `use()`, `on()`, and `consume()`, so
  fluent chains need only one final `await`:
  `const api = await broker.queue("q").exchange("x", cfg).with({ myEvent });`.
  Plain `await` on the exchange result is unchanged; all existing code
  keeps working. (#45)

- `retry.backoff: "exponential"` for consumers: attempt n waits
  `delayMs * 2^(n-1)` between retries, using one broker-native TTL
  parking exchange/queue pair per attempt. `retry.delayMs` alone keeps
  the existing single fixed-delay queue; immediate retry is unchanged.
  `backoff` requires `delayMs`. (#46)

### Documentation

- Documented that `deadLetter.routingKey` drives two things when
  `autoDeclare: true`: the `x-dead-letter-routing-key` queue argument and
  the auto-declared DLQ→DLX binding key. Omitting it preserves original
  routing keys and binds the DLQ to `"#"`. Includes a warning against
  changing one side without the other. (#47)

---

## [1.4.0] - 2026-08-23

### Added

- Exported reusable type aliases `ExchangeType`, `RetryThenAction`, and
  `ErrorAction` from the package root. These match the option unions
  (`exchangeType`, `retry.then`, `onError`) so consumers whose config lives
  in plain `.js`/`.mjs` or JSON can reference them via JSDoc import types
  (`import("@bitspacerlabs/rabbit-relay").ExchangeType`) instead of
  hand-copying union members. (#36)
- Documented the plain JS / JSON config pattern with JSDoc aliases in the
  configuration guide.
- `handle("*", ...)` wildcard handlers now receive a discriminated union
  (`WildcardEvent<TEvents>`), so `switch (event.name)` narrows the payload
  per event without casts. Exact-name handler typing is unchanged.
  (#26)

### Fixed

- `planTopology()` and `rabbit-relay plan` now include dead-letter exchange,
  queue, and binding entries whenever a `deadLetter` config exists, instead
  of omitting them unless `deadLetter.autoDeclare` was true. The DLQ and its
  binding are included only when `deadLetter.queue` is set. (#33)

---

## [1.3.0] - 2026-08-22

### Added

- New lifecycle event `message.dropped` — emitted before silent ack when
  `retry.then = "ack"` exhausts attempts or when `onError = "ack"` fires
  directly. Previously these messages vanished with no signal for ops teams.
  (#28)
- New lifecycle event `topology.failed` — emitted when `assertQueue` /
  `assertExchange` / `assertBinding` fails during setup or reconnect, or
  when passive validation finds blocking issues. Errors still propagate
  after the event. (#27)
- New lifecycle event `topology.restored` — emitted after topology and
  consumers are fully restored on reconnect. Users should listen to this
  instead of `reconnect` for post-reconnection `withChannel` operations.
  (#25)
- New `binding` option on `ExchangeConfig` (default: `true`). Set to
  `false` to assert the exchange and queue without creating an initial
  binding — useful for apps that manage bindings dynamically at runtime
  via `withChannel()`. (#24)
- All three new lifecycle events are mapped in the OpenTelemetry adapter.

### Fixed

- `topology.failed` spans are recorded as errors in OpenTelemetry (with
  exception recording), matching the existing `publish.failed` behavior.
- `message.dropped` spans record the drop reason as an exception event.

### Backward Compatibility

- All public APIs remain unchanged.
- `binding` defaults to `true` — existing behavior is preserved.
- New lifecycle events are additive.
- `message.dropped` only fires on paths that previously acked silently —
  no change for `dead-letter` or `requeue` paths.

---

## [1.2.1] - 2026-08-21

### Added

- Added `@deprecated` JSDoc tags on `passiveQueue`, `produceMany`,
  `eventWithReply`, and `expectReply`, pointing to their modern replacements
  (`topologyMode`, `produce`, `request`).
- Added VitePress polish: editLink, lastUpdated, cleanUrls, sitemap,
  lineNumbers, OG/Twitter cards, npm social link, and feature-card hover.
- Added graceful shutdown (`SIGTERM`/`SIGINT` + `broker.close()`) to 25
  long-running examples.
- Added `scripts/run-examples.sh`: runs all 57 examples one by one and
  reports PASS/FAIL per file.

### Fixed

- Removed dead `maybeWaitForConfirms` export (was unused, never publicly
  exported).
- Unified UUID generation into `lib/uuid.ts` (was duplicated in
  `eventFactories.ts`).
- Fixed broken `topology-diff-cli` example (chained `.consume()` on a
  `Promise`).
- Completed lifecycle-hooks event table (was missing `handler.completed`
  and `message.dead-lettered`).
- Aligned `EventEnvelope` type snippets across docs pages.
- Fixed top-level `await` in `17-idempotent-consumer` examples (was
  unrunnable with `tsx` in CJS mode).
- Stripped stale `.html` suffixes from README and `llms.txt` URLs.

### Changed

- Consolidated documentation: merged `delayed-retry` into `retry-policy`,
  `dlq-redrive` into `dead-letter-queues`, and `topology-diff-cli` into
  `cli-reference` (3 fewer pages, less duplication).
- Trimmed `learn/retry-dlq-redrive.md` to a conceptual overview with
  cross-links instead of duplicating feature-page detail.
- Updated `AGENTS.md` and `llms.txt`: added CLI, test scripts, and
  examples runner to repo map; added CLI reference link.

### Backward Compatibility

- All public APIs remain unchanged.
- `@deprecated` tags are additive (JSDoc only, no behavior change).
- `maybeWaitForConfirms` was internal (not re-exported from `index.ts`).

---

## [1.2.0] - 2026-07-30

### Added

- Added a topology CLI with `plan`, `validate`, and `diff` commands for
  generating, validating, and comparing topology plans without running a
  consumer.
- Added DLQ CLI commands: `dlq inspect`, `dlq peek`, and `dlq redrive` for
  dead-letter queue inspection and message redrive with `--dry-run` support.
- Added `handler.completed` and `message.dead-lettered` lifecycle events with
  OpenTelemetry span and metric support.
- Added runtime schema support to event factories via `registerEventSchema` and
  `getEventSchema`; consumers now validate payloads against registered schemas
  when present.
- Added idempotent consumer example.
- Added delivery-semantics reference document.
- Added CLI reference documentation page.

### Fixed

- Improved error messages and diagnostics across consumer, publisher,
  reconnect, and broker paths for clearer actionable failures.

### Changed

- Expanded test coverage to every public runtime export, including event
  enrichment, plugin system, topology planning, OpenTelemetry, dedupe,
  broker config validation, non-JSON message handling, unmatched event
  acknowledgement, and reconnect callback isolation.

### Backward Compatibility

- All existing public APIs remain unchanged.
- New lifecycle events, CLI commands, and schema helpers are additive.

---

## [1.1.1] - 2026-07-29

### Fixed

- Landing page code example (`index.html`) now uses the correct `event()` and
  `produce()` API instead of an invalid chained `.publish(event(name, data))` call.
- Quickstart `traceFrom()` example now shows a real child-event usage pattern
  instead of a non-functional standalone `traceFrom()` call.

### Added

- Integration test coverage for message size guard, concurrent RPC, multi-event
  routing, and non-Error handler throws.

---

## [1.1.0] - 2026-07-28

### Added

- Added per-broker `connectionUrl` and `connectionName` options.
- Added `shutdownTimeoutMs` for bounded graceful consumer draining.
- Added live RabbitMQ integration coverage for publishing, confirms, RPC,
  retry, DLQ, redrive, reconnect, broker isolation, shutdown, and validation.
- Added deterministic connection-manager shutdown-race coverage.
- Added TypeScript declaration coverage for CommonJS and native ESM projects.
- Added CI coverage for Node.js 18, 20, 22, and 24.
- Added `AGENTS.md` and curated `llms.txt` guidance.

### Changed

- Each `RabbitMQBroker` now owns its RabbitMQ connection and channels.
- `broker.close()` no longer closes resources owned by other broker instances.
- Graceful shutdown waits for active handlers and requeues pending deliveries.
- Topology validation uses one isolated disposable connection per run and a
  fresh channel per resource so
  every missing exchange and queue is reported without poisoning operational
  channels after a failed passive check.
- Expanded packed-package coverage across every public runtime export.

### Fixed

- Fixed active handlers being interrupted when `broker.close()` returned.
- Fixed incomplete topology validation after the first missing resource.
- Fixed cross-broker connection teardown during independent shutdown.
- Fixed concurrent `broker.close()` calls bypassing active-handler draining.

### Backward Compatibility

- Existing constructor and exchange options remain supported.
- `RABBITMQ_URL` remains the default when `connectionUrl` is omitted.
- Public publishing, consuming, retry, RPC, topology, and operations APIs are
  unchanged.

---

## [1.0.1] - 2026-06-26

### Changed

- Published a version-only maintenance release after `1.0.0` with no runtime
  or public API changes.

---

## [1.0.0] - 2026-06-25

### Added

- First stable release of Rabbit Relay.
- Stable public API for typed RabbitMQ publishing, consuming, RPC, retries, DLQ, plugins, lifecycle hooks, topology planning, topology validation, health checks, and OpenTelemetry integration.

### Changed

- Stabilized Rabbit Relay public API for production use.
- Improved publish routing key behavior:
  - concrete configured `routingKey` values are used when publishing
  - topic wildcard bindings such as `#` and `demo.*` continue publishing by event name
- Clarified `.with(events)` as a typed publish API whose generated methods return promises.
- Updated README and docs for stable routing-key and `.with(...)` behavior.

### Fixed

- Fixed publishing behavior so concrete exchange routing keys are respected.
- Fixed `.with(events)` generated method return types to reflect async publish behavior.

### Notes

- This release is intended as the first production-ready stable release.
- Existing `0.9.0` and `1.0.0-rc.1` usage should continue to work.

---

## [1.0.0-rc.1] - 2026-06-25

### Added

- Release candidate for the first stable `1.0.0` release.
- Final pre-stable package validation for the Rabbit Relay public API.
- Release candidate documentation and package metadata updates.

### Changed

- Moved package version from `0.9.0` to `1.0.0-rc.1`.
- Prepared Rabbit Relay for stable release validation.

### Notes

- This release was marked as a pre-release / non-production release candidate.
- Users should prefer `1.0.0` for production use.

---

## [0.9.0] - 2026-05-16

### Added

#### Operations observability

- Added lifecycle hooks for broker operational events:
  - `reconnect`
  - `topology.asserted`
  - `consumer.started`
  - `consumer.stopped`
  - `publish.failed`
  - `retry.scheduled`
  - `broker.closed`
- Added `broker.on(...)` for registering lifecycle hooks.
- Added lifecycle hook support on returned broker interfaces.
- Added OpenTelemetry lifecycle adapter with `attachOpenTelemetry(...)`.
- Added support for user-provided OpenTelemetry tracer.
- Added detachable OpenTelemetry lifecycle listener handle.

#### Topology operations

- Added `planTopology()` to inspect the RabbitMQ topology Rabbit Relay intends to declare.
- Added broker-level topology planning with `broker.planTopology()`.
- Added interface-level topology planning with `sub.planTopology()`.
- Added `validateTopology()` for safe passive topology validation.
- Added broker-level topology validation with `broker.validateTopology()`.
- Added interface-level topology validation with `sub.validateTopology()`.
- Added topology validation result types and issue reporting.
- Added informational `binding_not_validated` issue type because AMQP does not expose a safe passive binding check through `amqplib`.

#### DLQ operations

- Added `redriveDlq(...)` helper for safely replaying messages from a DLQ.
- Added broker-level DLQ redrive with `broker.redriveDlq(...)`.
- Added interface-level DLQ redrive with `sub.redriveDlq(...)`.
- Added DLQ redrive `dryRun` mode.
- Added DLQ redrive `limit` option.
- Added redrive result summary with:
  - `available`
  - `attempted`
  - `republished`
  - `acked`
  - `failed`
  - `empty`
  - `errors`
- Added redrive metadata headers:
  - `x-rabbit-relay-redrive-count`
  - `x-rabbit-relay-redriven-at`
  - `x-rabbit-relay-redriven-from-queue`
  - `x-rabbit-relay-redriven-to-exchange`
  - `x-rabbit-relay-redriven-routing-key`

#### Retry reliability

- Added fixed delayed retry support using RabbitMQ TTL + DLX.
- Added `retry.delayMs` option for delayed retry.
- Added delayed retry topology using retry exchange and retry queue.
- Added retry delay metadata header:
  - `x-rabbit-relay-retry-delay-ms`

#### Examples

- Added delayed retry example:
  - `examples/10-delayed-retry`
- Added lifecycle hooks example:
  - `examples/11-lifecycle-hooks`
- Added OpenTelemetry adapter example:
  - `examples/12-opentelemetry`
- Added topology planner example:
  - `examples/13-topology-planner`
- Added topology validation example:
  - `examples/14-topology-validation`
- Added DLQ redrive example:
  - `examples/15-dlq-redrive`

#### Documentation

- Added documentation for delayed retry.
- Added documentation for lifecycle hooks.
- Added documentation for OpenTelemetry adapter.
- Added documentation for topology planner.
- Added documentation for topology validation.
- Added documentation for DLQ redrive.
- Updated quickstart, configuration, API, and feature docs for operations features.
- Updated VitePress sidebar with new operations pages and examples.

### Changed

- Updated retry behavior to support both immediate retry and fixed delayed retry.
- Updated retry health output to include `delayMs` when configured.
- Updated consumed event metadata hydration so AMQP headers are available in `event.meta.headers`.
- Updated operation examples and package usage checks.
- Updated documentation homepage to highlight operations visibility.

### Fixed

- Fixed consumed event metadata hydration so retry headers and RabbitMQ headers are visible to handlers.
- Fixed delayed retry attempt tracking so retried messages expose the correct retry count.
- Fixed DLQ redrive message typing by using `GetMessage` for `channel.get()` results.
- Fixed package usage coverage for new operations exports.

### Backward Compatibility

Rabbit Relay `0.9.0` is intended to be backward compatible with existing `0.8.0` public usage patterns.

Existing usage should continue to work:

- `produce(event)`
- `produceMany(...events)`
- `publish(event, options)`
- `request<TReply>(event, options)`
- `consume()`
- `consume({ prefetch, concurrency })`
- `consume({ onError: "retry" })`
- immediate retry without `delayMs`
- `.with({ eventFactory })`
- `publisherConfirms`
- RPC via `meta.expectsReply`
- plugin hooks
- middleware
- TTL dedupe
- message size guard
- native `amqplib` passthrough options
- `withChannel()`
- `broker.health()`
- `broker.close()`
- manual `queueArgs`
- existing RabbitMQ topology patterns

### Notes

- `validateTopology()` is intentionally passive and does not modify RabbitMQ.
- Binding validation is informational for now because AMQP does not expose a safe passive binding check through `amqplib`.
- `attachOpenTelemetry()` does not force OpenTelemetry as a runtime dependency; applications pass their own tracer.
- `redriveDlq()` is intentionally conservative and bounded by `limit`.
- Delayed retry uses RabbitMQ TTL + DLX and does not keep delayed messages in Node.js memory.
- RabbitMQ queue arguments are immutable. Existing queues may need to be recreated when changing DLQ, retry, or queue argument configuration.

---

## [0.8.0] - 2026-05-11

### Added

- Added typed RPC request API with `request<TReply>()`.
- Added local consumer middleware with `sub.use(...)`.
- Added metadata helper utilities:
  - `withMeta(...)`
  - `withHeaders(...)`
  - `withCorrelation(...)`
  - `withCausation(...)`
  - `traceFrom(...)`
- Added consumer-side de-duplication option through `consume({ dedupe })`.
- Added message size guard with `maxMessageBytes`.
- Added typed `MessageTooLargeError`.
- Added OpenTelemetry-friendly tracing metadata helpers.
- Added developer experience example:
  - `examples/09-developer-experience`

### Changed

- Improved event metadata handling for headers, correlation IDs, and causation IDs.
- Improved package usage tests for ESM import, CommonJS require, and TypeScript API usage.
- Updated documentation for developer experience APIs.
- Updated examples to demonstrate middleware, tracing helpers, dedupe, RPC, and message size guard.

### Fixed

- Fixed de-duplication config typing for built-in dedupe options.
- Fixed package usage validation to ensure ESM and CommonJS consumers can import the package correctly.

### Backward Compatibility

Rabbit Relay `0.8.0` is intended to be backward compatible with `0.7.0`.

Existing usage should continue to work:

- `produce(event)`
- `produceMany(...events)`
- `publish(event, options)`
- `consume()`
- `consume({ prefetch, concurrency })`
- `consume({ onError: "retry" })`
- `.with({ eventFactory })`
- `publisherConfirms`
- RPC via `meta.expectsReply`
- plugin hooks
- TTL dedupe helper
- manual `queueArgs`
- built-in DLQ helper
- `broker.health()`
- `broker.close()`
- native `amqplib` passthrough options

### Notes

- `request<TReply>()` is the recommended RPC API for new code.
- Metadata helpers are additive and do not replace manual `event.meta` usage.
- Built-in consumer dedupe is in-memory and process-local.
- Message size guard checks the serialized event envelope before publishing.

---

## [0.7.0] - 2026-05-06

### Added

- Added native `amqplib` passthrough options for advanced RabbitMQ usage.
- Added queue-level native AMQP options through `queue(..., { amqp })`.
- Added exchange-level native AMQP options through `exchange(..., { amqp })`.
- Added binding argument passthrough with `amqp.bind`.
- Added native consume options through `consume({ amqp: { consume } })`.
- Added `publish(event, options)` for per-message AMQP publish options.
- Added `withChannel()` for raw `amqplib` channel access.
- Added `broker.close()` for graceful shutdown.
- Added real consumer concurrency control separate from RabbitMQ `prefetch`.
- Added bounded retry policy with `onError: "retry"`.
- Added retry metadata headers:
  - `x-rabbit-relay-retry-count`
  - `x-rabbit-relay-first-failed-at`
  - `x-rabbit-relay-last-failed-at`
  - `x-rabbit-relay-last-error`
- Added built-in dead-letter queue helper with `deadLetter` config.
- Added `broker.health()` for runtime health checks.
- Added health state for connection, channel, confirm channel, reconnect status, and consumers.
- Added production-core documentation pages.
- Added new examples:
  - `examples/06-retry-dlq`
  - `examples/07-escape-hatch`
  - `examples/08-health-shutdown`

### Changed

- Improved confirm-channel publishing behavior.
- Improved publisher confirm compatibility with `amqplib`.
- Updated DLQ example to use the built-in `deadLetter` helper.
- Updated backpressure documentation to explain `prefetch` and real `concurrency`.
- Updated configuration, quickstart, and API documentation for production-core features.
- Updated examples index and VitePress sidebar for new examples.
- Changed RPC correlation ID generation to use `crypto.randomUUID()`.

### Fixed

- Fixed `eventWithReply()` so it marks events as expecting replies.
- Fixed native publish option handling for RPC-style messages.
- Fixed example documentation paths for the dedupe example.
- Fixed backpressure example environment variable documentation.

### Backward Compatibility

Rabbit Relay `0.7.0` is intended to be backward compatible with `0.6.1` public usage patterns.

Existing usage should continue to work:

- `produce(event)`
- `produceMany(...events)`
- `consume()`
- `consume({ prefetch, concurrency })`
- `.with({ eventFactory })`
- `publisherConfirms`
- RPC via `meta.expectsReply`
- plugin hooks
- TTL dedupe helper
- manual `queueArgs`
- existing RabbitMQ topology patterns

### Notes

- Retry is currently immediate retry. Delayed retry queues may be added in a future release.
- `broker.close()` closes the shared Rabbit Relay RabbitMQ connection in the current Node.js process.
- RabbitMQ queue arguments are immutable. Existing queues may need to be recreated when changing DLQ or queue argument configuration.

---

## [0.6.1] - Previous Release

### Notes

- Previous stable release before production-core improvements.
