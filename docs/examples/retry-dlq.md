# Retry + DLQ

This example demonstrates bounded consumer retries followed by dead-lettering.

It shows the production pattern:

```text
handler fails -> retry a few times -> send to DLQ
```

Full example on GitHub:  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/06-retry-dlq
