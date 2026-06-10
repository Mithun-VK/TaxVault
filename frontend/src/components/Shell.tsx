import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuthStore } from '@/store/authStore';
import { useObligations } from '@/api/obligations';
import { daysUntil } from '@/utils/dates';
import { Bell } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const Shell: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const { data: obligations = [] } = useObligations();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Private Tax Dashboard';
      case '/obligations':
        return 'Tax Obligations';
      case '/payments':
        return 'Payment Ledger';
      case '/documents':
        return 'Document Vault';
      case '/alerts':
        return 'Alert Settings';
      case '/profile':
        return 'Client Profile';
      default:
        return 'TaxVault';
    }
  };

  const notificationCount = obligations.filter(
    (o) => !o.is_archived && (o.status === 'overdue' || (o.status === 'pending' && daysUntil(o.due_date) === 0))
  ).length;

  const getInitials = (name: string) => {
    if (!name) return 'TV';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen flex bg-surface-page font-sans">
      {/* Sidebar Navigation */}
      <Navbar />

      {/* Main Content area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 pb-16 md:pb-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#E2E6ED] bg-white flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
          <h1 className="text-base font-semibold text-brand-navy tracking-tight">
            {getPageTitle(location.pathname)}
          </h1>

          <div className="flex items-center gap-4">
            {/* Notification Bell with Badge Count */}
            <Link
              to="/alerts"
              className="relative p-1.5 rounded-full hover:bg-slate-50 text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
              aria-label="Alert settings and history"
            >
              <Bell size={18} />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-danger text-[9px] font-bold text-white ring-2 ring-white font-mono tabular-nums">
                  {notificationCount}
                </span>
              )}
            </Link>

            {/* Subtle Divider */}
            <div className="h-5 w-px bg-[#E2E6ED]" />

            {/* User Avatar Initials */}
            {user && (
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8 border border-[#E2E6ED] select-none pointer-events-none">
                  <AvatarFallback className="bg-brand-navy text-white text-xs font-semibold">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-text-primary hidden sm:inline-block">
                  {user.fullName}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Content view container */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto p-4 md:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default Shell;
