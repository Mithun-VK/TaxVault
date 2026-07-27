import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/** Wraps admin-only routes. Sits inside ProtectedRoute, so the user is already
 *  authenticated here — this only checks the role. Non-admins are bounced to
 *  the dashboard. (The backend enforces the same rule server-side regardless.) */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
