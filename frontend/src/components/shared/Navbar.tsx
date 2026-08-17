import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu,
  User as UserIcon,
  LogOut,
  Settings,
  Search,
  Plus,
  Building2,
  Briefcase,
  Receipt,
  CreditCard,
  Shield,
  FileUp,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/authStore';
import { usePayableDeadlines } from '@/hooks/usePayableDeadlines';
import { roleHasPermission, type Permission } from '@/utils/permissions';
import { daysUntil } from '@/utils/dates';
import { getInitials } from '@/utils/formatters';

interface NavbarProps {
  title: string;
  onMenuClick: () => void;
  onOpenSearch: () => void;
}

interface CreateAction {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
}

const CREATE_ACTIONS: CreateAction[] = [
  { label: 'Property', to: '/assets/new', icon: Building2, permission: 'properties.create' },
  { label: 'Company', to: '/company/new', icon: Briefcase, permission: 'company.create' },
  { label: 'Tax', to: '/taxes/new', icon: Receipt, permission: 'taxes.create' },
  { label: 'Bill', to: '/bills/new', icon: CreditCard, permission: 'bills.create' },
  { label: 'Insurance policy', to: '/insurance/new', icon: Shield, permission: 'insurance.create' },
  { label: 'Document', to: '/documents/new', icon: FileUp, permission: 'documents.create' },
];

export function Navbar({ title, onMenuClick, onOpenSearch }: NavbarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { payables } = usePayableDeadlines();
  const can = (permission: Permission) => roleHasPermission(user?.role, permission);

  // Quick-add offers exactly what this role may create — for a member that is
  // bills alone, so the menu still earns its place.
  const createActions = CREATE_ACTIONS.filter((action) => can(action.permission));

  const alertCount = payables.filter((p) => daysUntil(p.due_date) <= 0).length;
  const name = user?.full_name ?? 'TaxVault User';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-surface-border bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Command palette trigger — pill on desktop, icon on mobile */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-10 items-center gap-2 rounded-lg border border-surface-border bg-slate-50 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 sm:flex"
          aria-label="Open search (Ctrl K)"
        >
          <Search className="h-4 w-4" />
          <span>Search…</span>
          <kbd className="ml-2 rounded border border-surface-border bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 sm:hidden"
          aria-label="Open search"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Global quick-add — only what this role is allowed to create */}
        {createActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-10">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Add new</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {createActions.map(({ label, to, icon: Icon }) => (
                <DropdownMenuItem key={to} onClick={() => navigate(to)}>
                  <Icon /> {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {can('alerts.view') && (
        <Link
          to="/alerts"
          className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-text-primary"
          aria-label={`Alerts${alertCount ? `, ${alertCount} need attention` : ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {alertCount > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-danger px-1 text-[11px] font-semibold text-white"
              aria-hidden="true"
            >
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-11 items-center gap-2 rounded-lg p-1 transition-colors duration-150 hover:bg-slate-100"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium text-slate-900">{name}</div>
              <div className="truncate text-xs font-normal text-slate-600">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserIcon /> Profile
            </DropdownMenuItem>
            {can('alerts.view') && (
              <DropdownMenuItem onClick={() => navigate('/alerts')}>
                <Settings /> Alert settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={handleLogout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
