import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useEntityInfoMap } from './entityInfo';
import { getCurrentFY } from '@/utils/dates';
import { getEntityTypeLabel } from '@/utils/formatters';
import type { Payment, PaymentFilters, PaymentSummary } from '@/types';

function inCurrentMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function inCurrentFY(dateStr: string): boolean {
  return getCurrentFY(new Date(dateStr)) === getCurrentFY();
}

export const usePayments = (filters?: PaymentFilters) => {
  // Shared, cached entity-info lookup (see entityInfo.ts) — the backend's
  // PaymentOut has no `entity_name`, and this resolver is deduped across
  // every caller (payments, dashboard, alerts) via a single query key.
  const infoMap = useEntityInfoMap();

  const listQuery = useQuery({
    queryKey: ['payments', filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (filters?.entity_type && filters.entity_type !== 'all') params.entity_type = filters.entity_type;
      if (filters?.date_from) params.from = filters.date_from;
      if (filters?.date_to) params.to = filters.date_to;
      const { data } = await api.get<{ items: Payment[]; total: number }>('/payments/', { params });
      return data.items;
    },
  });

  const data = useMemo(() => {
    if (!listQuery.data) return listQuery.data;
    let items: Payment[] = listQuery.data.map((p) => ({
      ...p,
      entity_name: infoMap.data?.get(p.entity_id)?.name ?? getEntityTypeLabel(p.entity_type),
    }));
    if (filters?.payment_method && filters.payment_method !== 'all') {
      items = items.filter((p) => p.payment_method === filters.payment_method);
    }
    return items;
  }, [listQuery.data, infoMap.data, filters?.payment_method]);

  return { ...listQuery, data, isLoading: listQuery.isLoading || infoMap.isLoading };
};

export const usePaymentSummary = () =>
  useQuery({
    queryKey: ['payments', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Payment[] }>('/payments/', { params: { limit: 100 } });
      const summary: PaymentSummary = data.items.reduce(
        (acc, p) => {
          const amount = Number(p.amount_paid);
          if (inCurrentMonth(p.payment_date)) acc.total_this_month += amount;
          if (inCurrentFY(p.payment_date)) acc.total_this_fy += amount;
          return acc;
        },
        { total_this_month: 0, total_this_fy: 0 },
      );
      return summary;
    },
  });

export const useEntityPayments = (entityId: string | undefined) =>
  useQuery({
    queryKey: ['payments', 'entity', entityId],
    queryFn: () =>
      api
        .get<{ items: Payment[] }>('/payments/', { params: { limit: 100 } })
        .then((r) => r.data.items.filter((p) => p.entity_id === entityId)),
    enabled: !!entityId,
  });

export const useDeletePayment = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not delete payment'),
  });

// There is no document linked automatically to a payment on the real backend
// (receipts are uploaded independently via the documents API), so this is a
// no-op kept only so existing callers don't need to branch on backend mode.
export const useReceiptUrl = () =>
  useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await api.get<{ download_url: string }>(`/documents/${documentId}/download`);
      return data.download_url;
    },
  });
