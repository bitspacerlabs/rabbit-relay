import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Rabbit } from 'lucide-react';

const codeLines = [
  [
    { t: 'import', c: 'text-fd-primary' },
    { t: ' { RabbitMQBroker, event } ', c: '' },
    { t: 'from', c: 'text-fd-primary' },
    { t: ' ', c: '' },
    { t: '"@bitspacerlabs/rabbit-relay"', c: 'text-emerald-400' },
  ],
  [{ t: '', c: '' }],
  [
    { t: 'const', c: 'text-fd-primary' },
    { t: ' broker = ', c: '' },
    { t: 'new', c: 'text-fd-primary' },
    { t: ' RabbitMQBroker(', c: '' },
    { t: '"orders"', c: 'text-emerald-400' },
    { t: ')', c: '' },
  ],
  [
    { t: 'const', c: 'text-fd-primary' },
    { t: ' orderCreated = event(', c: '' },
    { t: '"orderCreated"', c: 'text-emerald-400' },
    { t: ').of<', c: '' },
    { t: '{ orderId: string }', c: 'text-sky-400' },
    { t: '>()', c: '' },
  ],
  [{ t: '', c: '' }],
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
    { t: '  .exchange(', c: '' },
    { t: '"orders.ex"', c: 'text-emerald-400' },
    { t: ', { exchangeType: ', c: '' },
    { t: '"topic"', c: 'text-emerald-400' },
    { t: ' })', c: '' },
  ],
  [
    { t: '  .with({ ', c: '' },
    { t: 'orderCreated', c: 'text-sky-400' },
    { t: ' });', c: '' },
  ],
  [{ t: '', c: '' }],
  [
    { t: 'api.', c: '' },
    { t: 'handle', c: 'text-fd-primary' },
    { t: '(', c: '' },
    { t: '"orderCreated"', c: 'text-emerald-400' },
    { t: ', ', c: '' },
    { t: 'async', c: 'text-fd-primary' },
    { t: ' (_id, ev) => {', c: '' },
  ],
  [
    { t: '  ', c: '' },
    { t: 'await', c: 'text-fd-primary' },
    { t: ' processPayment(ev.data.orderId)', c: '' },
  ],
  [
    { t: '});', c: '' },
  ],
  [{ t: '', c: '' }],
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
    <main className="flex flex-col flex-1 items-center justify-center px-6 py-32 text-center">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.12),transparent)]"
      />

      <div className="inline-flex items-center gap-2 rounded-full border bg-fd-background/70 backdrop-blur px-3 py-1 text-xs font-medium text-fd-muted-foreground mb-8">
        <Rabbit className="size-3.5 text-fd-primary" />
        v1.5.0
      </div>

      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-2xl leading-[1.1]">
        RabbitMQ for Node.js,
        <br />
        <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 bg-clip-text text-transparent dark:from-orange-400 dark:via-orange-300 dark:to-amber-200">
          without the guesswork
        </span>
      </h1>

      <p className="mt-5 text-lg text-fd-muted-foreground max-w-xl">
        Type-safe events, bounded retries, dead-letter pipelines, publisher
        confirms. Built on amqplib.
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
          GitHub <ArrowUpRight className="size-4" />
        </a>
      </div>

      <div className="mt-16 w-full max-w-xl rounded-xl border bg-fd-card shadow-xl overflow-hidden text-left">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b bg-fd-muted/40">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-xs text-fd-muted-foreground font-medium">
            worker.ts
          </span>
        </div>
        <pre className="p-5 text-[13px] leading-relaxed overflow-hidden">
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
    </main>
  );
}
