import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/rabbit-relay/',
  title: "Rabbit Relay",
  description: "Reliable, type-safe RabbitMQ event framework for Node.js",
  head: [
    ['link', { rel: 'icon', href: '/rabbit-relay-mini-dark.svg' }],
  ],
  themeConfig: {
    logo: {
      light: '/rabbit-relay-mini.svg',
      dark: '/rabbit-relay-mini-dark.svg',
      alt: 'Rabbit Relay Logo',
      width: 24,
      height: 28
    },
    // top navigation
    nav: [
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'Examples', link: '/examples/basics' },
      { text: 'API', link: '/api/rabbitmq-broker' },
    ],

    // sidebar
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is Rabbit Relay?', link: '/guide/what-is-rabbit-relay' },
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Configuration', link: '/guide/configuration' },
        ]
      },
      {
        text: 'Core Features',
        items: [
          { text: 'Typed Events & Factories', link: '/features/typed-events' },
          { text: 'Publisher Confirms', link: '/features/publisher-confirms' },
          { text: 'RPC Support', link: '/features/rpc' },
          { text: 'Error Handling & DLQ', link: '/features/error-handling' },
          { text: 'Auto Reconnect', link: '/features/reconnect' },
          { text: 'TTL De-dupe', link: '/features/ttl-dedupe' },
          { text: 'Plugin Hooks', link: '/features/plugins' },
        ]
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
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'RabbitMQBroker', link: '/api/rabbitmq-broker' },
          { text: 'EventEnvelope', link: '/api/event-envelope' },
          { text: 'PluginManager', link: '/api/plugin-manager' },
        ]
      }
    ],

    // footer/social
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bitspacerlabs/rabbit-relay' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 BitSpacerLabs'
    }
  }
})
