# Backpressure

This example demonstrates **backpressure** — what happens when publishers produce
messages **faster than consumers can process them**.

Understanding backpressure is critical for building **stable and resilient**
message-driven systems.


## What this example shows

- A **fast publisher** producing messages at high speed
- A **slow consumer** processing messages deliberately
- Queue growth under load
- Observable pressure in the system

This example makes overload **visible and measurable**.


## What is Backpressure?

Backpressure is the natural resistance a system applies when it is overwhelmed.

In RabbitMQ systems, backpressure can appear as:
- Growing queue sizes
- Increasing memory usage
- Slower acknowledgements
- Publisher confirms taking longer

RabbitMQ does not drop messages silently — pressure propagates upstream.


## How it works

1. The publisher sends messages as fast as possible
2. The consumer processes messages slowly
3. The queue starts to grow
4. RabbitMQ applies flow control internally
5. Publisher throughput is eventually affected

Rabbit Relay exposes this behavior instead of hiding it.


## When to care about backpressure

You must care about backpressure when:

- Producers and consumers have different speeds
- You handle large message volumes
- You use RPC or synchronous waits
- You care about system stability

Ignoring backpressure leads to **memory exhaustion and cascading failures**.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/07-backpressure

```bash
# fast publisher
BP_MSG_SIZE=2000000 \
PUBLISH_INTERVAL_MS=0 \
TOTAL=200000 \
npx ts-node-dev --transpile-only examples/07-backpressure/publisher.fast.ts

# slow consumer
npx ts-node-dev --transpile-only examples/07-backpressure/consumer.slow.ts
```


## What to observe

- Queue length increases steadily
- Consumer cannot keep up
- Publisher confirms slow down
- System remains stable (no crash)

This is healthy backpressure in action.


## How to handle backpressure

Common strategies:
- Slow down publishers
- Add more consumers
- Reduce message size
- Use batching
- Apply rate limiting

Rabbit Relay gives you **signals**, not magic fixes.

