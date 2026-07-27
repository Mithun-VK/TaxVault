import { ArrowRight, Plus, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface FeatureTileProps {
  label: string;
  icon: LucideIcon;
  color: string;
  /** One-line descriptor of what lives in this section. */
  description: string;
  /** Live count (omit for sections without one, e.g. Company). */
  count?: number;
  unit?: string;
  loading?: boolean;
  onOpen: () => void;
  /** Admin-only quick-add; renders a "+" that doesn't trigger navigation. */
  onAdd?: () => void;
}

/**
 * A large, prominent launcher for the Home hub's primary sections
 * (Properties · Individuals · Company). Richer than HomeTile: a big count, a
 * descriptor and a clear call-to-action, with a colour-tinted header.
 */
export function FeatureTile({
  label,
  icon: Icon,
  color,
  description,
  count,
  unit,
  loading = false,
  onOpen,
  onAdd,
}: FeatureTileProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${label}`}
      className="group relative flex min-h-[200px] cursor-pointer flex-col overflow-hidden p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
    >
      {/* Colour wash + top accent tie the card to its section. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.07] transition-opacity duration-200 group-hover:opacity-[0.12]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Add ${label}`}
            title={`Add ${label}`}
            className="flex h-9 items-center gap-1 rounded-lg border border-surface-border bg-white px-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-transparent hover:bg-brand-navy-muted hover:text-brand-navy"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New
          </button>
        )}
      </div>

      <div className="mt-4 flex-1">
        <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-24" />
        ) : count !== undefined ? (
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold tabular-nums text-slate-900">
              {count}
            </span>
            <span className="text-sm text-slate-600">
              {unit ?? 'item'}
              {count === 1 ? '' : 's'}
            </span>
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-slate-600">{description}</p>
      </div>

      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-navy">
        Open
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}
