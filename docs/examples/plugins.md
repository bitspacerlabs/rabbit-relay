# Plugins

This example demonstrates how to use **plugins** in Rabbit Relay to hook into
the message lifecycle without hiding RabbitMQ behavior.

Plugins allow you to extend behavior **without coupling business logic
to infrastructure concerns**.

## What this example shows

- Registering one or more plugins
- Hooking into publish and consume lifecycles
- Observing messages without mutating core logic
- Composing cross-cutting concerns cleanly

Plugins are **optional, explicit, and predictable**.


## What are Plugins in Rabbit Relay?

Plugins are small, composable hooks that can observe or react to events such as:

- Before a message is published
- After a message is confirmed
- When a message is received
- When a message handler fails

They are designed for **cross-cutting concerns**, not business logic.


## How it works

1. You define a plugin implementing known hooks
2. The plugin is registered with the broker or publisher
3. Rabbit Relay invokes the plugin at specific lifecycle points
4. Core message flow remains unchanged

This keeps your system **observable and extensible**.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/06-plugins

```bash
npx ts-node-dev --transpile-only examples/06-plugins/index.ts
```


## Expected behavior

- Messages flow normally
- Plugins observe lifecycle events
- No changes to publisher or consumer logic
