# Rabbit Relay agent instructions

Rabbit Relay is a stable, type-safe RabbitMQ framework for Node.js. It builds on
`amqplib` and deliberately keeps exchanges, queues, bindings, routing keys,
acknowledgements, retries, dead-letter queues, confirms, and topology ownership
explicit.

## Before changing the project

1. Read `docs/ai/agent-guide.md` for API and reliability guidance.
2. Read the closest relevant guide in `docs/` before changing public behavior.
3. Preserve the public API unless the task explicitly requires an API change.

## Repository map

- `lib/` - TypeScript package source and public runtime behavior
- `lib/index.ts` - public exports
- `bin/rabbit-relay.mjs` - topology and DLQ CLI (plan, validate, diff, dlq)
- `website/` - Fumadocs documentation site (Next.js)
- `docs/` - Markdown files shipped with npm package (AI guides, API reference)
- `examples/` - runnable patterns that should agree with the documentation
- `scripts/test-package-usage.sh` - packed ESM/CommonJS consumer smoke test
- `scripts/test-real-usage.sh` - end-to-end live RabbitMQ test
- `scripts/run-examples.sh` - runs all examples one by one and reports pass/fail

## Change rules

- Prefer small, focused, backward-compatible changes.
- Do not hide RabbitMQ behavior behind implicit abstractions.
- Do not add dependencies or public APIs without a clear need.
- Always await `produce()`, `publish()`, and `request()` in examples.
- Prefer typed event factories, bounded retries, DLQs, publisher confirms for
  important messages, explicit prefetch/concurrency, and graceful shutdown.
- Treat delivery as at-least-once and make idempotency requirements clear.
- Keep docs, examples, and machine-readable LLM documentation synchronized.

## Validation

Run the checks appropriate to the files changed:

```bash
npm run build
npm run test:package
npm run test:unit
npm run test:integration
npm run test:real-usage
npm run docs:build
bash scripts/run-examples.sh
```

For release-sensitive package changes, also run:

```bash
npm pack --dry-run
```
