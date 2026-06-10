import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { AlertConfig, AlertLog } from '@/types';

export function useAlertConfigs() {
  return useQuery<AlertConfig[]>({
    queryKey: ['alertConfigs'],
    queryFn: async () => {
      const response = await apiClient.get('/alerts/config');
      return response.data;
    },
  });
}

export function useUpdateAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AlertConfig> }) => {
      const response = await apiClient.patch(`/alerts/config/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      queryClient.invalidateQueries({ queryKey: ['alertLogs'] });
    },
  });
}

export function useAlertLogs(obligationId?: string) {
  return useQuery<AlertLog[]>({
    queryKey: ['alertLogs', { obligationId }],
    queryFn: async () => {
      const response = await apiClient.get('/alerts/logs', {
        params: obligationId ? { obligation_id: obligationId } : {},
      });
      return response.data;
    },
  });
}
