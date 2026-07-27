import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { applySearch } from '@/utils/search';
import type { DocumentFilters, DocumentMetaCreate, TaxDocument } from '@/types';

interface BackendDocument {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  category: string | null;
  label: string;
  financial_year: string | null;
  tags: string[];
  storage_key: string;
  file_name: string | null;
  file_size_kb: number | null;
  mime_type: string | null;
  uploaded_at: string;
  is_deleted: boolean;
}

function fromBackend(d: BackendDocument): TaxDocument {
  return {
    id: d.id,
    label: d.label,
    category: (d.category ?? 'other') as TaxDocument['category'],
    financial_year: d.financial_year ?? '',
    file_name: d.file_name ?? '',
    file_size: (d.file_size_kb ?? 0) * 1024,
    mime_type: d.mime_type ?? '',
    tags: d.tags,
    entity_type: d.entity_type as TaxDocument['entity_type'],
    entity_id: d.entity_id,
    created_at: d.uploaded_at,
  };
}

function searchDocuments(items: TaxDocument[], term?: string): TaxDocument[] {
  return applySearch(items, term, (d) => [d.label]);
}

export const useDocuments = (filters?: DocumentFilters) =>
  useQuery({
    queryKey: ['documents', filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 100 };
      if (filters?.category && filters.category !== 'all') params.category = filters.category;
      const { data } = await api.get<{ items: BackendDocument[]; total: number }>('/documents/', { params });
      return searchDocuments(data.items.map(fromBackend), filters?.search);
    },
  });

export const useEntityDocuments = (entityId: string | undefined) =>
  useQuery({
    queryKey: ['documents', 'entity', entityId],
    queryFn: () =>
      api
        .get<{ items: BackendDocument[] }>('/documents/', { params: { entity_id: entityId, limit: 100 } })
        .then((r) => r.data.items.map(fromBackend)),
    enabled: !!entityId,
  });

export const useRequestUploadUrl = () =>
  useMutation({
    mutationFn: (file: { file_name: string; mime_type: string; file_size_kb?: number }) =>
      api.post<{ upload_url: string; storage_key: string }>('/documents/upload-url', file).then((r) => r.data),
  });

export const useCreateDocument = () =>
  useMutation({
    mutationFn: ({ file_size, ...rest }: DocumentMetaCreate) =>
      api
        .post<BackendDocument>('/documents/', {
          ...rest,
          file_size_kb: file_size ? Math.ceil(file_size / 1024) : undefined,
        })
        .then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Document uploaded');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not save document'),
  });

export const useUpdateDocument = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DocumentMetaCreate> }) =>
      api.patch<BackendDocument>(`/documents/${id}`, data).then((r) => fromBackend(r.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update document'),
  });

export const useDeleteDocument = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not delete document'),
  });

export const useDownloadUrl = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.get<{ download_url: string }>(`/documents/${id}/download`).then((r) => r.data.download_url),
  });

// Programmatic download avoids popup blockers that can swallow window.open(url, '_blank').
export function triggerDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
