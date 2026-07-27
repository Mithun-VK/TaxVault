import { Link2, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CountdownChip } from '@/components/shared/CountdownChip';
import { TAX_TYPES } from '@/utils/constants';
import { formatINR, getStatusLabel, getTaxTypeColor } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import type { Tax } from '@/types';

interface TaxCardProps {
  tax: Tax;
  /** Opens the tax's detail page (where Edit / Record payment live). */
  onView: (tax: Tax) => void;
}

export function TaxCard({ tax, onView }: TaxCardProps) {
  const color = getTaxTypeColor(tax.tax_type);
  const typeMeta = TAX_TYPES.find((t) => t.value === tax.tax_type);
  const Icon = typeMeta?.icon ?? Receipt;
  const settled = tax.status === 'paid' || tax.status === 'exempt';

  return (
    <button
      type="button"
      onClick={() => onView(tax)}
      className="flex w-full flex-col rounded-xl border border-surface-border bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{tax.name || tax.description}</h3>
            {tax.linked_asset_name && (
              <p className="flex items-center gap-1 truncate text-xs text-slate-600">
                <Link2 className="h-3 w-3 shrink-0" /> {tax.linked_asset_name}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={tax.status} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-600">Amount</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {formatINR(tax.total_amount)}
          </p>
        </div>
        {!settled && <CountdownChip date={tax.due_date} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" style={{ color }}>
          {typeMeta?.label ?? getStatusLabel(tax.tax_type)}
        </Badge>
        <Badge variant="outline" className="text-slate-700">
          AY {tax.assessment_year}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-border pt-4">
        <span className="truncate text-xs text-slate-600">Due {formatDate(tax.due_date)}</span>
      </div>
    </button>
  );
}
