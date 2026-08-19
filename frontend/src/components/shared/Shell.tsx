import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home as HomeIcon,
  Building2,
  Briefcase,
  BarChart3,
  Bell,
  CalendarRange,
  ClipboardCheck,
  FileSpreadsheet,
  Receipt,
  User as UserIcon,
  Wallet,
  UserCircle,
  Users as UsersIcon,
  ChevronDown,
  Plus,
  LogOut,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { Navbar } from './Navbar';
import { CommandPalette } from './CommandPalette';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/authStore';
import { useIndividuals } from '@/api/individuals';
import { useCompanies } from '@/api/companies';
import { getInitials } from '@/utils/formatters';
import { roleHasPermission, type Permission } from '@/utils/permissions';

interface Leaf {
  to: string;
  label: string;
  /** Path opened by the leaf's "+" quick-add button (creates that exact type). */
  addTo?: string;
  /** Permission required to see this leaf at all. */
  permission?: Permission;
  /** Permission required for the "+" quick-add. Defaults to `permission`. */
  addPermission?: Permission;
}

interface SubGroup {
  label: string;
  children: Leaf[];
  /** Path opened by the header "+" quick-add button. */
  addTo?: string;
  addPermission?: Permission;
}

type GroupKey = 'properties' | 'individual' | 'company' | 'analytics';

type NavItem =
  | { type: 'link'; to: string; label: string; icon: LucideIcon; permission?: Permission }
  | {
      type: 'group';
      key: GroupKey;
      label: string;
      icon: LucideIcon;
      basePath: string;
      children?: Leaf[];
      subgroups?: SubGroup[];
      /** Path opened by the header "+" quick-add button. */
      addTo?: string;
      /** Permission required to see the group. Omit for per-leaf gating. */
      permission?: Permission;
      addPermission?: Permission;
    };

const NAV_ITEMS: NavItem[] = [
  { type: 'link', to: '/', label: 'Home', icon: HomeIcon },
  {
    type: 'group',
    key: 'properties',
    label: 'Properties',
    icon: Building2,
    basePath: '/assets',
    // Header "+" is the general "add property" (asks which type).
    addTo: '/assets/new',
    permission: 'properties.view',
    addPermission: 'properties.create',
    subgroups: [
            {
        label: 'Immovable',
        children: [
          {
            to: '/assets?category=immovable&type=residential_building',
            label: 'Residential Buildings',
            addTo: '/assets/new?type=residential_building',
          },
          {
            to: '/assets?category=immovable&type=commercial_building',
            label: 'Commercial Buildings',
            addTo: '/assets/new?type=commercial_building',
          },
          {
            to: '/assets?category=immovable&type=agricultural_land',
            label: 'Agricultural Land',
            addTo: '/assets/new?type=agricultural_land',
          },
          {
            to: '/assets?category=immovable&type=non_agricultural_land',
            label: 'Non-Agricultural Land',
            addTo: '/assets/new?type=non_agricultural_land',
          },
        ],
      },
      {
        label: 'Movable',
        children: [
          { to: '/assets?category=movable&type=gold', label: 'Gold', addTo: '/assets/new?type=gold' },
          {
            to: '/assets?category=movable&type=vehicle',
            label: 'Vehicles',
            addTo: '/assets/new?type=vehicle',
          },
        ],
      },
    ],
  },
  {
    type: 'group',
    key: 'individual',
    label: 'Individual',
    icon: UserCircle,
    basePath: '/individual',
    addTo: '/individual/new',
    children: [], // populated from the individuals API
    permission: 'individuals.view',
    addPermission: 'individuals.create',
  },
  {
    type: 'group',
    key: 'company',
    label: 'Company',
    icon: Briefcase,
    basePath: '/company',
    addTo: '/company/new',
    children: [], // populated from the companies API
    permission: 'company.view',
    addPermission: 'company.create',
  },
  {
    type: 'group',
    key: 'analytics',
    label: 'Financials',
    icon: BarChart3,
    basePath: '/analytics',
    // No group-level permission: each leaf carries its own, so a member sees
    // this group holding only the four surfaces they're entitled to.
    children: [
      { to: '/dashboard', label: 'Payment Calendar', permission: 'calendar.view' },
      { to: '/bills', label: 'Bills', permission: 'bills.view' },
      { to: '/insurance', label: 'Insurance', permission: 'insurance.view' },
      { to: '/taxes', label: 'Tax', permission: 'taxes.view' },
      { to: '/payments', label: 'Payments', permission: 'payments.view' },
      { to: '/documents', label: 'Documents', permission: 'documents.browse' },
    ],
  },
  {
    type: 'link',
    to: '/reports',
    label: 'Reports',
    icon: FileSpreadsheet,
    permission: 'reports.view',
  },
  {
    type: 'link',
    to: '/approvals',
    label: 'Approvals',
    icon: ClipboardCheck,
    permission: 'change_requests.review',
  },
  { type: 'link', to: '/alerts', label: 'Alerts', icon: Bell, permission: 'alerts.view' },
  { type: 'link', to: '/users', label: 'Users', icon: UsersIcon, permission: 'users.manage' },
  { type: 'link', to: '/profile', label: 'Profile', icon: UserIcon },
];

