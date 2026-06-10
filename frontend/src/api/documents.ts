import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { Document } from '@/types';

export function useDocuments(filters?: { category?: string; search?: string }) {
  return useQuery<Document[]>({
    queryKey: ['documents', filters],
    queryFn: async () => {
      const response = await apiClient.get('/documents', { params: filters });
      return response.data;
    },
  });
}

export function useDocumentUploadUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/documents/upload-url');
      return response.data; // Returns { upload_url: string, file_url: string }
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newDoc: Omit<Document, 'id' | 'upload_date' | 'is_attachment'>) => {
      const response = await apiClient.post('/documents', newDoc);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDocumentDownloadUrl(id: string) {
  return useQuery<{ download_url: string }>({
    queryKey: ['documentDownload', id],
    queryFn: async () => {
      const response = await apiClient.get(`/documents/${id}/download`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Document> }) => {
      const response = await apiClient.patch(`/documents/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/documents/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
