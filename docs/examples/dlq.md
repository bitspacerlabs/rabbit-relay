# Dead Letter Queues (DLQ)

This example demonstrates how to use **Dead Letter Queues (DLQ)** with Rabbit Relay
to handle messages that **cannot be processed successfully**.

DLQs are critical for building **observable and recoverable** message-driven systems.


## What this example shows

- A **main queue** for normal processing
- A **dead letter queue** for failed messages
- Message rejection or expiration handling
- Safe isolation of problematic messages

Instead of losing messages, failures are **captured and inspected**.


## How it works

1. The main queue is configured with a **dead-letter exchange**
2. When a message fails processing, it is rejected
3. RabbitMQ republishes the message to the DLQ
4. The DLQ stores failed messages safely

Rabbit Relay keeps this behavior explicit and configurable.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/05-dlq

```bash
npx ts-node-dev --transpile-only examples/05-dlq/consumer.ts
```


## Expected behavior

- Valid messages are processed normally
- Failed messages are routed to the DLQ
- No messages are silently dropped
