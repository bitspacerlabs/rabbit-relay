import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

type FeatureCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  className?: string;
  external?: boolean;
};

export function FeatureCard({
  title,
  description,
  href,
  icon: Icon,
  className,
  external,
}: FeatureCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-fd-primary/8 text-fd-primary shadow-sm">
          <Icon className="size-5" />
        </div>

        <ArrowUpRight className="size-4 text-fd-muted-foreground opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>

      <div className="mt-5">
        <h3 className="m-0 text-[15px] font-semibold tracking-tight text-fd-foreground">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
          {description}
        </p>
      </div>
    </>
  );

  const classes = cn(
    'group relative block overflow-hidden rounded-2xl border bg-fd-card p-5',
    'transition-all duration-200',
    'hover:-translate-y-0.5 hover:border-fd-primary/30 hover:shadow-lg hover:shadow-fd-primary/5',
    'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-fd-primary/35 before:to-transparent before:opacity-0 before:transition-opacity',
    'hover:before:opacity-100',
    className,
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={classes}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
