# Idempotent Consumer

This example shows how to handle at-least-once delivery safely by making
consumers idempotent.

It shows:

- event `id` as an idempotency key
- skip-if-processed pattern
- publisher with intentional duplicates
- production notes for database-backed idempotency

Full example on GitHub:  
https://github.com/bitspacerlabs/rabbit-relay/tree/main/examples/17-idempotent-consumer
