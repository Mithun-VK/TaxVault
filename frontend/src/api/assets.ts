import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { applySearch } from '@/utils/search';
import { useCan } from '@/hooks/usePermissions';
import type { Asset, AssetCreate, AssetFilters, AssetType, AssetUpdate } from '@/types';

// The backend has no full-text search param — it's applied client-side
// against the (small, personal-scale) result set fetched per page.
function searchAssets(items: Asset[], term?: string): Asset[] {
  return applySearch(items, term, (a) => [a.name, a.description]);
}

// Legacy asset types are normalized to their current names on read. The DB
// migrations convert them permanently (0008 land→vacant_land, 0012
// building→residential_building & vacant_land→non_agricultural_land); this is a
// belt-and-braces guard for any stragglers / cached rows.
const LEGACY_ASSET_TYPE: Record<string, AssetType> = {
  land: 'non_agricultural_land',
  vacant_land: 'non_agricultural_land',
  building: 'residential_building',
};

function withDerivedStatus(asset: Asset & { is_archived?: boolean }): Asset {
  return {
    ...asset,
    status: asset.is_archived ? 'archived' : asset.status,
    asset_type: LEGACY_ASSET_TYPE[asset.asset_type] ?? asset.asset_type,
  };
}

// Roles without `properties.view` (members) get a 403 from /assets, and the
// hook is called from shared surfaces they *can* reach — the home hub, the
// command palette. Skipping the request there keeps those pages clean rather
// than papering over an error; callers already default to an empty list.
export const useAssets = (filters?: AssetFilters) => {
  const canView = useCan('properties.view');
  return useQuery({
    queryKey: ['assets', filters ?? {}],
    enabled: canView,
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { limit: 100 };
      if (filters?.asset_type && filters.asset_type !== 'all') params.asset_type = filters.asset_type;
      if (filters?.status && filters.status !== 'all' && filters.status !== 'archived') {
        params.status = filters.status;
      }
      // Reports opt in to archived rows so nothing is silently missing.
      if (filters?.include_archived) params.include_archived = true;
      const { data } = await api.get<{ items: Asset[]; total: number }>('/assets/', { params });
      let items = data.items.map(withDerivedStatus);
      if (filters?.status === 'archived') items = items.filter((a) => a.status === 'archived');
      return searchAssets(items, filters?.search);
    },
  });
};

export const useAsset = (id: string | undefined) =>
  useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.get<Asset>(`/assets/${id}`).then((r) => withDerivedStatus(r.data)),
    enabled: !!id,
  });

export const useCreateAsset = () =>
  useMutation({
    mutationFn: (data: AssetCreate) => api.post<Asset>('/assets/', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Asset created');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not create asset'),
  });

export const useUpdateAsset = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssetUpdate }) =>
      api.patch<Asset>(`/assets/${id}`, data).then((r) => r.data),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', asset.id] });
      toast.success('Asset updated');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update asset'),
  });

// The backend's DELETE /assets/{id} archives (sets is_archived=true) rather than hard-deleting.
export const useArchiveAsset = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset archived');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not archive asset'),
  });

export const useDeleteAsset = useArchiveAsset;
