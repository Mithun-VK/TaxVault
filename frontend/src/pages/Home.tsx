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
  type LucideIcon,
} from 'lucide-react';
import { HomeTile } from '@/components/shared/HomeTile';
import { FeatureTile } from '@/components/shared/FeatureTile';
import { useAssets } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { useBills } from '@/api/bills';
import { useInsurancePolicies } from '@/api/insurance';
import { useTaxes } from '@/api/taxes';
import { usePayments } from '@/api/payments';
import { useDocuments } from '@/api/documents';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthStore } from '@/store/authStore';

interface SectionTile {
  label: string;
  icon: LucideIcon;
  color: string;
  to: string;
  count?: number;
  unit?: string;
  loading?: boolean;
  addTo?: string;
  adminOnly?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.full_name ?? '').trim().split(/\s+/)[0];

  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: individuals, isLoading: individualsLoading } = useIndividuals();
  const { data: bills = [], isLoading: billsLoading } = useBills();
  const { data: policies = [], isLoading: policiesLoading } = useInsurancePolicies();
  const { data: taxes = [], isLoading: taxesLoading } = useTaxes();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();

  // Primary sections — the three the workflow revolves around, shown large.
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
      description: 'Land, buildings, gold & vehicles — with taxes and documents.',
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
      description: 'Family members, their assets, policies & personal taxes.',
    },
    {
      label: 'Company',
      icon: Briefcase,
      color: '#0F6E56',
      to: '/company',
      description: 'Filings, compliance, registrations & renewals.',
    },
  ];

  // Data sections — a live count and (for admins) a quick-add.
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
    },
    {
      label: 'Payments',
      icon: Wallet,
      color: '#9D174D',
      to: '/payments',
      count: payments.length,
      unit: 'payment',
      loading: paymentsLoading,
    },
    {
      label: 'Documents',
      icon: FileText,
      color: '#475569',
      to: '/documents',
      count: documents.length,
      unit: 'document',
      loading: documentsLoading,
      addTo: '/documents/new',
    },
  ];

  // Tools — no counts, just wayfinding.
  const tools: SectionTile[] = [
    { label: 'Payment Calendar', icon: CalendarRange, color: '#1A3C6E', to: '/dashboard' },
    { label: 'Reports', icon: FileSpreadsheet, color: '#0F6E56', to: '/reports' },
    { label: 'Dashboard', icon: BarChart3, color: '#7C3AED', to: '/analytics', adminOnly: true },
    { label: 'Alerts', icon: Bell, color: '#D97706', to: '/alerts' },
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
      onAdd={isAdmin && t.addTo ? () => navigate(t.addTo!) : undefined}
    />
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-700">
          Your family vault at a glance — jump to any section.
        </p>
      </div>

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {featured.map((t) => (
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
              onAdd={isAdmin && t.addTo ? () => navigate(t.addTo!) : undefined}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Your vault</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {vault.map(renderTile)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {tools.filter((t) => !t.adminOnly || isAdmin).map(renderTile)}
        </div>
      </section>
    </div>
  );
}
