# Direct Exchange - Basics

**What it shows:** one publisher and two consumers bound by specific routing keys (`alpha`, `beta`).

**Files**
- `publisher.ts` – sends alternating messages with keys `alpha` / `beta`
- `consumer.alpha.ts` – listens on `alpha`
- `consumer.beta.ts` – listens on `beta`


**Run**
```bash
# terminal 1
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.alpha.ts

# terminal 2
npx ts-node-dev --transpile-only examples/00-basics/direct/consumer.beta.ts

# terminal 3
npx ts-node-dev --transpile-only examples/00-basics/direct/publisher.ts
```

**Expect**
- `consumer.alpha` logs every message published with `alpha`
- `consumer.beta` logs every message with `beta`
