import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';

// User-defined jewellery categories, persisted in the database (previously
// browser-only localStorage). Built-in categories still live in the frontend
// constants; only the user's custom additions are stored/served here.
export interface GoldCategory {
  id: string;
  value: string;
  label: string;
  created_at: string;
}

export const goldCategoryKeys = ['gold-categories'] as const;

export const useGoldCategories = () =>
  useQuery({
    queryKey: goldCategoryKeys,
    queryFn: () =>
      api.get<{ items: GoldCategory[] }>('/gold-categories/').then((r) => r.data.items),
    staleTime: 5 * 60_000,
  });

export const useCreateGoldCategory = () =>
  useMutation({
    mutationFn: (data: { value: string; label: string }) =>
      api.post<GoldCategory>('/gold-categories/', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goldCategoryKeys }),
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not add category'),
  });

export const useDeleteGoldCategory = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/gold-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goldCategoryKeys });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Category deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not delete category'),
  });
