# Developer Experience

This example demonstrates Rabbit Relay developer experience APIs in one small flow.

It shows:

- typed RPC with `request<TReply>()`
- metadata helpers with `withHeaders()`
- trace propagation with `traceFrom()`
- local middleware with `use()`
- consumer-side de-duplication with `consume({ dedupe })`
- message size guard with `maxMessageBytes`
- typed `MessageTooLargeError`

Full example on GitHub:  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/09-developer-experience
