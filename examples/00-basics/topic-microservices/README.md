# Topic Exchange - Microservices Baseline

**What it shows:** simple 4-service flow
- `ordersService` publishes `orderCreated` on `orders_exchange` (topic)
- `paymentsService` consumes `orderCreated`, publishes `paymentProcessed`
- `shippingService` consumes `paymentProcessed`, publishes `shippingStarted`
- `notificationsService` can observe events (or send confirmations)

**Files**
- `ordersService.ts`
- `paymentsService.ts`
- `shippingService.ts`
- `notificationsService.ts`

**Run (suggested order)**
```bash
# Ship + Notify first
npx tsx examples/00-basics/topic-microservices/shippingService.ts
npx tsx examples/00-basics/topic-microservices/notificationsService.ts

# Payments next
npx tsx examples/00-basics/topic-microservices/paymentsService.ts

# Orders last (producer)
npx tsx examples/00-basics/topic-microservices/ordersService.ts
```

**Expect**
- payments logs `orderCreated` -> emits `paymentProcessed`
- shipping logs `paymentProcessed` -> emits `shippingStarted`
- notifications logs the flow (depending on your handlers)
