import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home as HomeIcon,
  LayoutDashboard,
  Building2,
  Briefcase,
  Shield,
  Receipt,
  CreditCard,
  Wallet,
  FolderOpen,
  FileSpreadsheet,
  BarChart3,
  Bell,
  ClipboardCheck,
  User as UserIcon,
  UserCircle,
  Plus,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAssets } from '@/api/assets';
import { useInsurancePolicies } from '@/api/insurance';
import { useIndividuals } from '@/api/individuals';
import { ASSET_TYPES, BILL_TYPES, TAX_TYPES, INSURANCE_TYPES } from '@/utils/constants';
import { getAssetOwner } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { roleHasPermission, type Permission } from '@/utils/permissions';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  to: string;
  /** Permission needed to see this entry; omitted means everyone. */
  permission?: Permission;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mirrors the sidebar IA: Properties · Individual · Company · Analytics
// (Dashboard/Bills/Insurance/Tax/Payments/Documents live under Analytics) · Alerts · Profile.
const NAV: CommandItem[] = [
  { id: 'nav-home', group: 'Go to', label: 'Home', icon: HomeIcon, to: '/' },
  { id: 'nav-assets', group: 'Go to', label: 'Properties', icon: Building2, to: '/assets', permission: 'properties.view' },
  { id: 'nav-individual', group: 'Go to', label: 'Individuals', icon: Users, to: '/individual', permission: 'individuals.view' },
  { id: 'nav-company', group: 'Go to', label: 'Companies', icon: Briefcase, to: '/company', permission: 'company.view' },
  { id: 'nav-analytics', group: 'Go to', label: 'Dashboard', icon: BarChart3, to: '/analytics', permission: 'analytics.view' },
  { id: 'nav-reports', group: 'Go to', label: 'Reports', icon: FileSpreadsheet, to: '/reports', permission: 'reports.view' },
  { id: 'nav-dashboard', group: 'Analytics', label: 'Payment Calendar', icon: LayoutDashboard, to: '/dashboard', permission: 'calendar.view' },
  { id: 'nav-bills', group: 'Analytics', label: 'Bills', icon: CreditCard, to: '/bills', permission: 'bills.view' },
  { id: 'nav-insurance', group: 'Analytics', label: 'Insurance', icon: Shield, to: '/insurance', permission: 'insurance.view' },
  { id: 'nav-taxes', group: 'Analytics', label: 'Tax', icon: Receipt, to: '/taxes', permission: 'taxes.view' },
  { id: 'nav-payments', group: 'Analytics', label: 'Payments', icon: Wallet, to: '/payments', permission: 'payments.view' },
  { id: 'nav-documents', group: 'Analytics', label: 'Documents', icon: FolderOpen, to: '/documents', permission: 'documents.browse' },
  { id: 'nav-approvals', group: 'Go to', label: 'Approvals', icon: ClipboardCheck, to: '/approvals', permission: 'change_requests.review' },
  { id: 'nav-alerts', group: 'Go to', label: 'Alerts', icon: Bell, to: '/alerts', permission: 'alerts.view' },
  { id: 'nav-users', group: 'Go to', label: 'Users', icon: Users, to: '/users', permission: 'users.manage' },
  { id: 'nav-profile', group: 'Go to', label: 'Profile', icon: UserIcon, to: '/profile' },
];

// Deep links into the Properties page's category/type filters (built from ASSET_TYPES).
const PROPERTY_TYPES: CommandItem[] = ASSET_TYPES.filter((t) => t.value !== 'other').map((t) => ({
  id: `ptype-${t.value}`,
  group: 'Property types',
  label: t.label,
  icon: t.icon ?? Building2,
  to: `/assets?category=${t.group ?? 'movable'}&type=${t.value}`,
  permission: 'properties.view',
}));

