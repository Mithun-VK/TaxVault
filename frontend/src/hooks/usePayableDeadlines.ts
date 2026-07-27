import { useMemo } from 'react';
import { useTaxes } from '@/api/taxes';
import { useBills } from '@/api/bills';
import { useInsurancePolicies } from '@/api/insurance';
import { toInputDate } from '@/utils/dates';
import type { Payable } from '@/types';

/**
 * Merges taxes, insurance premiums and bills into a single sorted list of
 * outstanding payables, plus a date-keyed index for the calendar.
 */
export function usePayableDeadlines() {
  const taxes = useTaxes();
  const bills = useBills();
  const insurance = useInsurancePolicies();

  const payables = useMemo<Payable[]>(() => {
    const list: Payable[] = [];

    (taxes.data ?? []).forEach((t) => {
      if (t.status === 'paid' || t.status === 'exempt') return;
      list.push({
        id: `tax-${t.id}`,
        entity_type: 'tax',
        entity_id: t.id,
        name: t.description,
        amount: t.total_amount,
        due_date: t.due_date,
        status: t.status,
      });
    });

    (bills.data ?? []).forEach((b) => {
      if (b.status === 'paid') return;
      list.push({
        id: `bill-${b.id}`,
        entity_type: 'bill',
        entity_id: b.id,
        name: b.provider_name,
        amount: b.average_amount,
        due_date: b.next_due_date,
        status: b.status,
      });
    });

    (insurance.data ?? []).forEach((p) => {
      if (p.status !== 'active') return;
      list.push({
        id: `ins-${p.id}`,
        entity_type: 'insurance',
        entity_id: p.id,
        name: `${p.provider} premium`,
        amount: p.premium_amount,
        due_date: p.next_premium_date,
        status: p.status,
      });
    });

    return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [taxes.data, bills.data, insurance.data]);

  const byDate = useMemo(() => {
    const map = new Map<string, Payable[]>();
    payables.forEach((p) => {
      const key = toInputDate(p.due_date);
      const existing = map.get(key) ?? [];
      existing.push(p);
      map.set(key, existing);
    });
    return map;
  }, [payables]);

  return {
    payables,
    byDate,
    isLoading: taxes.isLoading || bills.isLoading || insurance.isLoading,
  };
}
