import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToolCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  className?: string;
};

export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
  className,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-w-0 items-start gap-3 rounded-lg border border-fd-border/70 px-4 py-3',
        'bg-fd-background transition-colors',
        'hover:bg-fd-accent/40',
        className,
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-fd-secondary/50 text-fd-muted-foreground">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-fd-foreground">
            {title}
          </span>

          <ArrowUpRight className="size-3.5 text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <p className="mt-1 text-[13px] leading-5 text-fd-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  );
}
