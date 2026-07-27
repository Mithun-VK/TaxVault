import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { toBackendPaymentMethod, toBackendTaxType } from './enumAdapters';
import { applySearch } from '@/utils/search';
import type { Tax, TaxCreate, TaxFilters, TaxUpdate } from '@/types';

// Backend TaxOut uses `asset_id`; the UI was built against `linked_asset_id`.
function fromBackend(tax: Tax & { asset_id?: string | null }): Tax {
  return { ...tax, linked_asset_id: tax.asset_id ?? tax.linked_asset_id ?? null };
}

function toBackendPayload(data: Partial<TaxCreate & TaxUpdate>) {
  const { linked_asset_id, individual_id, tax_type, ...rest } = data as TaxCreate & {
    linked_asset_id?: string | null;
    individual_id?: string | null;
  };
  return {
    ...rest,
    // Sent explicitly (null clears) so switching the tax type drops the old link.
    asset_id: linked_asset_id ?? null,
    individual_id: individual_id ?? null,
    tax_type: tax_type ? toBackendTaxType(tax_type) : undefined,
  };
}

function applyFilters(items: Tax[], filters?: TaxFilters): Tax[] {
  let result = items;
  if (filters?.assessment_year && filters.assessment_year !== 'all') {
    result = result.filter((t) => t.assessment_year === filters.assessment_year);
  }
  return applySearch(result, filters?.search, (t) => [t.description]);
}

export const useTaxes = (filters?: TaxFilters) =>
  useQuery({
    queryKey: ['taxes', filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (filters?.tax_type && filters.tax_type !== 'all') params.type = filters.tax_type;
      if (filters?.status && filters.status !== 'all') params.status = filters.status;
      const { data } = await api.get<{ items: Tax[]; total: number }>('/taxes/', { params });
      return applyFilters(data.items.map(fromBackend), filters);
    },
  });

export const useTax = (id: string | undefined) =>
  useQuery({
    queryKey: ['taxes', id],
    queryFn: () => api.get<Tax>(`/taxes/${id}`).then((r) => fromBackend(r.data)),
    enabled: !!id,
  });

export const useCreateTax = () =>
  useMutation({
    mutationFn: (data: TaxCreate) =>
      api.post<Tax>('/taxes/', toBackendPayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Tax obligation added');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not add tax obligation'),
  });

export const useUpdateTax = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaxUpdate }) =>
      api.patch<Tax>(`/taxes/${id}`, toBackendPayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: (tax) => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      queryClient.invalidateQueries({ queryKey: ['taxes', tax.id] });
      toast.success('Tax obligation updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update tax obligation'),
  });

export const useDeleteTax = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/taxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      toast.success('Tax obligation archived');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not archive tax obligation'),
  });

export interface PayEntityPayload {
  amount_paid: number;
  payment_date: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  receipt_document_id?: string | null;
}

export const usePayTax = () =>
  useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & PayEntityPayload) =>
      api
        .post<Tax>(`/taxes/${id}/pay`, { ...payload, payment_method: toBackendPaymentMethod(payload.payment_method) })
        .then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment recorded');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not record payment'),
  });
