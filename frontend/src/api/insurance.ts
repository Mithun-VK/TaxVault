import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import {
  toBackendInsuranceType,
  toBackendPaymentMethod,
  toBackendPolicyStatus,
  toBackendPremiumFrequency,
} from './enumAdapters';
import { applySearch } from '@/utils/search';
import type { InsuranceCreate, InsuranceFilters, InsurancePolicy, InsuranceUpdate } from '@/types';
import type { PayEntityPayload } from './taxes';

interface BackendInsurance {
  id: string;
  name?: string | null;
  asset_id?: string | null;
  individual_id?: string | null;
  policy_number: string;
  provider_name: string;
  insurance_type: string;
  sum_insured: number | null;
  premium_amount: number;
  premium_frequency: string;
  next_premium_date: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  maturity_date: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

function fromBackend(p: BackendInsurance): InsurancePolicy {
  return {
    id: p.id,
    name: p.name ?? null,
    policy_number: p.policy_number,
    provider: p.provider_name,
    insurance_type: p.insurance_type as InsurancePolicy['insurance_type'],
    sum_insured: p.sum_insured,
    premium_amount: p.premium_amount,
    premium_frequency: p.premium_frequency as InsurancePolicy['premium_frequency'],
    start_date: p.policy_start_date ?? '',
    end_date: p.policy_end_date ?? '',
    next_premium_date: p.next_premium_date ?? '',
    status: p.status as InsurancePolicy['status'],
    linked_asset_id: p.asset_id ?? null,
    linked_individual_id: p.individual_id ?? null,
    nominee: [p.nominee_name, p.nominee_relation].filter(Boolean).join(' · ') || undefined,
    notes: p.notes ?? '',
    schedule: [],
    claims: [],
    created_at: p.created_at,
    updated_at: p.updated_at ?? p.created_at,
  };
}

// Exported so the change-request flow can build the same backend-shaped
// payload a direct edit would send (see hooks/usePayableChange.ts).
export function toBackendInsurancePayload(data: Partial<InsuranceCreate & InsuranceUpdate>) {
  const {
    provider,
    start_date,
    end_date,
    linked_asset_id,
    linked_individual_id,
    nominee,
    status,
    premium_frequency,
    insurance_type,
    ...rest
  } = data as InsuranceCreate & InsuranceUpdate;
  return {
    ...rest,
    provider_name: provider,
    policy_start_date: start_date,
    policy_end_date: end_date,
    asset_id: linked_asset_id ?? null,
    individual_id: linked_individual_id ?? null,
    nominee_name: nominee,
    status: status ? toBackendPolicyStatus(status) : undefined,
    premium_frequency: premium_frequency ? toBackendPremiumFrequency(premium_frequency) : undefined,
    insurance_type: insurance_type ? toBackendInsuranceType(insurance_type) : undefined,
  };
}

function searchInsurance(items: InsurancePolicy[], term?: string): InsurancePolicy[] {
  return applySearch(items, term, (p) => [p.provider, p.policy_number]);
}

export const useInsurancePolicies = (filters?: InsuranceFilters) =>
  useQuery({
    queryKey: ['insurance', filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (filters?.insurance_type && filters.insurance_type !== 'all') params.type = filters.insurance_type;
      if (filters?.status && filters.status !== 'all') params.status = filters.status;
      const { data } = await api.get<{ items: BackendInsurance[]; total: number }>('/insurance/', { params });
      return searchInsurance(data.items.map(fromBackend), filters?.search);
    },
  });

export const useInsurancePolicy = (id: string | undefined) =>
  useQuery({
    queryKey: ['insurance', id],
    queryFn: () => api.get<BackendInsurance>(`/insurance/${id}`).then((r) => fromBackend(r.data)),
    enabled: !!id,
  });

export const useCreateInsurance = () =>
  useMutation({
    mutationFn: (data: InsuranceCreate) =>
      api.post<BackendInsurance>('/insurance/', toBackendInsurancePayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Policy added');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not add policy'),
  });

export const useUpdateInsurance = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsuranceUpdate }) =>
      api.patch<BackendInsurance>(`/insurance/${id}`, toBackendInsurancePayload(data)).then((r) => fromBackend(r.data)),
    onSuccess: (policy) => {
      queryClient.invalidateQueries({ queryKey: ['insurance'] });
      queryClient.invalidateQueries({ queryKey: ['insurance', policy.id] });
      toast.success('Policy updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update policy'),
  });

export const useDeleteInsurance = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/insurance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance'] });
      toast.success('Policy archived');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not archive policy'),
  });

export const usePayPremium = () =>
  useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & PayEntityPayload) =>
      api
        .post<BackendInsurance>(`/insurance/${id}/pay-premium`, {
          ...payload,
          payment_method: toBackendPaymentMethod(payload.payment_method),
        })
        .then((r) => fromBackend(r.data)),
    onSuccess: (policy) => {
      queryClient.invalidateQueries({ queryKey: ['insurance'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Premium paid - next due date: ${policy.next_premium_date}`);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not record payment'),
  });
