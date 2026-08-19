import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { Bill, Payment } from '@/types';

export type AnalyticsPeriod = 'quarter' | 'year' | 'fy';

export interface MonthlySpend {
  month: string; // "2026-01"
  month_label: string; // "Jan 2026"
  taxes: number;
  insurance: number;
  bills: number;
  total: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface BillTrendItem {
  bill_id: string;
  provider_name: string;
  bill_type: string;
  months: { month: string; amount: number }[];
  avg: number;
  max: number;
  min: number;
  trend: 'rising' | 'falling' | 'stable';
}

// The backend caps `limit` at 100 and dates use the `from` alias.
const MAX = 100;

function isoDaysAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function periodStart(period: AnalyticsPeriod): string {
  const today = new Date();
  if (period === 'quarter') return isoDaysAgo(3);
  if (period === 'year') {
    const y = new Date(today);
    y.setFullYear(today.getFullYear() - 1);
    return y.toISOString().slice(0, 10);
  }
  // Indian FY: April 1 of current or previous year.
  const fyYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${fyYear}-04-01`;
}

/** First month (YYYY-MM) included in a period - used to slice monthly series. */
export function analyticsPeriodStartMonth(period: AnalyticsPeriod): string {
  return periodStart(period).slice(0, 7);
}

async function fetchPayments(params: Record<string, string | number>): Promise<Payment[]> {
  const { data } = await api.get<{ items: Payment[] }>('/payments/', {
    params: { limit: MAX, ...params },
  });
  return data.items ?? [];
}

export function useMonthlySpend(months = 12) {
  return useQuery({
    queryKey: ['analytics', 'monthly-spend', months],
    queryFn: async () => {
      const payments = await fetchPayments({ from: isoDaysAgo(months) });
      const monthMap: Record<string, MonthlySpend> = {};
      for (const p of payments) {
        const month = p.payment_date.slice(0, 7);
        const label = new Date(p.payment_date).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        });
        if (!monthMap[month]) {
          monthMap[month] = { month, month_label: label, taxes: 0, insurance: 0, bills: 0, total: 0 };
        }
        const amount = Number(p.amount_paid) || 0;
        monthMap[month].total += amount;
        if (p.entity_type === 'tax') monthMap[month].taxes += amount;
        else if (p.entity_type === 'insurance') monthMap[month].insurance += amount;
        else if (p.entity_type === 'bill') monthMap[month].bills += amount;
      }
      return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryBreakdown(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics', 'breakdown', period],
    queryFn: async () => {
      const payments = await fetchPayments({ from: periodStart(period) });
      const total = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      const groups: Record<string, { amount: number; count: number; label: string }> = {
        tax: { amount: 0, count: 0, label: 'Taxes' },
        insurance: { amount: 0, count: 0, label: 'Insurance' },
        bills: { amount: 0, count: 0, label: 'Bills' },
      };
      for (const p of payments) {
        const key = p.entity_type === 'bill' ? 'bills' : p.entity_type;
        if (groups[key]) {
          groups[key].amount += Number(p.amount_paid) || 0;
          groups[key].count++;
        }
      }
      return Object.entries(groups).map(([cat, g]) => ({
        category: cat,
        label: g.label,
        amount: g.amount,
        count: g.count,
        percentage: total > 0 ? Math.round((g.amount / total) * 100) : 0,
      })) as CategoryBreakdown[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface SpendPoint {
  id: string;
  category: 'tax' | 'bill' | 'insurance';
  sub_type: string;
  entity_id: string;
  name: string;
  month: string; // "2026-01"
  amount: number;
}

/**
 * Period-scoped, enriched payment points for the Spending Explorer. Fetches
 * payments with a day-precise `from` (same window as useCategoryBreakdown, so
 * the Explorer can't silently drop older in-period payments the newest-100
 * overall would miss), and resolves each payment's sub-type + display name from
 * the entity lists in one place.
 */
export function useSpendPoints(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: ['analytics', 'spend-points', period],
    queryFn: async (): Promise<SpendPoint[]> => {
      const [payments, taxesRes, billsRes, insRes] = await Promise.all([
        fetchPayments({ from: periodStart(period) }),
        api.get<{ items: { id: string; tax_type: string; description: string | null }[] }>(
          '/taxes/',
          { params: { limit: MAX } },
        ),
        api.get<{ items: Bill[] }>('/bills/', { params: { limit: MAX } }),
        api.get<{
          items: { id: string; insurance_type: string; provider_name: string; policy_number: string }[];
        }>('/insurance/', { params: { limit: MAX } }),
      ]);

      const info = new Map<string, { sub: string; name: string }>();
      for (const t of taxesRes.data.items ?? []) {
        info.set(t.id, { sub: t.tax_type, name: t.description || 'Tax' });
      }
      for (const b of billsRes.data.items ?? []) {
        info.set(b.id, { sub: b.bill_type, name: b.provider_name || b.bill_type });
      }
      for (const p of insRes.data.items ?? []) {
        const name = p.provider_name
          ? `${p.provider_name} · ${p.policy_number}`
          : p.policy_number || 'Policy';
        info.set(p.id, { sub: p.insurance_type, name });
      }

      const points: SpendPoint[] = [];
      for (const p of payments) {
        if (p.entity_type !== 'tax' && p.entity_type !== 'bill' && p.entity_type !== 'insurance') {
          continue;
        }
        const meta = info.get(p.entity_id);
        points.push({
          id: p.id,
          category: p.entity_type,
          sub_type: meta?.sub ?? 'other',
          entity_id: p.entity_id,
          name: meta?.name ?? 'Unknown',
          month: p.payment_date.slice(0, 7),
          amount: Number(p.amount_paid) || 0,
        });
      }
      return points;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBillTrends(months = 6) {
  return useQuery({
    queryKey: ['analytics', 'bill-trends', months],
    queryFn: async (): Promise<BillTrendItem[]> => {
      // Payments carry no provider/type, so resolve those from the bills list.
      const [payments, billsRes] = await Promise.all([
        fetchPayments({ entity_type: 'bill', from: isoDaysAgo(months) }),
        api.get<{ items: Bill[] }>('/bills/', { params: { limit: MAX } }),
      ]);
      const billInfo = new Map(
        (billsRes.data.items ?? []).map((b) => [b.id, b] as const),
      );

      const billMap: Record<string, { months: Record<string, number> }> = {};
      for (const p of payments) {
        if (!billMap[p.entity_id]) billMap[p.entity_id] = { months: {} };
        const month = p.payment_date.slice(0, 7);
        billMap[p.entity_id].months[month] =
          (billMap[p.entity_id].months[month] ?? 0) + (Number(p.amount_paid) || 0);
      }

      return Object.entries(billMap).map(([billId, b]) => {
        const info = billInfo.get(billId);
        const monthly = Object.entries(b.months)
          .sort(([a], [c]) => a.localeCompare(c))
          .map(([month, amount]) => ({ month, amount }));
        const amounts = monthly.map((m) => m.amount);
        const avg = amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;
        const max = amounts.length ? Math.max(...amounts) : 0;
        const min = amounts.length ? Math.min(...amounts) : 0;
        const last2 = amounts.slice(-2);
        const trend: BillTrendItem['trend'] =
          last2.length < 2
            ? 'stable'
            : last2[1] > last2[0] * 1.1
              ? 'rising'
              : last2[1] < last2[0] * 0.9
                ? 'falling'
                : 'stable';
        return {
          bill_id: billId,
          provider_name: info?.provider_name ?? 'Unknown',
          bill_type: info?.bill_type ?? 'other',
          months: monthly,
          avg,
          max,
          min,
          trend,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}
