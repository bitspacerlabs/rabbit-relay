# Publisher Confirms - Basics

**What it shows:** a single publisher using **RabbitMQ Publisher Confirms**, where `produce()` resolves **only after the broker acknowledges the publish**.

**Files**
- `publisher.confirms.ts` – publishes messages with `publisherConfirms: true` and logs only after broker ACK

---

**Run**
```bash
# terminal 1
npx ts-node-dev --transpile-only examples/confirms/publisher.confirms.ts
```

---

**Expect**
- each message logs `sending …` followed by `✔ CONFIRMED …`
- the `CONFIRMED` log appears **only after RabbitMQ ACKs the message**
- if RabbitMQ is stopped, `produce()` fails and **no false “sent” log appears**
- restarting RabbitMQ allows publishing to resume
