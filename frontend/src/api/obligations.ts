import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { Obligation } from '@/types';

export function useObligations(filters?: {
  search?: string;
  status?: string;
  tax_type?: string;
  fy?: string;
}) {
  return useQuery<Obligation[]>({
    queryKey: ['obligations', filters],
    queryFn: async () => {
      const response = await apiClient.get('/obligations', { params: filters });
      return response.data;
    },
  });
}

export function useObligation(id: string) {
  return useQuery<Obligation>({
    queryKey: ['obligation', id],
    queryFn: async () => {
      const response = await apiClient.get(`/obligations/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateObligation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newObligation: Omit<Obligation, 'id' | 'status' | 'is_archived'>) => {
      const response = await apiClient.post('/obligations', newObligation);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
    },
  });
}

export function useUpdateObligation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Obligation> }) => {
      const response = await apiClient.patch(`/obligations/${id}`, updates);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      queryClient.invalidateQueries({ queryKey: ['obligation', variables.id] });
    },
  });
}

export function useArchiveObligation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/obligations/${id}`, { is_archived: true });
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      queryClient.invalidateQueries({ queryKey: ['obligation', id] });
    },
  });
}
