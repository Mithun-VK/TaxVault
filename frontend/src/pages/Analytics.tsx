import { useMemo, useState, type ReactNode } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarRange,
  Divide,
  PieChart as PieIcon,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { cn } from '@/lib/utils';
import {
  useMonthlySpend,
  useCategoryBreakdown,
  useBillTrends,
  useSpendPoints,
  analyticsPeriodStartMonth,
  type AnalyticsPeriod,
} from '@/api/analytics';
import { useAssets } from '@/api/assets';
import { useTaxes } from '@/api/taxes';
import { useInsurancePolicies } from '@/api/insurance';
import { useBills } from '@/api/bills';
import { usePayments } from '@/api/payments';
import { generateMasterReport } from '@/utils/reports';
import { VARIABLE_BILL_TYPES, BILL_TYPES, TAX_TYPES, INSURANCE_TYPES } from '@/utils/constants';
import {
  formatINR,
  formatINRCompact,
  getBillTypeColor,
  getTaxTypeColor,
  getInsuranceTypeColor,
} from '@/utils/formatters';
import type { BillType } from '@/types';

const COLORS = {
  taxes: '#1A3C6E',
  insurance: '#0F6E56',
  bills: '#D97706',
};
const CATEGORY_COLOR: Record<string, string> = {
  tax: COLORS.taxes,
  insurance: COLORS.insurance,
  bills: COLORS.bills,
};

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'fy', label: 'This FY' },
];

// ── Spending Explorer: cascading Category → Sub-type → Entity filter ──
type FocusCategory = 'all' | 'tax' | 'insurance' | 'bill';

const FOCUS_CATEGORIES: { key: FocusCategory; label: string }[] = [
  { key: 'all', label: 'All categories' },
  { key: 'tax', label: 'Taxes' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'bill', label: 'Bills' },
];

// Each category exposes its own sub-types (tax → tax types, bill → bill types…).
const SUBTYPES: Record<Exclude<FocusCategory, 'all'>, { value: string; label: string }[]> = {
  tax: TAX_TYPES,
  bill: BILL_TYPES,
  insurance: INSURANCE_TYPES,
};

const FOCUS_CATEGORY_COLOR: Record<Exclude<FocusCategory, 'all'>, string> = {
  tax: COLORS.taxes,
  bill: COLORS.bills,
  insurance: COLORS.insurance,
};

function subTypeColor(category: FocusCategory, sub: string): string {
  if (category === 'tax') return getTaxTypeColor(sub);
  if (category === 'bill') return getBillTypeColor(sub as BillType);
  if (category === 'insurance') return getInsuranceTypeColor(sub);
  return '#64748b';
}

function ChartCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: typeof Wallet;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
        {Icon && <Icon className="h-4 w-4 text-slate-600" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

function MoneyTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-surface-border bg-white p-3 text-sm shadow-md">
      {label && <p className="mb-1 font-medium text-slate-700">{label}</p>}
      {payload.map((row) => (
        <p key={row.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
            {row.name}
          </span>
          <span className="font-mono text-slate-800">{formatINR(row.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Analytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('quarter');

  // Spending Explorer cascading filter state.
  const [focusCat, setFocusCat] = useState<FocusCategory>('all');
  const [focusSub, setFocusSub] = useState<string>('all');
  const [focusEntity, setFocusEntity] = useState<string>('all');

  const { data: monthly = [], isLoading: monthlyLoading } = useMonthlySpend(12);
  const { data: breakdown = [], isLoading: breakdownLoading } = useCategoryBreakdown(period);
  const { data: billTrends = [] } = useBillTrends(6);
  // Period-scoped, enriched points backing the Spending Explorer (day-precise).
  const { data: enrichedPoints = [] } = useSpendPoints(period);

  // Lists for the Excel report.
  const { data: assets = [] } = useAssets();
  const { data: taxes = [] } = useTaxes();
  const { data: insurance = [] } = useInsurancePolicies();
  const { data: bills = [] } = useBills();
  const { data: allPayments = [] } = usePayments();

  const startMonth = analyticsPeriodStartMonth(period);
  const periodMonthly = useMemo(
    () => monthly.filter((m) => m.month >= startMonth),
    [monthly, startMonth],
  );

  const kpis = useMemo(() => {
    const cats = (m: (typeof periodMonthly)[number]) => m.taxes + m.insurance + m.bills;
    const total = periodMonthly.reduce((s, m) => s + cats(m), 0);
    const highest = periodMonthly.reduce(
      (best, m) => (cats(m) > best.value ? { label: m.month_label, value: cats(m) } : best),
      { label: '-', value: 0 },
    );
    const avg = periodMonthly.length ? total / periodMonthly.length : 0;
    const biggest = breakdown.reduce(
      (best, c) => (c.amount > best.amount ? c : best),
      { label: '-', amount: 0, percentage: 0 } as (typeof breakdown)[number],
    );
    return { total, highest, avg, biggest };
  }, [periodMonthly, breakdown]);

  const donutTotal = breakdown.reduce((s, c) => s + c.amount, 0);
  const hasData = periodMonthly.length > 0 || donutTotal > 0;

  // Full sub-type list for the chosen category, so the categories always show
  // (a type with no spend this period simply yields an empty chart).
  const subTypeOptions = focusCat === 'all' ? [] : SUBTYPES[focusCat];

  // Entity options for the chosen category + sub-type.
  const entityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of enrichedPoints) {
      if (focusCat !== 'all' && p.category !== focusCat) continue;
      if (focusSub !== 'all' && p.sub_type !== focusSub) continue;
      seen.set(p.entity_id, p.name);
    }
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedPoints, focusCat, focusSub]);

  const focus = useMemo(() => {
    const filtered = enrichedPoints.filter(
      (p) =>
        (focusCat === 'all' || p.category === focusCat) &&
        (focusSub === 'all' || p.sub_type === focusSub) &&
        (focusEntity === 'all' || p.entity_id === focusEntity),
    );
    const total = filtered.reduce((s, p) => s + p.amount, 0);
    const monthMap: Record<string, number> = {};
    for (const p of filtered) monthMap[p.month] = (monthMap[p.month] ?? 0) + p.amount;
    const series = Object.keys(monthMap)
      .sort()
      .map((month) => ({
        month,
        month_label: new Date(`${month}-01`).toLocaleDateString('en-IN', {
          month: 'short',
          year: '2-digit',
        }),
        amount: monthMap[month],
      }));
    return { total, count: filtered.length, series };
  }, [enrichedPoints, focusCat, focusSub, focusEntity]);

  const focusColor =
    focusCat === 'all'
      ? '#64748b'
      : focusSub !== 'all'
        ? subTypeColor(focusCat, focusSub)
        : FOCUS_CATEGORY_COLOR[focusCat];

  const variableTrends = useMemo(
    () =>
      billTrends
        .filter((t) => (VARIABLE_BILL_TYPES as readonly string[]).includes(t.bill_type))
        .sort((a, b) => {
          const rank = { rising: 0, stable: 1, falling: 2 } as const;
          return rank[a.trend] - rank[b.trend];
        }),
    [billTrends],
  );

  // "What changed this month" - bills whose last month moved >10% vs the prior.
  const insights = useMemo(() => {
    return billTrends
      .map((t) => {
        const n = t.months.length;
        if (n < 2) return null;
        const curr = t.months[n - 1].amount;
        const prev = t.months[n - 2].amount;
        if (!prev) return null;
        const diff = curr - prev;
        const pct = Math.round((diff / prev) * 100);
        return { ...t, curr, prev, diff, pct };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && Math.abs(x.pct) >= 10)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [billTrends]);

  const downloadReport = () =>
    generateMasterReport({ assets, taxes, insurance, bills, payments: allPayments, period });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                period === p.key ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={downloadReport}
          className="flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:px-4"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Download Excel Report</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* ROW 1 - KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStatCard
          label="Total spent"
          value={formatINRCompact(kpis.total)}
          icon={Wallet}
          accent="navy"
          loading={breakdownLoading}
        />
        <SummaryStatCard
          label="Highest month"
          value={kpis.highest.value ? formatINRCompact(kpis.highest.value) : '-'}
          sublabel={kpis.highest.label}
          icon={CalendarRange}
          accent="warning"
          loading={monthlyLoading}
        />
        <SummaryStatCard
          label="Avg monthly"
          value={kpis.avg ? formatINRCompact(kpis.avg) : '-'}
          icon={Divide}
          accent="teal"
          loading={monthlyLoading}
        />
        <SummaryStatCard
          label="Biggest category"
          value={kpis.biggest.label}
          sublabel={kpis.biggest.percentage ? `${kpis.biggest.percentage}% of spend` : undefined}
          icon={PieIcon}
          accent="slate"
          loading={breakdownLoading}
        />
      </div>

      {!hasData && !monthlyLoading && !breakdownLoading ? (
        <ChartCard title="Monthly Spending Breakdown">
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex items-end gap-2 opacity-40">
              {[40, 64, 32, 52].map((h, i) => (
                <div key={i} className="w-8 rounded-t bg-slate-200" style={{ height: h }} />
              ))}
            </div>
            <p className="text-sm text-slate-600">Make your first payment to see analytics</p>
          </div>
        </ChartCard>
      ) : (
        <>
          {/* ROW 2 - Monthly stacked bar */}
          <ChartCard title="Monthly Spending Breakdown">
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodMonthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month_label"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatINRCompact(Number(v))}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="taxes" name="Taxes" stackId="a" fill={COLORS.taxes} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="insurance" name="Insurance" stackId="a" fill={COLORS.insurance} />
                  <Bar dataKey="bills" name="Bills" stackId="a" fill={COLORS.bills} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* ROW 2b - Spending Explorer (Category → Sub-type → Entity) */}
          <ChartCard title="Spending Explorer" icon={Filter}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {/* Level 1 - category */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Category</label>
                  <Select
                    value={focusCat}
                    onValueChange={(v) => {
                      setFocusCat(v as FocusCategory);
                      setFocusSub('all');
                      setFocusEntity('all');
                    }}
                  >
                    <SelectTrigger className="sm:w-44" aria-label="Filter by category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOCUS_CATEGORIES.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Level 2 - sub-type (only when a category is chosen) */}
                {focusCat !== 'all' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      {focusCat === 'tax' ? 'Tax type' : focusCat === 'bill' ? 'Bill type' : 'Policy type'}
                    </label>
                    <Select
                      value={focusSub}
                      onValueChange={(v) => {
                        setFocusSub(v);
                        setFocusEntity('all');
                      }}
                    >
                      <SelectTrigger className="sm:w-48" aria-label="Filter by sub-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          All {focusCat === 'tax' ? 'tax types' : focusCat === 'bill' ? 'bill types' : 'policy types'}
                        </SelectItem>
                        {subTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Level 3 - specific entity (only when a category is chosen) */}
                {focusCat !== 'all' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      {focusCat === 'tax' ? 'Obligation' : focusCat === 'bill' ? 'Provider' : 'Policy'}
                    </label>
                    <Select value={focusEntity} onValueChange={setFocusEntity}>
                      <SelectTrigger className="sm:w-56" aria-label="Filter by entity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          All {focusCat === 'tax' ? 'obligations' : focusCat === 'bill' ? 'providers' : 'policies'}
                        </SelectItem>
                        {entityOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-600">
                  Spent this {period === 'quarter' ? 'quarter' : period === 'year' ? 'year' : 'FY'}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {formatINR(focus.total)}
                </p>
                <p className="text-xs text-slate-600">
                  {focus.count} payment{focus.count === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="mt-4 h-56 w-full">
              {focus.series.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-600">
                  <p>No payments for this selection in {PERIODS.find((p) => p.key === period)?.label.toLowerCase()}.</p>
                  {period !== 'fy' && (
                    <p className="text-xs">
                      Taxes and insurance are often paid yearly - try{' '}
                      <button
                        type="button"
                        onClick={() => setPeriod('fy')}
                        className="font-medium text-brand-navy hover:underline"
                      >
                        This FY
                      </button>
                      .
                    </p>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={focus.series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month_label"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatINRCompact(Number(v))}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                    />
                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="amount" name="Spent" fill={focusColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          {/* ROW 3 - donut + bill trends */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Spending by Category">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="amount"
                        nameKey="label"
                        innerRadius={58}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {breakdown.map((c) => (
                          <Cell key={c.category} fill={CATEGORY_COLOR[c.category] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip content={<MoneyTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-slate-600">Total</span>
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {formatINRCompact(donutTotal)}
                    </span>
                  </div>
                </div>
                <ul className="flex-1 space-y-2">
                  {breakdown.map((c) => (
                    <li key={c.category} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLOR[c.category] ?? '#94a3b8' }}
                        />
                        {c.label}
                      </span>
                      <span className="font-mono text-slate-800">
                        {formatINR(c.amount)}
                        <span className="ml-1.5 text-xs text-slate-600">{c.percentage}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            <ChartCard title="Variable Bill Trends">
              {variableTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">
                  No variable-bill payment history yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-600">
                        <th className="pb-2 font-medium">Bill</th>
                        <th className="pb-2 text-right font-medium">Avg</th>
                        <th className="pb-2 text-right font-medium">Min</th>
                        <th className="pb-2 text-right font-medium">Max</th>
                        <th className="pb-2 text-right font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variableTrends.map((t) => (
                        <tr key={t.bill_id} className="border-t border-surface-border">
                          <td className="py-2 pr-2 font-medium text-slate-700">{t.provider_name}</td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                            {formatINR(Math.round(t.avg))}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                            {formatINR(t.min)}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                            {formatINR(t.max)}
                          </td>
                          <td className="py-2 text-right">
                            <TrendPill trend={t.trend} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          {/* ROW 4 - What changed this month */}
          <ChartCard title="What Changed This Month?">
            {insights.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                All bills are within normal range this month.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insights.map((x) => {
                  const up = x.diff > 0;
                  return (
                    <div
                      key={x.bill_id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        up ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/60',
                      )}
                    >
                      {up ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {x.provider_name} {up ? 'increased' : 'decreased'} by{' '}
                          {formatINR(Math.abs(x.diff))} ({Math.abs(x.pct)}% {up ? 'higher' : 'lower'})
                        </p>
                        <p className="text-xs text-slate-700">
                          {formatINR(x.curr)} this month vs {formatINR(x.prev)} previously
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function TrendPill({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <TrendingUp className="h-3 w-3" /> Rising
      </span>
    );
  }
  if (trend === 'falling') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <TrendingDown className="h-3 w-3" /> Falling
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
      <Minus className="h-3 w-3" /> Stable
    </span>
  );
}
