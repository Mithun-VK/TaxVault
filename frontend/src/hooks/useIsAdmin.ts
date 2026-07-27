import { useAuthStore } from '@/store/authStore';

/** True when the signed-in user has the admin role. Drives every UI gate;
 *  the backend independently enforces the same rule on write endpoints. */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin');
}
