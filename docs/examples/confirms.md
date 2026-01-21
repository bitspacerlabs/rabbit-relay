# Publisher Confirms

This example demonstrates **Publisher Confirms**, a RabbitMQ feature that allows a publisher
to know whether messages were **successfully received by the broker**.

Publisher confirms are essential when you care about **reliability and delivery guarantees**.


## What this example shows

- A publisher using **confirm mode**
- Acknowledgement (`ack`) from the broker when a message is persisted
- Detection of failed or dropped publishes

With confirms enabled, publishing becomes **observable and safe**.


## How it works

1. The publisher enables confirm mode on the channel
2. Each published message is tracked internally
3. RabbitMQ responds with an `ack` or `nack`
4. The application decides how to react

Rabbit Relay exposes this behavior explicitly instead of hiding it.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/01-confirms

```bash
npx ts-node-dev --transpile-only examples/03-publisher-confirms/publisher.ts
```


## Expected behavior

- Successful publishes are acknowledged by the broker
- Failed publishes are detected immediately
- No silent message loss

