# Changelog

All notable changes to Rabbit Relay will be documented in this file.

This project follows semantic versioning while the API is stabilizing toward `1.0.0`.

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