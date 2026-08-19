import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { roleHasPermission, type Permission } from '@/utils/permissions';

interface RequirePermissionProps {
  /** A single permission, or several of which any one grants access. */
  permission: Permission | Permission[];
}

/**
 * Wraps routes that a role must hold a permission to open. Sits inside
 * ProtectedRoute, so the visitor is already authenticated - this only checks
 * the role, and sends anyone without it back to the home hub (reachable by
 * every role). The backend refuses the same calls regardless, so this is a
 * wayfinding gate, not the security boundary.
 *
 * Passing several permissions means "any of these" - the edit form pages use it
 * so a member holding only `*.request_change` can open the same form and submit
 * it for approval.
 *
 * The profile loads asynchronously after sign-in; until it arrives we render
 * nothing rather than bouncing a user who does in fact have access.
 */
export function RequirePermission({ permission }: RequirePermissionProps) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const allowed = (Array.isArray(permission) ? permission : [permission]).some((p) =>
    roleHasPermission(user.role, p),
  );
  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
