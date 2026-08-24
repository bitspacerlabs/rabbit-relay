import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Braces,
  Clock4,
  ListTree,
  Repeat,
  ShieldCheck,
  ArrowUpRight,
  TerminalSquare,
} from 'lucide-react';

const features = [
  {
    icon: Braces,
    title: 'Type-safe events',
    body: 'Event factories and typed envelopes. Wildcard handlers narrow via discriminated unions — no casts.',
  },
  {
    icon: Repeat,
    title: 'Bounded retries',
    body: 'Immediate, fixed-delay, or exponential backoff. All broker-native TTL queues, never in-memory.',
  },
  {
    icon: ShieldCheck,
    title: 'Dead-letter pipelines',
    body: 'DLX/DLQ wiring in one config block, with observability headers on every retry copy.',
  },
  {
    icon: Clock4,
    title: 'Publisher confirms',
    body: 'One flag per exchange. Your produce() resolves only when RabbitMQ has it.',
  },
  {
    icon: ListTree,
    title: 'Explicit topology',
    body: 'Exchanges, queues and bindings visible in code, in planTopology() output, and the CLI diff.',
  },
  {
    icon: TerminalSquare,
    title: 'Topology & DLQ CLI',
    body: 'Plan, validate, diff your topology; peek and redrive dead-letter queues from the terminal.',
  },
];

const codeLines = [
  [
    { t: 'const', c: 'text-fd-primary' },
    { t: ' api = ', c: '' },
    { t: 'await', c: 'text-fd-primary' },
    { t: ' broker', c: 'text-fd-foreground/80' },
    { t: '.queue(', c: '' },
    { t: '"orders.q"', c: 'text-emerald-400' },
    { t: ')', c: '' },
  ],
  [
    { t: '  .exchange<{ orderCreated: ', c: '' },
    { t: 'EventEnvelope', c: 'text-sky-400' },
    { t: '<OrderCreated> }>(', c: '' },
    { t: '"orders.ex"', c: 'text-emerald-400' },
    { t: ', cfg)', c: '' },
  ],
  [{ t: '  .with({ orderCreated });', c: '' }],
  [{ t: '', c: '' }],
  [
    { t: 'api.', c: '' },
    { t: 'handle', c: 'text-fd-primary' },
    { t: '(', c: '' },
    { t: '"orderCreated"', c: 'text-emerald-400' },
    { t: ', fulfill); ', c: '' },
    { t: '// fully typed payload', c: 'text-fd-muted-foreground italic' },
  ],
  [
    { t: 'await', c: 'text-fd-primary' },
    { t: ' api.', c: '' },
    { t: 'consume', c: 'text-fd-primary' },
    { t: '({ prefetch: ', c: '' },
    { t: '20', c: 'text-orange-300' },
    { t: ' });', c: '' },
  ],
];

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1">
      {/* hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-14">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-fd-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          v1.5.0 · exponential backoff now available
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.08]">
          RabbitMQ for Node.js,
          <br />
          <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 bg-clip-text text-transparent dark:from-orange-400 dark:via-orange-300 dark:to-amber-200">
            without the guesswork
          </span>
        </h1>
        <p className="mt-5 text-lg text-fd-muted-foreground max-w-2xl">
          Type-safe event contracts, bounded retries with exponential backoff,
          dead-letter pipelines, publisher confirms. Built on amqplib — every
          broker behavior stays explicit.
        </p>
        <div className="flex gap-3 mt-8">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.03]"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs/retry-dlq"
            className="inline-flex items-center gap-2 rounded-full border bg-fd-background/60 backdrop-blur px-6 py-3 text-sm font-semibold transition-colors hover:bg-fd-muted"
          >
            Retry &amp; DLQ guide
          </Link>
        </div>
      </section>

      {/* code window */}
      <section className="px-6 pb-16 flex justify-center">
        <div className="w-full max-w-2xl rounded-xl border bg-fd-card shadow-2xl overflow-hidden text-left">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-fd-muted/40">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-yellow-400" />
            <span className="size-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-fd-muted-foreground font-medium">
              worker.ts
            </span>
          </div>
          <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
            {codeLines.map((line, i) => (
              <div key={i} className="whitespace-pre">
                {line.map((seg, j) => (
                  <span key={j} className={seg.c}>
                    {seg.t}
                  </span>
                ))}
              </div>
            ))}
          </pre>
        </div>
      </section>

      {/* features */}
      <section className="border-t bg-fd-muted/30 px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-fd-card p-5 transition-shadow hover:shadow-md"
            >
              <f.icon className="size-5 text-fd-primary mb-3" />
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-fd-muted-foreground leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        <div className="max-w-5xl mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-fd-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" /> At-least-once delivery
          </span>
          <span className="inline-flex items-center gap-2">
            <BookOpen className="size-4 text-fd-primary" /> One dependency: amqplib
          </span>
          <a
            href="https://github.com/bitspacerlabs/rabbit-relay"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-fd-foreground transition-colors"
          >
            <ArrowUpRight className="size-4" /> bitspacerlabs/rabbit-relay
          </a>
        </div>
      </section>
    </main>
  );
}
