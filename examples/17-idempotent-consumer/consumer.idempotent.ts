import { event, RabbitMQBroker } from "../../lib/index.js";
import type { EventEnvelope } from "../../lib/index.js";

const EXCHANGE = "idempotent.demo.ex";
const QUEUE = "idempotent.demo.q";

// ---------------------------------------------------------------------------
// In-memory processed-IDs set — for demo only.
//
// Production: use a database table with a UNIQUE constraint on event_id:
//
//   CREATE TABLE processed_events (
//     event_id   TEXT PRIMARY KEY,
//     order_id   TEXT NOT NULL,
//     processed_at TIMESTAMP DEFAULT now()
//   );
//
// The UNIQUE constraint is the correctness mechanism — the in-memory set
// below is just an optimisation to avoid unnecessary DB round-trips.
// ---------------------------------------------------------------------------
const processedIds = new Set<string>();

function alreadyProcessed(eventId: string): boolean {
  return processedIds.has(eventId);
}

function markProcessed(eventId: string): void {
  processedIds.add(eventId);
}

// ---------------------------------------------------------------------------
// Event factory
// ---------------------------------------------------------------------------
const orderCreated = event("order.created", "v1").schema({
  parse: (input: unknown) => input as { orderId: string; amount: number },
});

// ---------------------------------------------------------------------------
// Broker & topology
// ---------------------------------------------------------------------------
const broker = new RabbitMQBroker("idempotent.consumer");

type EventMap = {
  "order.created": EventEnvelope<{ orderId: string; amount: number }>;
};

const sub = await broker.queue(QUEUE).exchange<EventMap>(EXCHANGE, {
  exchangeType: "topic",
  routingKey: "order.*",
  deadLetter: {
    exchange: "idempotent.dlx",
    queue: "idempotent.dlq",
    routingKey: "order.dead",
    autoDeclare: true,
  },
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
sub.handle("order.created", async (_deliveryTag, event) => {
  // 1. Idempotency check — skip if already processed
  if (alreadyProcessed(event.id)) {
    console.log(`  ↳ SKIP ${event.id} (already processed)`);
    return;
  }

  // 2. Business logic
  //
  // Production: wrap (2) + (3) in a database transaction:
  //
  //   await db.transaction(async (tx) => {
  //     const inserted = await tx<ProcessedEvent>`
  //       INSERT INTO processed_events (event_id, order_id)
  //       VALUES (${event.id}, ${event.data.orderId})
  //       ON CONFLICT (event_id) DO NOTHING
  //       RETURNING *
  //     `;
  //
  //     if (!inserted.length) {
  //       // Another consumer already processed this event
  //       return;
  //     }
  //
  //     await tx<Order>`INSERT INTO orders (id, total) ...`;
  //   });

  console.log(`  ✓ PROCESS ${event.id} (orderId=${event.data.orderId})`);

  // 3. Record as processed
  //
  // In production this must happen in the same transaction as step 2.
  // If the handler crashes between step 2 and step 3, the message is
  // redelivered and the idempotency key prevents duplicate side effects.
  markProcessed(event.id);

  // If the handler throws AFTER markProcessed but BEFORE the implicit ACK:
  //   - The event is ACKed (or the `onError` policy fires)
  //   - The processed ID is already recorded, so redelivery is harmless
  //
  // If the handler throws BEFORE markProcessed:
  //   - The event is not recorded
  //   - The `onError` policy fires (retry, DLQ, etc.)
  //   - The next attempt will process normally
});

// ---------------------------------------------------------------------------
// Start consuming
// ---------------------------------------------------------------------------
await sub.consume({
  prefetch: 10,
  concurrency: 5,
  onError: "dead-letter",
});

console.log(`Listening on queue '${QUEUE}' — publishing duplicates shows SKIP`);
