# RPC (Request / Reply)

This example demonstrates the **RPC (Request / Reply)** pattern using Rabbit Relay.

RPC allows a service to send a request message and wait for a corresponding reply,
while still using RabbitMQ as the transport.


## What this example shows

- A **client** sending a request
- A **server** processing the request
- A **reply queue** for responses
- Correlation between requests and replies

This pattern enables synchronous-style workflows over asynchronous messaging.


## What is RPC in RabbitMQ?

In RabbitMQ-based RPC:

- The client sends a request message
- The message includes a `replyTo` queue and `correlationId`
- The server processes the request and publishes a reply
- The client matches the reply to the original request

Rabbit Relay handles this explicitly and transparently.


## How it works

1. The client publishes a request message
2. RabbitMQ routes it to the RPC server queue
3. The server processes the request
4. The server publishes a reply to the `replyTo` queue
5. The client receives and resolves the response

This avoids tight coupling while keeping request boundaries clear.


## Running the example

**See the full runnable example on GitHub:**  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/04-rpc

```bash
# terminal 1
npx ts-node-dev --transpile-only examples/04-rpc/server.ts

# terminal 2
npx ts-node-dev --transpile-only examples/04-rpc/client.ts
```


## Expected behavior

- The client sends a request
- The server processes it and replies
- The client logs the response
- Each request maps to exactly one reply

