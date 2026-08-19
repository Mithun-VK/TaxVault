import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { getStatusLabel } from '@/utils/formatters';

// The backend never denormalizes a human-readable name/amount/due_date onto
// payments, alert configs, or activity-log rows - it only stores entity_type
// + entity_id. This is the single shared resolver: one cached fetch of the
// (small, personal-scale) tax/bill/insurance lists, keyed so TanStack Query
// dedupes it across every caller (payments, dashboard, alerts) instead of
// each hook re-fetching its own copy.

export interface EntityInfo {
  name: string;
  amount: number;
  due_date: string;
}

export const entityInfoKeys = ['entity-info'] as const;

interface BackendTax {
  id: string;
  name: string | null;
  description: string | null;
  tax_type: string;
  total_amount: number | null;
  due_date: string;
}

interface BackendBill {
  id: string;
  name: string | null;
  provider_name: string | null;
  bill_type: string;
  average_amount: number | null;
  next_due_date: string;
}

interface BackendInsuranceLite {
  id: string;
  name: string | null;
  provider_name: string;
  policy_number: string;
  premium_amount: number;
  next_premium_date: string | null;
}

export function useEntityInfoMap() {
  return useQuery({
    queryKey: entityInfoKeys,
    queryFn: async () => {
      const [taxes, bills, insurance] = await Promise.all([
        api.get<{ items: BackendTax[] }>('/taxes/', { params: { limit: 100 } }).then((r) => r.data.items),
        api.get<{ items: BackendBill[] }>('/bills/', { params: { limit: 100 } }).then((r) => r.data.items),
        api
          .get<{ items: BackendInsuranceLite[] }>('/insurance/', { params: { limit: 100 } })
          .then((r) => r.data.items),
      ]);

      const map = new Map<string, EntityInfo>();
      taxes.forEach((t) =>
        map.set(t.id, {
          name: t.name || t.description || getStatusLabel(t.tax_type),
          amount: t.total_amount ?? 0,
          due_date: t.due_date,
        }),
      );
      bills.forEach((b) =>
        map.set(b.id, {
          name: b.name || b.provider_name || b.bill_type,
          amount: b.average_amount ?? 0,
          due_date: b.next_due_date,
        }),
      );
      insurance.forEach((p) =>
        map.set(p.id, {
          name: p.name || `${p.provider_name} · ${p.policy_number}`,
          amount: p.premium_amount,
          due_date: p.next_premium_date ?? '',
        }),
      );
      return map;
    },
    staleTime: 5 * 60_000,
  });
}
