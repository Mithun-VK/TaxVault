import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CountdownChip } from '@/components/shared/CountdownChip';
import { useBillTrend } from '@/api/bills';
import { BILL_TYPES, billPriority } from '@/utils/constants';
import { formatINR, getBillTypeColor, getBillTypeIcon, getStatusLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import { cn } from '@/lib/utils';
import type { Bill } from '@/types';

interface BillCardProps {
  bill: Bill;
  onClick: (bill: Bill) => void;
}

/** Month-on-month delta — only meaningful for variable bills. */
function Comparison({ diff }: { diff: number | null }) {
  if (diff === null) return <p className="text-xs text-slate-500">No comparison yet</p>;
  if (diff === 0)
    return (
      <p className="flex items-center gap-1 text-xs text-slate-600">
        <Minus className="h-3 w-3" /> Same as last month
      </p>
    );
  const up = diff > 0;
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        up ? 'text-red-600' : 'text-emerald-600',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatINR(Math.abs(diff))} {up ? 'more' : 'less'}
    </p>
  );
}

export function BillCard({ bill, onClick }: BillCardProps) {
  const color = getBillTypeColor(bill.bill_type);
  const Icon = getBillTypeIcon(bill.bill_type);
  const typeMeta = BILL_TYPES.find((t) => t.value === bill.bill_type);
  const isVariable = billPriority(bill.bill_type) === 'variable';
  const { data: trend } = useBillTrend(isVariable ? bill.id : undefined);

  const amount = (isVariable ? trend?.lastMonth : undefined) ?? bill.average_amount;
  const sparkData = (trend?.amounts ?? []).map((a, i) => ({ i, amount: a }));

  return (
    <button
      type="button"
      onClick={() => onClick(bill)}
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
            <h3 className="truncate text-base font-semibold text-slate-900">
              {bill.name || bill.provider_name}
            </h3>
            <p className="truncate text-xs text-slate-600">
              {bill.name ? bill.provider_name : bill.account_number || '—'}
            </p>
          </div>
        </div>
        <StatusBadge status={bill.status} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-600">{isVariable ? 'Latest' : 'Amount'}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {formatINR(amount)}
          </p>
          {isVariable && (
            <div className="mt-1">
              <Comparison diff={trend?.diff ?? null} />
            </div>
          )}
        </div>
        {isVariable && sparkData.length > 1 && (
          <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" style={{ color }}>
          {typeMeta?.label ?? getStatusLabel(bill.bill_type)}
        </Badge>
        <Badge variant="outline" className="text-slate-700">
          {getStatusLabel(bill.billing_cycle)}
        </Badge>
        {bill.auto_pay && (
          <Badge variant="active" className="gap-1">
            <RefreshCw className="h-3 w-3" /> Auto-pay
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-border pt-4">
        <span className="truncate text-xs text-slate-600">
          Due {formatDate(bill.next_due_date)}
        </span>
        <CountdownChip date={bill.next_due_date} showIcon={false} />
      </div>
    </button>
  );
}
