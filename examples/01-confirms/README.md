## Publisher Confirms (Basics)

This example shows how **RabbitMQ Publisher Confirms** work.

When `publisherConfirms: true` is enabled, `produce()` resolves **only after RabbitMQ acknowledges (ACKs) the message**.

Without confirms, `produce()` resolves immediately after writing to the socket - even if the message is dropped.

---

### Files

- `publisherConfirms.with.ts`  
  Publishes messages with `publisherConfirms: true` and logs only after broker ACK.

- `publisherConfirms.without.ts`  
  Publishes the same messages without confirms and logs immediately.

---

### Run

```bash
# with publisher confirms
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.with.ts

# without publisher confirms
npx ts-node-dev --transpile-only examples/01-confirms/publisherConfirms.without.ts
```

---

### Expected Output

**With publisher confirms**
```
[CONFIRM] sending seq=1
[CONFIRM] ✔ CONFIRMED seq=1
```

- `CONFIRMED` appears only after RabbitMQ ACKs the message
- if the broker rejects the message, `produce()` fails

**Without publisher confirms**
```
[NO-CONFIRM] sending seq=1
[NO-CONFIRM] SENT seq=1
```

- `SENT` only means the message was written to the socket
- failures are silent

---

### Failure Demo (Recommended)

Delete the exchange while publishers are running:

```bash
rabbitmqadmin delete exchange name=confirms_ex
```

**Without confirms**
```
[NO-CONFIRM] SENT seq=5
```

**With confirms**
```
[CONFIRM] ✖ NOT CONFIRMED seq=5
404 NOT_FOUND - no exchange 'confirms_ex'
```

---

### Takeaway

- **Without confirms** → `produce()` means *“I tried”*
- **With confirms** → `produce()` means *“RabbitMQ accepted it”*

Use publisher confirms for messages you cannot afford to lose.
