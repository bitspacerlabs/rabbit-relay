import { defineConfig } from 'vitepress'

const base = '/rabbit-relay/docs/'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base,
  title: 'Rabbit Relay',
  description: 'Reliable, type-safe RabbitMQ event framework for Node.js',

  head: [
    // Favicons
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}rabbit-relay-mini.svg` }],
    ['link', { rel: 'icon', type: 'image/png', href: `${base}favicon.png` }],
  ],

  themeConfig: {
    search: {
      provider: 'local',
    },

    logo: {
      light: `${base}rabbit-relay-mini.svg`,
      dark: `${base}rabbit-relay-mini-dark.svg`,
      alt: 'Rabbit Relay Logo',
      width: 24,
      height: 28,
    },

    nav: [
      { text: 'Home', link: '/rabbit-relay/' },
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'Learn RabbitMQ', link: '/learn/rabbitmq-basics' },
      { text: 'Features', link: '/features/typed-events' },
      { text: 'Examples', link: '/examples/basics' },
      { text: 'API', link: '/api/rabbitmq-broker' },
      { text: 'GitHub', link: 'https://github.com/bitspacerlabs/rabbit-relay' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is Rabbit Relay?', link: '/guide/what-is-rabbit-relay' },
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Configuration', link: '/guide/configuration' },
        ],
      },
      {
        text: 'Learn RabbitMQ',
        items: [
          { text: 'RabbitMQ Basics', link: '/learn/rabbitmq-basics' },
          { text: 'Exchanges, Queues, Bindings', link: '/learn/exchanges-queues-bindings' },
          { text: 'Acknowledgements', link: '/learn/acknowledgements' },
          { text: 'Retry, DLQ, and Redrive', link: '/learn/retry-dlq-redrive' },
          { text: 'Topology Ownership', link: '/learn/topology-ownership' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Typed Events & Factories', link: '/features/typed-events' },
          { text: 'Publisher Confirms', link: '/features/publisher-confirms' },
          { text: 'RPC Support', link: '/features/rpc' },
          { text: 'Message Size Guard', link: '/features/message-size-guard' },
          { text: 'amqplib Escape Hatch', link: '/features/amqplib-escape-hatch' },
        ],
      },
      {
        text: 'Developer Experience',
        items: [
          { text: 'Middleware', link: '/features/middleware' },
          { text: 'Headers & Tracing', link: '/features/headers-and-tracing' },
        ],
      },
      {
        text: 'Consumer Reliability',
        items: [
          { text: 'Consumer Concurrency', link: '/features/consumer-concurrency' },
          { text: 'Error Handling', link: '/features/error-handling' },
          { text: 'Retry Policy', link: '/features/retry-policy' },
          { text: 'Delayed Retry', link: '/features/delayed-retry' },
          { text: 'Dead-Letter Queues', link: '/features/dead-letter-queues' },
          { text: 'TTL De-dupe', link: '/features/ttl-dedupe' },
        ],
      },
      {
        text: 'Operations',
        items: [
          { text: 'Auto Reconnect', link: '/features/reconnect' },
          { text: 'Health Checks', link: '/features/health-checks' },
          { text: 'Graceful Shutdown', link: '/features/graceful-shutdown' },
          { text: 'Lifecycle Hooks', link: '/features/lifecycle-hooks' },
          { text: 'OpenTelemetry Adapter', link: '/features/opentelemetry' },
          { text: 'Topology Modes', link: '/features/topology-modes' },
          { text: 'Topology Planner', link: '/features/topology-planner' },
          { text: 'Topology Validation', link: '/features/topology-validation' },
          { text: 'DLQ Redrive', link: '/features/dlq-redrive' },
          { text: 'Plugin Hooks', link: '/features/plugins' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Basics', link: '/examples/basics' },
          { text: 'Confirms', link: '/examples/confirms' },
          { text: 'RPC', link: '/examples/rpc' },
          { text: 'DLQ', link: '/examples/dlq' },
          { text: 'Plugins', link: '/examples/plugins' },
          { text: 'Backpressure', link: '/examples/backpressure' },
          { text: 'Retry + DLQ', link: '/examples/retry-dlq' },
          { text: 'Escape Hatch', link: '/examples/escape-hatch' },
          { text: 'Health + Shutdown', link: '/examples/health-shutdown' },
          { text: 'Developer Experience', link: '/examples/developer-experience' },
          { text: 'Delayed Retry', link: '/examples/delayed-retry' },
          { text: 'Lifecycle Hooks', link: '/examples/lifecycle-hooks' },
          { text: 'OpenTelemetry', link: '/examples/opentelemetry' },
          { text: 'Topology Planner', link: '/examples/topology-planner' },
          { text: 'Topology Validation', link: '/examples/topology-validation' },
          { text: 'Topology Modes', link: '/examples/topology-modes' },
          { text: 'DLQ Redrive', link: '/examples/dlq-redrive' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'RabbitMQBroker', link: '/api/rabbitmq-broker' },
          { text: 'EventEnvelope', link: '/api/event-envelope' },
          { text: 'PluginManager', link: '/api/plugin-manager' },
        ],
      },
      {
        text: 'AI & Agents',
        items: [
          { text: 'Agent Guide', link: '/ai/agent-guide' },
          { text: 'Common Recipes', link: '/ai/common-recipes' },
          { text: 'Decision Guide', link: '/ai/decision-guide' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/bitspacerlabs/rabbit-relay' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 BitSpacerLabs',
    },
  },
})