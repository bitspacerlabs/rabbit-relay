import Link from 'next/link';
import { ArrowRight, BookOpen, MessageCircleQuestion } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 gap-6 py-16">
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
        Rabbit Relay
      </h1>
      <p className="text-lg text-fd-muted-foreground max-w-xl mx-auto">
        A stable, type-safe RabbitMQ framework for Node.js.
        Explicit topology, bounded retries, dead-letter queues, and publisher
        confirms — nothing hidden behind magic.
      </p>
      <div className="flex flex-row gap-3 justify-center mt-2">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:opacity-90"
        >
          Get Started <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/docs/retry-dlq"
          className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-muted"
        >
          <MessageCircleQuestion className="size-4" /> Retry &amp; DLQ Guide
        </Link>
      </div>
      <div className="flex flex-row gap-6 justify-center mt-8 text-sm text-fd-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="size-4" /> Type-safe event contracts
        </span>
        <span className="hidden sm:inline">·</span>
        <span>At-least-once delivery</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden md:inline">Broker-native retries &amp; backoff</span>
      </div>
    </div>
  );
}
