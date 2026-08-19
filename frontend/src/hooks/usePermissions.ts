import { useAuthStore } from '@/store/authStore';
import { roleHasPermission, type Permission } from '@/utils/permissions';
import type { UserRole } from '@/types';

/** The signed-in user's role, or null before the profile has loaded. */
export function useRole(): UserRole | null {
  return useAuthStore((s) => s.user?.role ?? null);
}

/**
 * True when the signed-in user's role grants `permission`.
 *
 * Drives every UI gate - hidden buttons, filtered nav, route guards. The
 * backend enforces the same table independently, so a stale or tampered role
 * here changes what is *shown*, never what is *allowed*.
 */
export function useCan(permission: Permission): boolean {
  return useAuthStore((s) => roleHasPermission(s.user?.role, permission));
}

/** True when the user's role grants the super-admin-only powers (edit/delete). */
export function useIsSuperAdmin(): boolean {
  return useRole() === 'super_admin';
}

/**
 * How this role gets an edit or delete done on a payable.
 *
 * `direct` - the role changes the record itself.
 * `request` - it files a change request for an admin to approve.
 * `none` - the control should not be offered at all.
 */
export type ChangeMode = 'direct' | 'request' | 'none';

export function useChangeMode(
  directPermission: Permission,
  requestPermission: Permission,
): ChangeMode {
  const canDirect = useCan(directPermission);
  const canRequest = useCan(requestPermission);
  if (canDirect) return 'direct';
  if (canRequest) return 'request';
  return 'none';
}
