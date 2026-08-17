import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import type { User, UserRole } from '@/types';
import { ROLE_LABELS } from '@/utils/permissions';

/** Super-admin only: list all users so roles can be managed. */
export const useUsers = () =>
  useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ items: User[]; total: number }>('/users/', {
        params: { limit: 100 },
      });
      return data.items;
    },
  });

/**
 * Super-admin only: change a user's role. The backend refuses to demote the
 * last super admin, so the deployment always keeps a full-access account.
 */
export const useSetUserRole = () =>
  useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api.patch<User>(`/users/${id}/role`, { role }).then((r) => r.data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${user.full_name || user.email} is now ${ROLE_LABELS[user.role]}`);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update role'),
  });
