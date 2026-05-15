# Lifecycle Hooks

This example demonstrates Rabbit Relay lifecycle hooks.

Lifecycle hooks are useful for:

- logging
- metrics
- OpenTelemetry
- operational visibility
- debugging production behavior

---

## What it shows

This example listens to:

- `topology.asserted`
- `consumer.started`
- `retry.scheduled`
- `consumer.stopped`
- `publish.failed`
- `broker.closed`

---

## Run

Start RabbitMQ:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run the example:

```bash
npx ts-node-dev --transpile-only examples/11-lifecycle-hooks/service.ts
```

---

## Expected output

You should see lifecycle events like:

```text
[lifecycle] topology.asserted ...
[lifecycle] consumer.started ...
[handler] received { jobId: 'job-ok' }
[handler] success job-ok
[handler] received { jobId: 'job-fail', shouldFail: true }
[lifecycle] retry.scheduled ...
```

After retries are exhausted, the failed job is routed according to the configured failure policy.

Press `Ctrl+C` and you should see:

```text
[service] received SIGINT
[lifecycle] consumer.stopped ...
[lifecycle] broker.closed ...
[service] shutdown complete
```

---

## Example

```ts
broker.on("consumer.started", (event) => {
  console.log(event.queue);
});

broker.on("retry.scheduled", (event) => {
  console.log(event.retryCount, event.delayMs);
});
```

---

## Notes

Lifecycle hooks are local to the broker instance.

They do not replace plugins.

Plugins are still useful for message lifecycle behavior, while lifecycle hooks are focused on broker and operations events.
