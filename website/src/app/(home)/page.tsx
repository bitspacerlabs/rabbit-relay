import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  Clock4,
  FileCode2,
  ListTree,
  Rabbit,
  Repeat,
  Rocket,
  ShieldCheck,
  TerminalSquare,
  Zap,
} from 'lucide-react';

/* ─── data ────────────────────────────────────────────────────────────── */

const features = [
  {
    icon: Braces,
    title: 'Type-safe events',
    body: 'Event factories and typed envelopes. Wildcard handlers narrow via discriminated unions, no casts.',
  },
  {
    icon: Repeat,
    title: 'Bounded retries',
    body: 'Immediate, fixed-delay, or exponential backoff. All broker-native TTL queues, never in-memory timers.',
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
    title: 'CLI for ops',
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

const beforeCode = [
  [
    { t: 'const', c: 'text-fd-muted-foreground' },
    { t: ' ch = ', c: '' },
    { t: 'await', c: 'text-fd-muted-foreground' },
    { t: ' conn.createChannel()', c: '' },
  ],
  [
    { t: 'await', c: 'text-fd-muted-foreground' },
    { t: ' ch.assertExchange(', c: '' },
    { t: '"orders.ex"', c: 'text-fd-muted-foreground/70' },
    { t: ', ', c: '' },
    { t: '"topic"', c: 'text-fd-muted-foreground/70' },
    { t: ')', c: '' },
  ],
  [
    { t: 'await', c: 'text-fd-muted-foreground' },
    { t: ' ch.assertQueue(', c: '' },
    { t: '"orders.q"', c: 'text-fd-muted-foreground/70' },
    { t: ')', c: '' },
  ],
  [
    { t: 'await', c: 'text-fd-muted-foreground' },
    { t: ' ch.bindQueue(', c: '' },
    { t: '"orders.q"', c: 'text-fd-muted-foreground/70' },
    { t: ', ', c: '' },
    { t: '"orders.ex"', c: 'text-fd-muted-foreground/70' },
    { t: ', ', c: '' },
    { t: '"#"', c: 'text-fd-muted-foreground/70' },
    { t: ')', c: '' },
  ],
  [
    { t: 'ch.consume(', c: '' },
    { t: '"orders.q"', c: 'text-fd-muted-foreground/70' },
    { t: ', msg => {', c: '' },
  ],
  [
    { t: '  ', c: '' },
    { t: 'const', c: 'text-fd-muted-foreground' },
    { t: ' data = ', c: '' },
    { t: 'JSON.parse(', c: '' },
    { t: 'msg.content', c: 'text-fd-muted-foreground/70' },
    { t: ')', c: '' },
  ],
];

const afterCode = [
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
    { t: ', fulfill);', c: '' },
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

/* ─── page ────────────────────────────────────────────────────────────── */

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

      {/* ── trust badges ───────────────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: Zap, text: 'At-least-once delivery', color: 'text-emerald-500' },
            { icon: FileCode2, text: 'TypeScript-first', color: 'text-sky-500' },
            { icon: ShieldCheck, text: 'MIT licensed', color: 'text-fd-muted-foreground' },
            { icon: Rocket, text: 'Node ≥ 18', color: 'text-fd-muted-foreground' },
          ].map((b) => (
            <span
              key={b.text}
              className="inline-flex items-center gap-2 rounded-full border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground shadow-sm"
            >
              <b.icon className={`size-4 ${b.color}`} />
              {b.text}
            </span>
          ))}
        </div>
      </section>

      {/* ── features grid ──────────────────────────────────────────────── */}
      <section className="border-t bg-fd-muted/30 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-fd-card p-5 transition-all hover:shadow-md hover:border-fd-primary/30"
              >
                <f.icon className="size-5 text-fd-primary mb-3" />
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-fd-muted-foreground leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── before / after ─────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-4">
            Why not just use amqplib?
          </h2>
          <p className="text-center text-fd-muted-foreground mb-12 max-w-2xl mx-auto">
            Same amqplib under the hood. No magic, no hidden broker behavior.
            Just the boilerplate you&apos;d write anyway, with type safety and
            production patterns built in.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* before */}
            <div className="rounded-xl border bg-fd-card overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b bg-fd-muted/40 text-xs font-medium text-fd-muted-foreground uppercase tracking-wide">
                Before, raw amqplib
              </div>
              <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
                {beforeCode.map((line, i) => (
                  <div key={i} className="whitespace-pre flex">
                    <span className="select-none text-fd-muted-foreground/40 w-5 text-right mr-4 text-[11px]">
                      {i + 1}
                    </span>
                    <span>
                      {line.map((seg, j) => (
                        <span key={j} className={seg.c}>
                          {seg.t}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
            {/* after */}
            <div className="rounded-xl border-2 border-fd-primary/40 bg-fd-card overflow-hidden shadow-lg shadow-fd-primary/5">
              <div className="px-4 py-2.5 border-b bg-fd-primary/5 text-xs font-medium text-fd-primary uppercase tracking-wide flex items-center gap-2">
                <Check className="size-3.5" /> After, Rabbit Relay
              </div>
              <pre className="p-5 text-[13px] leading-relaxed overflow-x-auto">
                {afterCode.map((line, i) => (
                  <div key={i} className="whitespace-pre flex">
                    <span className="select-none text-fd-muted-foreground/40 w-5 text-right mr-4 text-[11px]">
                      {i + 1}
                    </span>
                    <span>
                      {line.map((seg, j) => (
                        <span key={j} className={seg.c}>
                          {seg.t}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── stats strip ────────────────────────────────────────────────── */}
      <section className="border-t bg-fd-muted/30 px-6 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-fd-border rounded-xl border bg-fd-card overflow-hidden text-center">
          {[
            { k: 'v1.5.0', v: 'current release' },
            { k: '1', v: 'runtime dependency' },
            { k: 'MIT', v: 'license' },
            { k: 'Node ≥ 18', v: 'supported' },
          ].map((s) => (
            <div key={s.k} className="px-4 py-4">
              <div className="text-lg font-bold">{s.k}</div>
              <div className="text-xs text-fd-muted-foreground mt-0.5">
                {s.v}
              </div>
            </div>
          ))}
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
