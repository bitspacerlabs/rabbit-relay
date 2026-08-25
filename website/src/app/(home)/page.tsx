import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Rabbit,
} from 'lucide-react';

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
      {/* ── hero ───────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.18),transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [background-image:radial-gradient(circle,theme(colors.fd-border)_1px,transparent_1px)] [background-size:28px_28px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
        />
        <div className="inline-flex items-center gap-2 rounded-full border bg-fd-background/70 backdrop-blur px-3 py-1 text-xs font-medium text-fd-muted-foreground mb-6">
          <Rabbit className="size-3.5 text-fd-primary" />
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
          dead-letter pipelines, publisher confirms. Built on amqplib, every
          broker behavior stays explicit.
        </p>
        <div className="flex gap-3 mt-8">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.03]"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
          <a
            href="https://github.com/bitspacerlabs/rabbit-relay"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border bg-fd-background/60 backdrop-blur px-6 py-3 text-sm font-semibold transition-colors hover:bg-fd-muted"
          >
            View on GitHub <ArrowUpRight className="size-4" />
          </a>
        </div>
      </section>

      {/* ── code window ────────────────────────────────────────────────── */}
      <section className="px-6 pb-20 flex justify-center">
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
              <div
                key={i}
                className="code-line whitespace-pre"
                style={{ animationDelay: `${0.3 + i * 0.22}s` }}
              >
                {line.map((seg, j) => (
                  <span key={j} className={seg.c}>
                    {seg.t}
                  </span>
                ))}
              </div>
            ))}
            <div
              className="code-line whitespace-pre"
              style={{ animationDelay: `${0.3 + codeLines.length * 0.22}s` }}
            >
              <span className="code-cursor inline-block h-[14px] w-[7px] translate-y-[2px] bg-fd-primary" />
            </div>
          </pre>
        </div>
      </section>

      {/* ── how it works ──────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">How it works</h2>
          <p className="text-fd-muted-foreground leading-relaxed mb-8">
            Point your code at a <code>RabbitMQBroker</code> and declare your
            topology with a fluent chain. The framework handles connection
            management, channel pooling, retry queues, and dead-letter routing.
            Every exchange, queue, and binding is visible in your code, never
            hidden behind magic.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 rounded-full border bg-fd-card px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-muted"
            >
              Quickstart <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/docs/configuration"
              className="inline-flex items-center gap-2 rounded-full border bg-fd-card px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-muted"
            >
              Configuration <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/docs/retry-dlq"
              className="inline-flex items-center gap-2 rounded-full border bg-fd-card px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-muted"
            >
              Retry &amp; DLQ <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── why rabbit relay ──────────────────────────────────────────── */}
      <section className="border-t bg-fd-muted/30 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Why Rabbit Relay?</h2>
          <ul className="space-y-6">
            {[
              {
                title: 'One integration',
                body: 'Switch exchanges, queues, or retry strategies by changing a config object, not your code.',
              },
              {
                title: 'Type safety',
                body: 'Event factories and typed envelopes. Handlers get fully typed payloads, no casts.',
              },
              {
                title: 'Reliability by default',
                body: 'Bounded retries with fixed or exponential backoff, DLQs, publisher confirms.',
              },
              {
                title: 'No lock-in',
                body: 'Open source (MIT), single runtime dependency (amqplib), and every broker behavior stays explicit.',
              },
            ].map((item) => (
              <li key={item.title}>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-fd-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA footer ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center rounded-2xl border bg-gradient-to-b from-fd-primary/5 to-transparent px-8 py-12">
          <h2 className="text-2xl font-bold mb-4">
            Ready to build something reliable?
          </h2>
          <p className="text-fd-muted-foreground mb-8 max-w-xl mx-auto">
            Start with the quickstart guide, your first typed producer and
            consumer in under 2 minutes.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.03]"
            >
              Read the quickstart <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://github.com/bitspacerlabs/rabbit-relay"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border bg-fd-background/60 backdrop-blur px-6 py-3 text-sm font-semibold transition-colors hover:bg-fd-muted"
            >
              View on GitHub <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
