# Changelog

All notable changes to Rabbit Relay will be documented in this file.

This project follows semantic versioning while the API is stabilizing toward `1.0.0`.

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