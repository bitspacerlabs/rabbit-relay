# Delayed Retry

This example demonstrates Rabbit Relay delayed retry.

It shows:

- `retry.delayMs`
- RabbitMQ TTL + DLX retry queues
- flaky job recovery
- poison job final DLQ routing

Full example on GitHub:  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/10-delayed-retry

---

## Exponential backoff

Add `backoff: "exponential"` to double the wait on every attempt
(attempt n waits `delayMs * 2^(n-1)`):

```ts
await sub.consume({
  onError: "retry",
  retry: {
    attempts: 3,
    delayMs: 500,
    backoff: "exponential",
    then: "dead-letter",
  },
});
```

Each attempt gets its own TTL parking exchange/queue pair, so waits stay
broker-native. See `examples/18-exponential-backoff` for a runnable demo.
