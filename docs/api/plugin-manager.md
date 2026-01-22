# PluginManager

`PluginManager` allows you to register **cross-cutting hooks** that run during
publishing and consuming.

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

pluginManager.use({
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

## Summary

- Plugins add reusable behavior
- Hooks are explicit and predictable
- Registration is global and ordered
