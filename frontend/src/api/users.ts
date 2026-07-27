import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import type { User, UserRole } from '@/types';

/** Admin-only: list all users so an admin can manage roles. */
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

/** Admin-only: promote/demote a user. The backend refuses to remove the last admin. */
export const useSetUserRole = () =>
  useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api.patch<User>(`/users/${id}/role`, { role }).then((r) => r.data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${user.full_name || user.email} is now ${user.role === 'admin' ? 'an admin' : 'a user'}`);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update role'),
  });
