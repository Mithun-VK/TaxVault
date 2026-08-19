import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Shield, ShieldCheck, CheckCircle2, Wallet, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterBar } from '@/components/shared/FilterBar';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { CategoryCard } from '@/components/shared/CategoryCard';
import { PolicyCard } from '@/components/insurance/PolicyCard';
import { useInsurancePolicies } from '@/api/insurance';
import { useDebounce } from '@/hooks/useDebounce';
import { useCan } from '@/hooks/usePermissions';
import { allInsuranceCategories } from '@/utils/constants';
import { loadCustomCategories } from '@/utils/customCategories';
import { formatINRCompact } from '@/utils/formatters';
import { canonicalEnum } from '@/utils/enums';
import type { InsuranceType, PolicyStatus } from '@/types';

import { ExportButton } from '@/components/shared/ExportButton';
import { generateInsuranceReport } from '@/utils/reports';

export function Insurance() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PolicyStatus | 'all'>('all');
  const debounced = useDebounce(search);
  const canCreate = useCan('insurance.create');

  // Fetch all policies once; categories, stats and the drill-down list are
  // derived client-side (mirrors Taxes/Bills).
  const { data: policies = [], isLoading } = useInsurancePolicies();

  // Built-in categories plus any the user has added - from localStorage (created
  // in the form) or already used on a policy - so a new category shows here, not
  // only inside the form's picker.
  const categoryDefs = useMemo(
    () =>
      allInsuranceCategories(
        policies.map((p) => p.insurance_type),
        loadCustomCategories('insurance'),
      ),
    [policies],
  );
  const typeSet = useMemo(() => new Set(categoryDefs.map((c) => c.value)), [categoryDefs]);

  // Selected category lives in the URL so the view is shareable / refresh-safe.
  const rawType = searchParams.get('type');
  const selectedType =
    rawType && typeSet.has(rawType as InsuranceType) ? (rawType as InsuranceType) : null;
  const selectCategory = (t: InsuranceType) => setSearchParams({ type: t });
  const clearCategory = () => setSearchParams({});

  // Create opens a dedicated page, seeding the current category as the type.
  const openCreate = () =>
    navigate(selectedType ? `/insurance/new?type=${selectedType}` : '/insurance/new');

  const stats = useMemo(
    () => ({
      total: policies.length,
      active: policies.filter((p) => p.status === 'active').length,
      sumInsured: policies.reduce((sum, p) => sum + (Number(p.sum_insured) || 0), 0),
      premiums: policies.reduce((sum, p) => sum + Number(p.premium_amount), 0),
    }),
    [policies],
  );

  const categories = useMemo(
    () =>
      categoryDefs.map((t) => {
        const items = policies.filter((p) => p.insurance_type === t.value);
        return {
          ...t,
          count: items.length,
          sumInsured: items.reduce((sum, p) => sum + (Number(p.sum_insured) || 0), 0),
        };
      }),
    [policies, categoryDefs],
  );

  const categoryPolicies = useMemo(() => {
    if (!selectedType) return [];
    const q = debounced.trim().toLowerCase();
    return policies.filter((p) => {
      if (p.insurance_type !== selectedType) return false;
      if (status !== 'all' && canonicalEnum(p.status) !== canonicalEnum(status)) return false;
      if (q && !`${p.provider} ${p.policy_number}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [policies, selectedType, status, debounced]);

  const selectedMeta = categoryDefs.find((t) => t.value === selectedType);

  // ---- Category selection (landing) view ----
  if (!selectedType) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryStatCard label="Policies" value={String(stats.total)} icon={Shield} accent="navy" loading={isLoading} />
          <SummaryStatCard label="Active" value={String(stats.active)} icon={ShieldCheck} accent="teal" loading={isLoading} />
          <SummaryStatCard
            label="Sum insured"
            value={stats.sumInsured ? formatINRCompact(stats.sumInsured) : '-'}
            icon={CheckCircle2}
            accent="slate"
            loading={isLoading}
          />
          <SummaryStatCard
            label="Premiums"
            value={stats.premiums ? formatINRCompact(stats.premiums) : '-'}
            icon={Wallet}
            accent="warning"
            sublabel="Per cycle, all policies"
            loading={isLoading}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Insurance categories</h2>
              <p className="text-sm text-slate-700">Choose a category to view its policies.</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                onExport={() => generateInsuranceReport(policies, { download: true })}
                disabled={policies.length === 0}
              />
              {canCreate && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add policy
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
              {categories.map((c) => (
                <CategoryCard
                  key={c.value}
                  label={c.label}
                  icon={c.icon}
                  color={c.color}
                  count={c.count}
                  unit="policy"
                  secondary={c.sumInsured > 0 ? `${formatINRCompact(c.sumInsured)} insured` : undefined}
                  onClick={() => selectCategory(c.value)}
                />
              ))}
            </div>
          )}
        </section>


      </div>
    );
  }

  // ---- Single category's policy list view ----
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          clearCategory();
          setSearch('');
          setStatus('all');
        }}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-slate-700 hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All categories
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{selectedMeta?.label}</h2>
          <p className="text-sm text-slate-700">
            {categoryPolicies.length} polic{categoryPolicies.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add policy
          </Button>
        )}
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search provider or policy number…"
          className="flex-1 sm:min-w-[240px]"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as PolicyStatus | 'all')}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="lapsed">Lapsed</SelectItem>
            <SelectItem value="matured">Matured</SelectItem>
            <SelectItem value="surrendered">Surrendered</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : categoryPolicies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={`No ${selectedMeta?.label.toLowerCase()} policies`}
          description="Add a policy in this category to track premiums and renewals."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add a policy
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {categoryPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} onClick={(p) => navigate(`/insurance/${p.id}`)} />
          ))}
        </div>
      )}


    </div>
  );
}