interface MobileItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

// The bottom tab bar shows the first few destinations the role can reach, so a
// member gets a useful bar (Home · Bills · Payments · Calendar) instead of the
// near-empty one that filtering a fixed admin list would leave behind.
const MOBILE_ITEMS: MobileItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/assets', label: 'Properties', icon: Building2, permission: 'properties.view' },
  { to: '/individual', label: 'People', icon: UsersIcon, permission: 'individuals.view' },
  { to: '/company', label: 'Company', icon: Briefcase, permission: 'company.view' },
  { to: '/analytics', label: 'Dashboard', icon: BarChart3, permission: 'analytics.view' },
  { to: '/bills', label: 'Bills', icon: Receipt, permission: 'bills.view' },
  { to: '/payments', label: 'Payments', icon: Wallet, permission: 'payments.view' },
  { to: '/dashboard', label: 'Calendar', icon: CalendarRange, permission: 'calendar.view' },
];
const MOBILE_TAB_COUNT = 5;

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Payment Calendar',
  '/assets': 'Properties',
  '/insurance': 'Insurance',
  '/taxes': 'Taxes',
  '/bills': 'Bills',
  '/payments': 'Payments',
  '/analytics': 'Dashboard',
  '/reports': 'Reports',
  '/documents': 'Documents',
  '/alerts': 'Alert Settings',
  '/profile': 'Profile',
  '/individual': 'Individuals',
  '/company': 'Companies',
  '/approvals': 'Approvals',
  '/users': 'Team & access',
};

function deriveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/assets/')) return 'Property Details';
  if (pathname.startsWith('/insurance/')) return 'Policy Details';
  if (pathname.startsWith('/bills/')) return 'Bill Details';
  if (pathname.startsWith('/individual/')) return 'Individual Profile';
  if (pathname === '/company/new') return 'Add Company';
  if (pathname.startsWith('/company/')) return 'Company Details';
  return 'TaxVault';
}

function leafActive(to: string, pathname: string, search: string): boolean {
  const [path, query] = to.split('?');
  if (query) return pathname === path && pathname + search === to;
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Returns a predicate for "may the signed-in role see this nav entry".
 * An entry with no permission is visible to everyone.
 */
function usePermissionCheck() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  return (permission?: Permission) => !permission || roleHasPermission(role, permission);
}

