---
layout: home

hero:
  name: "Rabbit Relay"
  text: "Reliable, type-safe RabbitMQ event framework"
  tagline: "Fast. Typed. Resilient."
  image:
    src: /rabbit-relay.svg
    alt: "Rabbit Relay Logo"
  actions:
    - theme: brand
      text: What is Rabbit Relay
      link: /guide/what-is-rabbit-relay
    - theme: alt
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Github
      link: https://github.com/bitspacerlabs/rabbit-relay

features:
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 3l7 3v5c0 5-7 10-7 10s-7-5-7-10V6l7-3z"/> <path d="M9.5 12.5l2 2 3-3"/> </svg>
    title: Reliable Delivery
    details: Broker-acknowledged publishes for safer, at-least-once delivery.
  - icon: 🧬
    title: Typed Events
    details: Define event shapes once and catch mistakes early.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 7h10"/> <path d="M9 3l4 4-4 4"/> <path d="M21 17H11"/> <path d="M15 13l-4 4 4 4"/> </svg>
    title: Built-in RPC
    details: Request–reply without extra plumbing or custom wiring.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 8c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 3 2"/> <path d="M3 16c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 3 2"/> </svg>
    title: Flow Control
    details: Backpressure pauses sending until the network is ready.
  - icon: 🚨
    title: Failure Routing
    details: On errors, send to retries or a dead-letter queue.
  - icon: 🔄
    title: Auto Reconnect
    details: Recovers from drops and restores channels/bindings automatically.
  - icon: <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> <title>Duplicate Guard — Refresh Ban</title> <path d="M3 11a9 9 0 0 1 14-6"/> <path d="M7 5l0 0 0 0 M7 5l2 0l-2-2z"/> <path d="M21 13a9 9 0 0 1-14 6"/> <path d="M17 19h0 M17 19l-2 0l2 2z"/> <path d="M7 17 L17 7"/> </svg>
    title: Duplicate Guard
    details: Skips repeat message IDs within a configurable window.
  - icon: 🧩
    title: Plugin Hooks
    details: Add logging, metrics, or tracing with tiny plugins.
---
