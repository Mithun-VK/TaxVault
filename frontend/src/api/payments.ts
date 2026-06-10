import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { Payment } from '@/types';

export function usePayments(obligationId?: string) {
  return useQuery<Payment[]>({
    queryKey: ['payments', { obligationId }],
    queryFn: async () => {
      const response = await apiClient.get('/payments', {
        params: obligationId ? { obligation_id: obligationId } : {},
      });
      return response.data;
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPayment: Omit<Payment, 'id'>) => {
      const response = await apiClient.post('/payments', newPayment);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] }); // Upload adds a document
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Payment> }) => {
      const response = await apiClient.patch(`/payments/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
    },
  });
}