const ACTIONS: CommandItem[] = [
  { id: 'new-asset', group: 'Create', label: 'Add property', icon: Plus, to: '/assets/new', permission: 'properties.create' },
  { id: 'new-individual', group: 'Create', label: 'Add individual', icon: Plus, to: '/individual/new', permission: 'individuals.create' },
  { id: 'new-company', group: 'Create', label: 'Add company', icon: Plus, to: '/company/new', permission: 'company.create' },
  { id: 'new-tax', group: 'Create', label: 'Add tax', icon: Plus, to: '/taxes/new', permission: 'taxes.create' },
  { id: 'new-bill', group: 'Create', label: 'Add bill', icon: Plus, to: '/bills/new', permission: 'bills.create' },
  { id: 'new-policy', group: 'Create', label: 'Add insurance policy', icon: Plus, to: '/insurance/new', permission: 'insurance.create' },
  { id: 'new-document', group: 'Create', label: 'Upload document', icon: Plus, to: '/documents/new', permission: 'documents.create' },
];

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const role = useAuthStore((s) => s.user?.role ?? null);
  // The asset and individual hooks opt out entirely for roles that cannot call
  // them, so those result groups simply never appear.
  const { data: assets = [] } = useAssets();
  const { data: policies = [] } = useInsurancePolicies();
  const { data: individualsData } = useIndividuals();

  const items = useMemo<CommandItem[]>(() => {
    const individuals: CommandItem[] = (individualsData?.items ?? []).map((ind) => ({
      id: `individual-${ind.id}`,
      group: 'Individuals',
      label: ind.full_name,
      sub: ind.relationship_to_owner ?? undefined,
      icon: UserCircle,
      to: `/individual/${ind.id}`,
    }));
    const taxCats: CommandItem[] = TAX_TYPES.map((t) => ({
      id: `taxcat-${t.value}`,
      group: 'Tax categories',
      label: t.label,
      icon: t.icon ?? Receipt,
      to: `/taxes?type=${t.value}`,
      permission: 'taxes.view' as Permission,
    }));
    const billCats: CommandItem[] = BILL_TYPES.map((t) => ({
      id: `billcat-${t.value}`,
      group: 'Bill categories',
      label: t.label,
      icon: t.icon ?? CreditCard,
      to: `/bills?type=${t.value}`,
      permission: 'bills.view' as Permission,
    }));
    const insuranceCats: CommandItem[] = INSURANCE_TYPES.map((t) => ({
      id: `inscat-${t.value}`,
      group: 'Insurance categories',
      label: t.label,
      icon: t.icon ?? Shield,
      to: `/insurance?type=${t.value}`,
      permission: 'insurance.view' as Permission,
    }));
    const assetItems: CommandItem[] = assets.map((a) => {
      const owner = getAssetOwner(a);
      const typeLabel = ASSET_TYPES.find((t) => t.value === a.asset_type)?.label ?? 'Asset';
      return {
        id: `asset-${a.id}`,
        group: 'Assets',
        label: a.name,
        sub: owner ? `${typeLabel} · ${owner}` : typeLabel,
        icon: Building2,
        to: `/assets/${a.id}`,
      };
    });
    const policyItems: CommandItem[] = policies.map((p) => ({
      id: `policy-${p.id}`,
      group: 'Insurance',
      label: p.provider,
      sub: p.policy_number,
      icon: Shield,
      to: `/insurance/${p.id}`,
    }));
    return [
      ...NAV,
      ...PROPERTY_TYPES,
      ...ACTIONS,
      ...individuals,
      ...taxCats,
      ...billCats,
      ...insuranceCats,
      ...assetItems,
      ...policyItems,
    ].filter((item) => !item.permission || roleHasPermission(role, item.permission));
  }, [assets, policies, individualsData, role]);

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.sub ?? ''} ${it.group}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [items, query]);

  // Group while preserving a flat index for keyboard navigation.
  const groups = useMemo(() => {
    const map = new Map<string, { item: CommandItem; index: number }[]>();
    filtered.forEach((item, index) => {
      const arr = map.get(item.group) ?? [];
      arr.push({ item, index });
      map.set(item.group, arr);
    });
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(filtered[active]);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      {/* Search header - suppress the global focus ring; the dialog is the focus context. */}
      <div className="flex items-center gap-3 border-b border-surface-border px-5">
        <Search className="h-[18px] w-[18px] shrink-0 text-slate-600" aria-hidden="true" />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, people, properties, or type an action…"
          aria-label="Command palette search"
          className="h-14 w-full bg-transparent text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-600 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <div
        ref={listRef}
        className="max-h-[60vh] overflow-y-auto px-2 py-2 [scrollbar-gutter:stable]"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-600">No results for “{query}”.</p>
        ) : (
          groups.map(([group, entries]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                {group}
              </p>
              <div className="space-y-0.5">
                {entries.map(({ item, index }) => {
                  const Icon = item.icon;
                  const isActive = index === active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={isActive}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(item)}
                      className={cn(
                        'flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-brand-navy-muted text-brand-navy'
                          : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          isActive ? 'text-brand-navy' : 'text-slate-600',
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.sub && (
                        <span className="shrink-0 truncate pl-3 text-xs text-slate-600">
                          {item.sub}
                        </span>
                      )}
                      {isActive && (
                        <CornerDownLeft
                          className="h-3.5 w-3.5 shrink-0 text-brand-navy/50"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-surface-border bg-slate-50/60 px-5 py-2.5 text-[12px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUp className="h-3 w-3" />
          <ArrowDown className="h-3 w-3" /> navigate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CornerDownLeft className="h-3 w-3" /> open
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <kbd className="rounded border border-surface-border bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
            Esc
          </kbd>
          close
        </span>
      </div>
    </div>
  );
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-xl p-0 shadow-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        {open && <PaletteBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