/** Quick-add "+" that sits at the right end of an expandable nav tab. */
function NavAddButton({
  to,
  label,
  onNavigate,
}: {
  to: string;
  label: string;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate();
        navigate(to);
      }}
      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-brand-navy-muted hover:text-brand-navy"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function NavLeaf({
  leaf,
  pathname,
  search,
  onNavigate,
  addPermission,
}: {
  leaf: Leaf;
  pathname: string;
  search: string;
  onNavigate: () => void;
  /** Parent's add permission, used when the leaf declares none of its own. */
  addPermission?: Permission;
}) {
  const can = usePermissionCheck();
  const active = leafActive(leaf.to, pathname, search);
  const canAdd = can(leaf.addPermission ?? addPermission);
  return (
    <div className="flex items-center">
      <NavLink
        to={leaf.to}
        onClick={onNavigate}
        className={cn(
          'flex min-h-[40px] flex-1 items-center rounded-lg px-3 py-2 text-sm transition-colors duration-150',
          active
            ? 'bg-brand-navy-muted font-medium text-brand-navy'
            : 'text-slate-700 hover:bg-slate-50 hover:text-text-primary',
        )}
      >
        {leaf.label}
      </NavLink>
      {leaf.addTo && canAdd && (
        <NavAddButton to={leaf.addTo} label={`Add ${leaf.label}`} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function NavSubGroup({
  group,
  pathname,
  search,
  onNavigate,
  addPermission,
}: {
  group: SubGroup;
  pathname: string;
  search: string;
  onNavigate: () => void;
  addPermission?: Permission;
}) {
  const can = usePermissionCheck();
  const effectiveAddPermission = group.addPermission ?? addPermission;
  const active = group.children.some((c) => leafActive(c.to, pathname, search));
  const [open, setOpen] = useState(active);
  return (
    <div>
      <div
        className={cn(
          'flex items-center rounded-lg',
          active ? 'text-brand-navy' : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-[38px] flex-1 items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          {group.label}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        {group.addTo && can(effectiveAddPermission) && (
          <NavAddButton to={group.addTo} label={`Add ${group.label} asset`} onNavigate={onNavigate} />
        )}
      </div>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-surface-border pl-2">
          {group.children.map((leaf) => (
            <NavLeaf
              key={leaf.to}
              leaf={leaf}
              pathname={pathname}
              search={search}
              onNavigate={onNavigate}
              addPermission={effectiveAddPermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavGroup({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { type: 'group' }>;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const { pathname, search } = location;
  const can = usePermissionCheck();
  // Both hooks opt out for roles without the matching *.view permission.
  const { data: individuals } = useIndividuals();
  const { data: companies } = useCompanies();

  let leaves: Leaf[] | undefined;
  if (item.key === 'individual') {
    leaves = (individuals?.items ?? []).map((ind) => ({
      to: `/individual/${ind.id}`,
      label: ind.full_name,
    }));
  } else if (item.key === 'company') {
    // Trade name where one exists - it's what the business is called day to day.
    leaves = (companies?.items ?? []).map((c) => ({
      to: `/company/${c.id}`,
      label: c.trade_name || c.legal_name,
    }));
  } else {
    leaves = (item.children ?? []).filter((leaf) => can(leaf.permission));
  }

  const isActive =
    item.key === 'analytics'
      ? (leaves ?? []).some((c) => leafActive(c.to, pathname, search))
      : pathname.startsWith(item.basePath);

  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <div
        className={cn(
          'flex items-center rounded-lg',
          isActive ? 'bg-brand-navy-muted text-brand-navy' : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-[44px] flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium"
        >
          <span className="flex items-center gap-3">
            <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {item.label}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        {item.addTo && can(item.addPermission) && (
          <NavAddButton to={item.addTo} label={`Add ${item.label}`} onNavigate={onNavigate} />
        )}
      </div>

      {open && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {item.subgroups
            ? item.subgroups.map((sg) => (
                <NavSubGroup
                  key={sg.label}
                  group={sg}
                  pathname={pathname}
                  search={search}
                  onNavigate={onNavigate}
                  addPermission={item.addPermission}
                />
              ))
            : (leaves ?? []).map((leaf) => (
                <NavLeaf
                  key={leaf.to}
                  leaf={leaf}
                  pathname={pathname}
                  search={search}
                  onNavigate={onNavigate}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const name = user?.full_name ?? 'TaxVault User';
  const can = usePermissionCheck();
  // A group with per-leaf permissions (Financials) drops out entirely once the
  // role can reach none of its leaves.
  const navItems = NAV_ITEMS.filter((item) => {
    if (!can(item.permission)) return false;
    if (item.type === 'group' && !item.permission && item.children) {
      return item.children.some((leaf) => can(leaf.permission));
    }
    return true;
  });
  const mobileItems = MOBILE_ITEMS.filter((i) => can(i.permission)).slice(0, MOBILE_TAB_COUNT);

  // Global ⌘K / Ctrl+K toggles the command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = (
    <>
      <div className="flex h-16 items-center px-5">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          aria-label="Go to home"
          className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          if (item.type === 'group') {
            return (
              <NavGroup key={item.key} item={item} onNavigate={() => setMobileOpen(false)} />
            );
          }
          const { to, label, icon: Icon } = item;
          const isActive =
            to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-brand-navy-muted text-brand-navy'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-text-primary',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active-bar"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-brand-navy"
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                />
              )}
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-surface-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{name}</p>
            <p className="truncate text-xs text-slate-600">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Desktop sidebar - widens a touch on large displays so labels breathe */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-surface-border bg-white md:flex 2xl:w-[288px]">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-surface-border bg-white md:hidden">
            {SidebarContent}
          </aside>
        </>
      )}

      <div className="flex min-h-screen flex-col md:pl-[260px] 2xl:pl-[288px]">
        <Navbar
          title={deriveTitle(location.pathname)}
          onMenuClick={() => setMobileOpen(true)}
          onOpenSearch={() => setCmdOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-6 lg:px-8 2xl:max-w-[100rem] 2xl:px-10 3xl:max-w-[112rem]">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-surface-border bg-white py-1.5 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main navigation"
      >
        {mobileItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors duration-150',
                isActive ? 'text-brand-navy' : 'text-slate-600',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-tab-active"
                  className="absolute top-0 h-0.5 w-8 rounded-b bg-brand-navy"
                />
              )}
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-[12px] font-medium text-slate-600"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  );
}
