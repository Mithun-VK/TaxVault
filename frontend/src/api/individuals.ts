import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useCan } from '@/hooks/usePermissions';
import type {
  Asset,
  IdentityDocType,
  Individual,
  IndividualCreate,
  IndividualUpdate,
} from '@/types';

export const individualKeys = {
  all: ['individuals'] as const,
  lists: () => [...individualKeys.all, 'list'] as const,
  detail: (id: string) => [...individualKeys.all, 'detail', id] as const,
  assets: (id: string) => [...individualKeys.all, 'assets', id] as const,
};

export interface IndividualList {
  items: Individual[];
  total: number;
}

// Skipped entirely for roles without `individuals.view` — the sidebar renders
// this list on every page, so an unauthorised call would fire constantly.
export function useIndividuals() {
  const canView = useCan('individuals.view');
  return useQuery({
    queryKey: individualKeys.lists(),
    enabled: canView,
    queryFn: async () => {
      const { data } = await api.get<IndividualList>('/individuals/', {
        params: { limit: 50 },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useIndividual(id: string | undefined) {
  return useQuery({
    queryKey: individualKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<Individual>(`/individuals/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

export function useIndividualAssets(id: string | undefined) {
  return useQuery({
    queryKey: individualKeys.assets(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ items: Asset[]; total: number }>(
        `/individuals/${id}/assets`,
      );
      return data;
    },
    enabled: !!id && id !== 'new',
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateIndividual() {
  return useMutation({
    mutationFn: async (data: IndividualCreate) => {
      const { data: resp } = await api.post<Individual>('/individuals/', data);
      return resp;
    },
    onSuccess: (individual) => {
      queryClient.invalidateQueries({ queryKey: individualKeys.lists() });
      toast.success(`${individual.full_name} added successfully`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateIndividual() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & IndividualUpdate) => {
      const { data: resp } = await api.patch<Individual>(`/individuals/${id}`, data);
      return resp;
    },
    onSuccess: (individual) => {
      queryClient.setQueryData(individualKeys.detail(individual.id), individual);
      queryClient.invalidateQueries({ queryKey: individualKeys.lists() });
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useArchiveIndividual() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/individuals/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: individualKeys.lists() });
      toast.success('Profile archived');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useIdentityDocUploadUrl() {
  return useMutation({
    mutationFn: async ({
      individualId,
      docType,
      fileName,
      mimeType,
    }: {
      individualId: string;
      docType: IdentityDocType;
      fileName: string;
      mimeType: string;
    }) => {
      const { data } = await api.post<{ upload_url: string; storage_key: string }>(
        `/individuals/${individualId}/documents/upload-url`,
        { doc_type: docType, file_name: fileName, mime_type: mimeType },
      );
      return data;
    },
  });
}
