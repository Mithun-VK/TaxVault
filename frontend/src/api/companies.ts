import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useCan } from '@/hooks/usePermissions';
import type {
  Asset,
  Company,
  CompanyCreate,
  CompanyDocument,
  CompanyDocumentCreate,
  CompanyUpdate,
} from '@/types';

export const companyKeys = {
  all: ['companies'] as const,
  lists: () => [...companyKeys.all, 'list'] as const,
  detail: (id: string) => [...companyKeys.all, 'detail', id] as const,
  documents: (id: string, category?: string) =>
    [...companyKeys.all, 'documents', id, category ?? 'all'] as const,
  assets: (id: string) => [...companyKeys.all, 'assets', id] as const,
};

export interface CompanyListResponse {
  items: Company[];
  total: number;
}

// Skipped entirely for roles without `company.view` - the sidebar renders this
// list on every page, so an unauthorised call would fire constantly.
export function useCompanies() {
  const canView = useCan('company.view');
  return useQuery({
    queryKey: companyKeys.lists(),
    enabled: canView,
    queryFn: async () => {
      const { data } = await api.get<CompanyListResponse>('/companies/', {
        params: { limit: 50 },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: companyKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<Company>(`/companies/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

export function useCompanyDocuments(id: string | undefined, category?: string) {
  return useQuery({
    queryKey: companyKeys.documents(id ?? '', category),
    queryFn: async () => {
      const { data } = await api.get<CompanyDocument[]>(`/companies/${id}/documents`, {
        params: category ? { category } : undefined,
      });
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

export function useCompanyAssets(id: string | undefined) {
  return useQuery({
    queryKey: companyKeys.assets(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ items: Asset[]; total: number }>(
        `/companies/${id}/assets`,
      );
      return data;
    },
    enabled: !!id && id !== 'new',
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateCompany() {
  return useMutation({
    mutationFn: async (data: CompanyCreate) => {
      const { data: resp } = await api.post<Company>('/companies/', data);
      return resp;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      toast.success(`${company.legal_name} added successfully`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateCompany() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & CompanyUpdate) => {
      const { data: resp } = await api.patch<Company>(`/companies/${id}`, data);
      return resp;
    },
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(company.id), company);
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      toast.success('Company updated');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useArchiveCompany() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/companies/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      toast.success('Company archived');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useAddCompanyDocument() {
  return useMutation({
    mutationFn: async ({
      companyId,
      ...data
    }: { companyId: string } & CompanyDocumentCreate) => {
      const { data: resp } = await api.post<CompanyDocument>(
        `/companies/${companyId}/documents`,
        data,
      );
      return resp;
    },
    onSuccess: (_doc, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: [...companyKeys.all, 'documents', companyId] });
      queryClient.invalidateQueries({ queryKey: companyKeys.detail(companyId) });
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      toast.success('Document added');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteCompanyDocument() {
  return useMutation({
    mutationFn: async ({ companyId, docId }: { companyId: string; docId: string }) => {
      const { data } = await api.delete(`/companies/${companyId}/documents/${docId}`);
      return data;
    },
    onSuccess: (_res, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: [...companyKeys.all, 'documents', companyId] });
      queryClient.invalidateQueries({ queryKey: companyKeys.detail(companyId) });
      queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      toast.success('Document deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useCompanyDocumentUploadUrl() {
  return useMutation({
    mutationFn: async ({
      companyId,
      category,
      fileName,
      mimeType,
      fileSizeKb,
    }: {
      companyId: string;
      category: string;
      fileName: string;
      mimeType: string;
      fileSizeKb?: number;
    }) => {
      const { data } = await api.post<{ upload_url: string; storage_key: string }>(
        `/companies/${companyId}/documents/upload-url`,
        {
          category,
          file_name: fileName,
          mime_type: mimeType,
          file_size_kb: fileSizeKb,
        },
      );
      return data;
    },
  });
}

/** Attach a property to a company, or detach it by passing `companyId: null`. */
export function useLinkAssetToCompany() {
  return useMutation({
    mutationFn: async ({
      assetId,
      companyId,
    }: {
      assetId: string;
      companyId: string | null;
    }) => {
      const { data } = await api.patch<Asset>(`/assets/${assetId}/company`, {
        company_id: companyId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
      // assets.ts keys its queries as ['assets', …] rather than via a keys object.
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Property link updated');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
