import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useCan } from '@/hooks/usePermissions';
import type { ChangeEntityType } from '@/utils/permissions';

/**
 * The maker/checker queue. A member may add bills, taxes and insurance
 * policies outright, but an edit or delete is filed here and applied only once
 * an admin or super admin approves it.
 */
export type ChangeAction = 'update' | 'delete';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface ChangeRequest {
  id: string;
  entity_type: ChangeEntityType;
  entity_id: string;
  action: ChangeAction;
  payload: Record<string, unknown>;
  reason: string | null;
  status: ChangeStatus;
  requested_by_id: string;
  requested_by_name: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  /** When a still-pending request lapses. Null once it has been reviewed. */
  expires_at: string | null;
  /** Name of the record the request targets, e.g. "TNEB electricity". */
  entity_label: string | null;
}

export interface ChangeRequestCreate {
  entity_type: ChangeEntityType;
  entity_id: string;
  action: ChangeAction;
  /** The requested patch, in the same shape the entity's update takes. */
  payload?: Record<string, unknown>;
  reason?: string;
}

const changeRequestKeys = {
  all: ['change-requests'] as const,
  list: (status?: ChangeStatus) => [...changeRequestKeys.all, status ?? 'all'] as const,
};

/**
 * Reviewers get the whole queue; a member gets only what they filed (the
 * backend decides which, from the caller's role). Skipped entirely for roles
 * without `change_requests.view`.
 */
export const useChangeRequests = (status?: ChangeStatus) => {
  const canView = useCan('change_requests.view');
  return useQuery({
    queryKey: changeRequestKeys.list(status),
    enabled: canView,
    // Pending requests lapse after a short window, and the backend only sweeps
    // them when the queue is read - so keep the open queue fresh rather than
    // leaving a reviewer looking at a request that has already expired.
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{ items: ChangeRequest[]; total: number }>(
        '/change-requests/',
        { params: { limit: 100, ...(status ? { status } : {}) } },
      );
      return data.items;
    },
  });
};

/**
 * Invalidate the queue plus whatever an approval may have changed - the
 * entity's own cache, and the calendar/dashboard that summarise it.
 */
function invalidateFor(entityType?: ChangeEntityType) {
  queryClient.invalidateQueries({ queryKey: changeRequestKeys.all });
  const key = { bill: 'bills', tax: 'taxes', insurance: 'insurance' }[entityType ?? 'bill'];
  queryClient.invalidateQueries({ queryKey: [key] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export const useCreateChangeRequest = () =>
  useMutation({
    mutationFn: (data: ChangeRequestCreate) =>
      api.post<ChangeRequest>('/change-requests/', data).then((r) => r.data),
    onSuccess: (req) => {
      invalidateFor(req.entity_type);
      toast.success(
        req.action === 'delete'
          ? 'Deletion sent for approval'
          : 'Changes sent for approval',
      );
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not send for approval'),
  });

export const useApproveChangeRequest = () =>
  useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<ChangeRequest>(`/change-requests/${id}/approve`, { note }).then((r) => r.data),
    onSuccess: (req) => {
      invalidateFor(req.entity_type);
      toast.success('Approved and applied');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not approve'),
  });

export const useRejectChangeRequest = () =>
  useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post<ChangeRequest>(`/change-requests/${id}/reject`, { note }).then((r) => r.data),
    onSuccess: (req) => {
      invalidateFor(req.entity_type);
      toast.success('Request rejected');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not reject'),
  });

export const useCancelChangeRequest = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.post<ChangeRequest>(`/change-requests/${id}/cancel`).then((r) => r.data),
    onSuccess: (req) => {
      invalidateFor(req.entity_type);
      toast.success('Request withdrawn');
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not withdraw'),
  });
