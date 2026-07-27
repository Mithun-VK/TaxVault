import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface CategoryCardProps {
  label: string;
  icon?: LucideIcon;
  color?: string;
  count: number;
  unit?: string;
  secondary?: string;
  onClick: () => void;
}

/**
 * A clickable category tile used by the Taxes/Bills drill-down landings —
 * pick a category to see the items inside it (mirrors the Assets owner flow).
 */
export function CategoryCard({
  label,
  icon: Icon,
  color = '#475569',
  count,
  unit = 'item',
  secondary,
  onClick,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group cursor-pointer text-left"
      aria-label={`View ${label}`}
    >
      <Card
        className="relative flex h-full items-center gap-4 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      >
        {/* Left accent strip tied to the category color */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
          style={{ backgroundColor: color }}
        />
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {Icon && <Icon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{label}</p>
          <p className="truncate text-sm text-slate-700">
            {count} {unit}
            {count === 1 ? '' : 's'}
            {secondary ? ` · ${secondary}` : ''}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-navy" />
      </Card>
    </button>
  );
}
