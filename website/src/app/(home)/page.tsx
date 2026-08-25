import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center px-6 py-32 text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-2xl leading-[1.05]">
        RabbitMQ for Node.js
      </h1>

      <p className="mt-5 text-lg text-fd-muted-foreground max-w-xl">
        Type-safe events, bounded retries, dead-letter pipelines.
        <br />
        Built on amqplib.
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
    </main>
  );
}
