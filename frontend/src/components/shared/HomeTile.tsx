import { ChevronRight, Plus, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface HomeTileProps {
  label: string;
  icon: LucideIcon;
  color?: string;
  /** Live count shown under the label (omit for tool tiles). */
  count?: number;
  unit?: string;
  loading?: boolean;
  onOpen: () => void;
  /** Admin-only quick-add; renders a "+" that doesn't trigger navigation. */
  onAdd?: () => void;
}

/**
 * A launcher tile for the Home hub — mirrors CategoryCard's accent strip + icon
 * chip + chevron, and adds an optional quick-add "+" for creatable sections.
 */
export function HomeTile({
  label,
  icon: Icon,
  color = '#475569',
  count,
  unit,
  loading = false,
  onOpen,
  onAdd,
}: HomeTileProps) {
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
      className="group relative flex cursor-pointer items-center gap-4 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
    >
      {/* Left accent strip tied to the section colour */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: color }}
      />
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-4 w-16" />
        ) : count !== undefined ? (
          <p className="truncate text-sm text-slate-700">
            <span className="font-mono tabular-nums text-slate-700">{count}</span>{' '}
            {unit ?? 'item'}
            {count === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="truncate text-sm text-slate-600">Open</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Add ${label}`}
            title={`Add ${label}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-slate-600',
              'transition-colors hover:bg-brand-navy-muted hover:text-brand-navy',
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <ChevronRight className="h-5 w-5 text-slate-500 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-navy" />
      </div>
    </Card>
  );
}
