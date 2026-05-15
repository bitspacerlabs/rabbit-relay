# PluginManager

`PluginManager` allows you to register cross-cutting hooks that run during publishing and consuming.

Plugins are process-wide and optional.

---

## Plugin interface

```ts
type Plugin = {
  beforeProduce?(event: EventEnvelope): Promise<void>;
  afterProduce?(event: EventEnvelope, result: unknown): Promise<void>;

  beforeProcess?(
    id: string | number,
    event: EventEnvelope
  ): Promise<void>;

  afterProcess?(
    id: string | number,
    event: EventEnvelope,
    result: unknown
  ): Promise<void>;
};
```

All hooks are optional and asynchronous.

---

## Registering plugins

Plugins are registered once at startup.

```ts
import { pluginManager } from "@bitspacerlabs/rabbit-relay";

pluginManager.register({
  async beforeProduce(ev) {
    console.log("Publishing", ev.name);
  },
});
```

Order matters: hooks run in registration order.

---

## Error behavior

- Plugin errors are caught and logged
- They do not block publishing or consuming
- Handlers still execute

Plugins should remain lightweight.

---

## Plugins vs lifecycle hooks

Plugins are message lifecycle hooks.

They run around:

```text
beforeProduce -> publish -> afterProduce
beforeProcess -> handler -> afterProcess
```

Lifecycle hooks are operations events.

They expose broker-level behavior such as:

- topology asserted
- consumer started/stopped
- retry scheduled
- publish failed
- reconnect
- broker closed

Use plugins for cross-cutting message behavior.

Use lifecycle hooks for observability, metrics, OpenTelemetry, and operations visibility.

---

## Summary

- Plugins add reusable message behavior
- Hooks are explicit and predictable
- Registration is global and ordered
- Lifecycle hooks are separate and operations-focused
