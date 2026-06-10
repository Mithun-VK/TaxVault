import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/api/auth';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  FolderOpen,
  Bell,
  User,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavbarProps {
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { mutate: performLogout } = useLogout();

  const getInitials = (name: string) => {
    if (!name) return 'TV';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Obligations', path: '/obligations', icon: FileText },
    { label: 'Payments', path: '/payments', icon: CreditCard },
    { label: 'Documents', path: '/documents', icon: FolderOpen },
    { label: 'Alerts', path: '/alerts', icon: Bell },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  const handleLogoutClick = () => {
    performLogout(undefined, {
      onSuccess: () => {
        navigate('/login');
      },
    });
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR (visible on md and up) ── */}
      <aside className={`hidden md:flex flex-col w-64 bg-white border-r border-[#E2E6ED] h-screen fixed left-0 top-0 z-20 shrink-0 ${className}`}>
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-navy text-white shadow-md">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-brand-navy tracking-tight leading-none">TaxVault</span>
            <span className="text-[10px] text-text-muted mt-0.5 tracking-wider uppercase font-semibold">Private Banking</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-4 space-y-1 mt-2">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all group border-l-3 ${
                  isActive
                    ? 'bg-[#1A3C6E]/10 text-brand-navy border-l-brand-navy font-semibold'
                    : 'text-text-muted hover:bg-slate-50 hover:text-text-primary border-l-transparent'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User profile section at bottom */}
        {user && (
          <div className="p-4 border-t border-[#E2E6ED] bg-slate-50/50 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <Avatar className="w-9 h-9 border border-[#E2E6ED]">
                <AvatarFallback className="bg-brand-navy text-white text-xs font-semibold">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {user.fullName}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogoutClick}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium text-[#991B1B] hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* ── MOBILE BOTTOM NAVIGATION (visible on <768px) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E6ED] h-16 flex items-center justify-around px-2 z-30 shadow-[0_-1px_6px_rgba(0,0,0,0.04)]">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all ${
                isActive ? 'text-brand-navy font-semibold scale-105' : 'text-text-muted'
              }`
            }
          >
            <item.icon size={20} className="mb-0.5 shrink-0" />
            <span className="text-[10px] leading-tight tracking-tight">{item.label}</span>
          </NavLink>
        ))}
        {/* Toggle profile drawer/page as the last item on mobile instead of alert tab to keep it to 5 items max */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all ${
              isActive ? 'text-brand-navy font-semibold scale-105' : 'text-text-muted'
            }`
          }
        >
          <User size={20} className="mb-0.5 shrink-0" />
          <span className="text-[10px] leading-tight tracking-tight">Profile</span>
        </NavLink>
      </nav>
    </>
  );
};
export default Navbar;
