import { Check, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import type { PremiumScheduleItem } from '@/types';

const CONFIG = {
  paid: { icon: Check, ring: 'bg-brand-teal text-white', label: 'Paid' },
  overdue: { icon: AlertTriangle, ring: 'bg-brand-danger text-white', label: 'Overdue' },
  upcoming: { icon: Clock, ring: 'bg-slate-200 text-slate-700', label: 'Upcoming' },
} as const;

export function PremiumTimeline({ schedule }: { schedule: PremiumScheduleItem[] }) {
  if (schedule.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-surface-border py-8 text-center text-sm text-slate-600">
        No premium schedule available.
      </p>
    );
  }

  return (
    <ol className="relative space-y-1">
      {schedule.map((item, idx) => {
        const cfg = CONFIG[item.status];
        const Icon = cfg.icon;
        const last = idx === schedule.length - 1;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn('flex h-7 w-7 items-center justify-center rounded-full', cfg.ring)}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {!last && <span className="my-0.5 w-px flex-1 bg-surface-border" />}
            </div>
            <div className="flex flex-1 items-center justify-between pb-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{formatDate(item.due_date)}</p>
                <p className="text-xs text-slate-600">
                  {cfg.label}
                  {item.paid_date ? ` · settled ${formatDate(item.paid_date)}` : ''}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums text-slate-700">
                {formatINR(item.amount)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
