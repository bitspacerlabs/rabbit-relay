---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: sohaibqasem

---

# Bug Report – Rabbit Relay

## Summary
A clear and concise description of what the bug is.

---

## Rabbit Relay Version
- **Package:** `@bitspacerlabs/rabbit-relay`
- **Version:** `x.y.z`

---

## RabbitMQ Environment
- **RabbitMQ Version:** `x.y.z`
- **Deployment:** Local / Docker / Cloud
- **Clustered:** Yes / No

---

## Node.js Environment
- **Node.js Version:** `vXX`
- **Package Manager:** npm / pnpm / yarn
- **OS:** Linux / macOS / Windows

---

## What Happened?
Describe what actually happened.

---

## Expected Behavior
Describe what you expected to happen.

---

## Steps to Reproduce
1. Configure broker with minimal setup
2. Publish an event
3. Start a consumer
4. Observe the behavior

---

## Actual Output / Logs
```text
Paste logs or error messages here
```

---

## Example Code (Minimal Repro)
```ts
// Paste a minimal reproducible example here
```

---

## Message / Event Details
- **Exchange:**  
- **Routing Key:**  
- **Queue:**  
- **Event Name:**  
- **Persistent:** Yes / No  
- **Confirm Channel:** Yes / No  
- **Deduplication Enabled:** Yes / No  

---

## Does This Happen Consistently?
- Always  
- Sometimes  
- Only under load  
- Only after reconnect  

---

## Screenshots / Diagrams (Optional)
Broker topology or RabbitMQ Management UI screenshots if available.

---

## Additional Context
Add any other context that might help diagnose the problem (retries, reconnects, dead letters, load, etc.).

---

## Checklist
- [ ] I am using the latest Rabbit Relay version
- [ ] I checked existing issues
- [ ] I provided a minimal reproducible example
