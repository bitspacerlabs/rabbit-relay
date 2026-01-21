# Fanout Exchange - Basics

**What it shows:** one publisher, two consumers; fanout broadcasts to all bound queues (no routing keys).

**Files**
- `publisher.ts`
- `consumer.a.ts`
- `consumer.b.ts`

**Run**
```bash
# terminal 1
npx ts-node-dev --transpile-only examples/00-basics/fanout/consumer.a.ts
# terminal 2
npx ts-node-dev --transpile-only examples/00-basics/fanout/consumer.b.ts
# terminal 3
npx ts-node-dev --transpile-only examples/00-basics/fanout/publisher.ts
```

**Expect**
- Both consumers log every message.
