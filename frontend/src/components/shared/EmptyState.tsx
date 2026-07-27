import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-white px-6 py-16 text-center',
        className,
      )}
    >
      <div className="relative">
        <div
          className="absolute inset-0 scale-150 rounded-full bg-brand-navy-muted/40 blur-xl"
          aria-hidden="true"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-navy-muted text-brand-navy/60">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>
      <h3 className="mt-6 text-base font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
