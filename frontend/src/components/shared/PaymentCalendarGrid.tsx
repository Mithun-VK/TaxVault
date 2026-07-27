import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCalendarYear } from '@/api/dashboard';
import { formatINR, getEntityTypeLabel } from '@/utils/formatters';
import type { CalendarCellStatus, CalendarYearItem } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Worst-status wins for a cell's colour: overdue > due > paid.
const STATUS_RANK: Record<CalendarCellStatus, number> = { overdue: 3, due: 2, paid: 1 };

// Light tint keyed to the cell's worst status, so a busy day still pops while
// leaving room for readable dark bill names on top.
const CELL_BG: Record<CalendarCellStatus, string> = {
  overdue: 'bg-red-50 hover:bg-red-100',
  due: 'bg-amber-50 hover:bg-amber-100',
  paid: 'bg-teal-50 hover:bg-teal-100',
};

// Per-bill status dot, so cells mixing paid and unpaid items stay legible.
const STATUS_DOT: Record<CalendarCellStatus, string> = {
  overdue: 'bg-brand-danger',
  due: 'bg-amber-500',
  paid: 'bg-brand-teal',
};

interface Cell {
  total: number;
  status: CalendarCellStatus;
  items: CalendarYearItem[];
}

/** Binary paid / not-paid indicator for a single billing in the day popup. */
function PaidChip({ status }: { status: CalendarCellStatus }) {
  if (status === 'paid') {
    return (
      <span className="whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-teal">
        Paid
      </span>
    );
  }
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'overdue' ? 'bg-red-50 text-brand-danger' : 'bg-amber-50 text-amber-700',
      )}
    >
      Not paid
    </span>
  );
}

function cellKey(month: number, day: number) {
  return `${month}-${day}`;
}

/** Parse a YYYY-MM-DD string into {month:1-12, day:1-31} without timezone drift. */
function parseDue(due: string): { month: number; day: number } {
  const [, m, d] = due.split('-').map(Number);
  return { month: m, day: d };
}

export function PaymentCalendarGrid() {
  const navigate = useNavigate();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: items = [], isLoading } = useCalendarYear(year);
  const [selected, setSelected] = useState<{ month: number; day: number } | null>(null);

  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const it of items) {
      const { month, day } = parseDue(it.due_date);
      const key = cellKey(month, day);
      const existing = map.get(key);
      if (existing) {
        existing.total += it.amount ?? 0;
        existing.items.push(it);
        if (STATUS_RANK[it.status] > STATUS_RANK[existing.status]) existing.status = it.status;
      } else {
        map.set(key, { total: it.amount ?? 0, status: it.status, items: [it] });
      }
    }
    return map;
  }, [items]);

  const yearTotal = useMemo(() => items.reduce((s, it) => s + (it.amount ?? 0), 0), [items]);

  const selectedCell = selected ? cells.get(cellKey(selected.month, selected.day)) : undefined;

  // Open the specific billing's detail page, not its list page.
  const routeFor = (item: CalendarYearItem) => {
    switch (item.entity_type) {
      case 'bill':
        return `/bills/${item.entity_id}`;
      case 'tax':
        return `/taxes/${item.entity_id}`;
      case 'insurance':
      default:
        return `/insurance/${item.entity_id}`;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous year"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-16 text-center text-lg font-semibold tabular-nums text-slate-900">
            {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next year"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-700">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-200" /> Paid
          </span>
          <span className="font-mono tabular-nums text-slate-700">
            Year total: {formatINR(yearTotal)}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[560px] w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-slate-600">Day</th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="min-w-[128px] border-l border-surface-border bg-slate-50 px-1 py-2 font-medium text-slate-700"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} className="border-t border-surface-border">
                  <td className="sticky left-0 z-10 bg-white px-2 py-1 text-center font-mono tabular-nums text-slate-600">
                    {day}
                  </td>
                  {MONTHS.map((_, i) => {
                    const month = i + 1;
                    const cell = cells.get(cellKey(month, day));
                    if (!cell) {
                      return <td key={month} className="border-l border-surface-border" />;
                    }
                    return (
                      <td key={month} className="border-l border-surface-border p-0.5 align-top">
                        <button
                          type="button"
                          onClick={() => setSelected({ month, day })}
                          className={cn(
                            'flex w-full flex-col items-stretch gap-0.5 rounded-md px-1 py-1 text-left transition-colors',
                            CELL_BG[cell.status],
                          )}
                          title={`${cell.items.length} bill(s) · ${formatINR(cell.total)}`}
                        >
                          {cell.items.map((it, idx) => (
                            <span
                              key={`${it.entity_id}-${idx}`}
                              className="flex min-w-0 items-center gap-1"
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  STATUS_DOT[it.status],
                                )}
                              />
                              <span className="truncate font-medium text-slate-700">{it.name}</span>
                            </span>
                          ))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {/* Width grows to fit the longest billing name (up to the viewport) so
            names are never truncated; scrolls vertically if the day is busy. */}
        <DialogContent className="w-auto min-w-[20rem] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-baseline justify-between gap-6">
              <span>{selected && `${MONTHS[selected.month - 1]} ${selected.day}, ${year}`}</span>
              {selectedCell && (
                <span className="font-mono text-sm font-normal tabular-nums text-slate-700">
                  {formatINR(selectedCell.total)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-surface-border">
            {selectedCell?.items.map((item, idx) => (
              <button
                key={`${item.entity_id}-${idx}`}
                type="button"
                onClick={() => {
                  setSelected(null);
                  navigate(routeFor(item));
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-8 py-2.5 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 text-slate-700">
                    {getEntityTypeLabel(item.entity_type)}
                  </Badge>
                  <span className="whitespace-nowrap text-sm font-medium text-slate-800">
                    {item.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-slate-700">
                    {item.amount != null ? formatINR(item.amount) : '—'}
                  </span>
                  <PaidChip status={item.status} />
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
