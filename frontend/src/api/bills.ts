import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { toBackendBillingCycle, toBackendBillType, toBackendPaymentMethod } from './enumAdapters';
import { isOverdue } from '@/utils/dates';
import { applySearch } from '@/utils/search';
import type { Bill, BillCreate, BillFilters, BillUpdate, Payment } from '@/types';
import type { PayEntityPayload } from './taxes';

export interface BillTrend {
  /** Chronological amounts, most recent last (up to 6 points). */
  amounts: number[];
  lastMonth: number | null;
  prevMonth: number | null;
  /** lastMonth - prevMonth, or null when there isn't enough history. */
  diff: number | null;
}

/**
 * Month-on-month amounts for a single bill, derived from its payment history.
 * The backend has no per-entity payments filter, so we fetch bill payments and
 * bucket client-side (personal-scale data, capped at 200 rows).
 */
export const useBillTrend = (billId: string | undefined) =>
  useQuery({
    queryKey: ['bills', 'trend', billId],
    queryFn: async (): Promise<BillTrend> => {
      const { data } = await api.get<{ items: Payment[] }>('/payments/', {
        params: { entity_type: 'bill', limit: 100 },
      });
      const payments = (data.items ?? [])
        .filter((p) => p.entity_id === billId)
        .sort(
          (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
        );
      const amounts = payments.map((p) => Number(p.amount_paid) || 0);
      const lastMonth = amounts.length ? amounts[amounts.length - 1] : null;
      const prevMonth = amounts.length > 1 ? amounts[amounts.length - 2] : null;
      const diff = lastMonth != null && prevMonth != null ? lastMonth - prevMonth : null;
      return { amounts: amounts.slice(-6), lastMonth, prevMonth, diff };
    },
    enabled: !!billId,
    staleTime: 5 * 60 * 1000,
  });

// The backend tracks only `next_due_date` + `is_active` — there is no
// persisted "paid" state for a recurring bill, so status is derived.
function fromBackend(bill: Bill & { is_active?: boolean }): Bill {
  return { ...bill, status: isOverdue(bill.next_due_date) ? 'overdue' : 'pending' };
}

function toBackendPayload(data: Partial<BillCreate & BillUpdate>) {
  const { auto_pay, billing_cycle, bill_type, ...rest } = data as BillCreate & { auto_pay?: boolean };
  return {
    ...rest,
    ...(billing_cycle ? { billing_cycle: toBackendBillingCycle(billing_cycle) } : {}),
    ...(bill_type ? { bill_type: toBackendBillType(bill_type) } : {}),
  };
}

function searchBills(items: Bill[], term?: string): Bill[] {
  return applySearch(items, term, (b) => [b.provider_name]);
}

export const useBills = (filters?: BillFilters) =>
  useQuery({
    queryKey: ['bills', filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (filters?.bill_type && filters.bill_type !== 'all') params.type = filters.bill_type;
      const { data } = await api.get<{ items: Bill[]; total: number }>('/bills/', { params });
      let items = data.items.map(fromBackend);
      if (filters?.status && filters.status !== 'all') {
        items = items.filter((b) => b.status === filters.status);
      }
      return searchBills(items, filters?.search);
    },
  });

export const useBill = (id: string | undefined) =>
  useQuery({
    queryKey: ['bills', id],
    queryFn: () => api.get<Bill>(`/bills/${id}`).then((r) => fromBackend(r.data)),
    enabled: !!id,
  });

export const useCreateBill = () =>
  useMutation({
    mutationFn: (data: BillCreate) =>
      api.post<Bill>('/bills/', toBackendPayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bill added');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not add bill'),
  });

export const useUpdateBill = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: BillUpdate }) =>
      api.patch<Bill>(`/bills/${id}`, toBackendPayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills', bill.id] });
      toast.success('Bill updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update bill'),
  });

// The backend's DELETE /bills/{id} deactivates the bill (is_active=false).
export const useDeleteBill = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill deactivated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not deactivate bill'),
  });

export const usePayBill = () =>
  useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & PayEntityPayload) =>
      api
        .post<Bill>(`/bills/${id}/pay`, { ...payload, payment_method: toBackendPaymentMethod(payload.payment_method) })
        .then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bill payment recorded — next due date updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not record payment'),
  });
