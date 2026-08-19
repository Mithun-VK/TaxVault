import { useNavigate } from 'react-router-dom';
import {
  Building2,
  UserCircle,
  Receipt,
  Shield,
  Landmark,
  Wallet,
  FileText,
  CalendarRange,
  FileSpreadsheet,
  BarChart3,
  Briefcase,
  Bell,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import { HomeTile } from '@/components/shared/HomeTile';
import { FeatureTile } from '@/components/shared/FeatureTile';
import { useAssets } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { useCompanies } from '@/api/companies';
import { useBills } from '@/api/bills';
import { useInsurancePolicies } from '@/api/insurance';
import { useTaxes } from '@/api/taxes';
import { usePayments } from '@/api/payments';
import { useDocuments } from '@/api/documents';
import { useAuthStore } from '@/store/authStore';
import { roleHasPermission, type Permission } from '@/utils/permissions';

interface SectionTile {
  label: string;
  icon: LucideIcon;
  color: string;
  to: string;
  count?: number;
  unit?: string;
  loading?: boolean;
  addTo?: string;
  /** Permission needed to see the tile. */
  permission: Permission;
  /** Permission needed for the tile's "+" quick-add. */
  addPermission?: Permission;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const can = (permission?: Permission) =>
    !permission || roleHasPermission(user?.role, permission);
  const firstName = (user?.full_name ?? '').trim().split(/\s+/)[0];

  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: individuals, isLoading: individualsLoading } = useIndividuals();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: bills = [], isLoading: billsLoading } = useBills();
  const { data: policies = [], isLoading: policiesLoading } = useInsurancePolicies();
  const { data: taxes = [], isLoading: taxesLoading } = useTaxes();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();

  // Primary sections - the three the workflow revolves around, shown large.
  const featured: (SectionTile & { description: string })[] = [
    {
      label: 'Properties',
      icon: Building2,
      color: '#0369A1',
      to: '/assets',
      count: assets.length,
      unit: 'asset',
      loading: assetsLoading,
      addTo: '/assets/new',
      permission: 'properties.view',
      addPermission: 'properties.create',
      description: 'Land, buildings, gold & vehicles - with taxes and documents.',
    },
    {
      label: 'Individuals',
      icon: UserCircle,
      color: '#7C3AED',
      to: '/individual',
      count: individuals?.items.length ?? 0,
      unit: 'person',
      loading: individualsLoading,
      addTo: '/individual/new',
      permission: 'individuals.view',
      addPermission: 'individuals.create',
      description: 'Family members, their assets, policies & personal taxes.',
    },
    {
      label: 'Company',
      icon: Briefcase,
      color: '#0F6E56',
      to: '/company',
      count: companies?.items.length ?? 0,
      unit: 'company',
      loading: companiesLoading,
      addTo: '/company/new',
      permission: 'company.view',
      addPermission: 'company.create',
      description: 'Filings, compliance, registrations & renewals.',
    },
  ];

  // Data sections - a live count and, where the role allows it, a quick-add.
  const vault: SectionTile[] = [
    {
      label: 'Bills',
      icon: Receipt,
      color: '#D97706',
      to: '/bills',
      count: bills.length,
      unit: 'bill',
      loading: billsLoading,
      addTo: '/bills/new',
      permission: 'bills.view',
      addPermission: 'bills.create',
    },
    {
      label: 'Insurance',
      icon: Shield,
      color: '#0F6E56',
      to: '/insurance',
      count: policies.length,
      unit: 'policy',
      loading: policiesLoading,
      addTo: '/insurance/new',
      permission: 'insurance.view',
      addPermission: 'insurance.create',
    },
    {
      label: 'Taxes',
      icon: Landmark,
      color: '#1A3C6E',
      to: '/taxes',
      count: taxes.length,
      unit: 'tax',
      loading: taxesLoading,
      addTo: '/taxes/new',
      permission: 'taxes.view',
      addPermission: 'taxes.create',
    },
    {
      label: 'Payments',
      icon: Wallet,
      color: '#9D174D',
      to: '/payments',
      count: payments.length,
      unit: 'payment',
      loading: paymentsLoading,
      permission: 'payments.view',
    },
    {
      label: 'Documents',
      icon: FileText,
      color: '#475569',
      to: '/documents',
      count: documents.length,
      unit: 'document',
      loading: documentsLoading,
      permission: 'documents.browse',
      addTo: '/documents/new',
      addPermission: 'documents.create',
    },
  ];

  // Tools - no counts, just wayfinding.
  const tools: SectionTile[] = [
    {
      label: 'Payment Calendar',
      icon: CalendarRange,
      color: '#1A3C6E',
      to: '/dashboard',
      permission: 'calendar.view',
    },
    {
      label: 'Reports',
      icon: FileSpreadsheet,
      color: '#0F6E56',
      to: '/reports',
      permission: 'reports.view',
    },
    {
      label: 'Dashboard',
      icon: BarChart3,
      color: '#7C3AED',
      to: '/analytics',
      permission: 'analytics.view',
    },
    { label: 'Alerts', icon: Bell, color: '#D97706', to: '/alerts', permission: 'alerts.view' },
    {
      label: 'Approvals',
      icon: ClipboardCheck,
      color: '#9D174D',
      to: '/approvals',
      permission: 'change_requests.review',
    },
  ];

  const renderTile = (t: SectionTile) => (
    <HomeTile
      key={t.to}
      label={t.label}
      icon={t.icon}
      color={t.color}
      count={t.count}
      unit={t.unit}
      loading={t.loading}
      onOpen={() => navigate(t.to)}
      onAdd={t.addTo && can(t.addPermission) ? () => navigate(t.addTo!) : undefined}
    />
  );

  const visibleFeatured = featured.filter((t) => can(t.permission));
  const visibleVault = vault.filter((t) => can(t.permission));
  const visibleTools = tools.filter((t) => can(t.permission));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-700">
          Your family vault at a glance - jump to any section.
        </p>
      </div>

      {visibleFeatured.length > 0 && (
      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {visibleFeatured.map((t) => (
            <FeatureTile
              key={t.to}
              label={t.label}
              icon={t.icon}
              color={t.color}
              description={t.description}
              count={t.count}
              unit={t.unit}
              loading={t.loading}
              onOpen={() => navigate(t.to)}
              onAdd={t.addTo && can(t.addPermission) ? () => navigate(t.addTo!) : undefined}
            />
          ))}
        </div>
      </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Your vault</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {visibleVault.map(renderTile)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {visibleTools.map(renderTile)}
        </div>
      </section>
    </div>
  );
}
