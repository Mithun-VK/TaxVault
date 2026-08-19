import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Receipt, AlertTriangle, Wallet, CheckCircle2, ArrowLeft } from 'lucide-react';
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
import { EmptyState } from '@/components/shared/EmptyState';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { CategoryCard } from '@/components/shared/CategoryCard';
import { TaxCard } from '@/components/taxes/TaxCard';
import { useTaxes } from '@/api/taxes';
import { TAX_TYPES, TAX_STATUSES } from '@/utils/constants';
import { getFYOptions } from '@/utils/dates';
import { useCan } from '@/hooks/usePermissions';
import { formatINRCompact } from '@/utils/formatters';
import type { Tax, TaxType, TaxStatus } from '@/types';

const TAX_TYPE_SET = new Set(TAX_TYPES.map((t) => t.value));

function isOutstanding(t: Tax): boolean {
  return t.status === 'pending' || t.status === 'overdue';
}

import { ExportButton } from '@/components/shared/ExportButton';
import { generateTaxReport } from '@/utils/reports';

export function Taxes() {
  const navigate = useNavigate();
  // Selected category lives in the URL so the view is shareable / refresh-safe.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const selectedType = rawType && TAX_TYPE_SET.has(rawType as TaxType) ? (rawType as TaxType) : null;
  const selectCategory = (t: TaxType) => setSearchParams({ type: t });
  const clearCategory = () => setSearchParams({});

  const [status, setStatus] = useState<TaxStatus | 'all'>('all');
  const [ay, setAy] = useState<string>('all');

  // Fetch all taxes once; categories, stats and the drill-down list are derived
  // client-side (mirrors the Assets owner flow).
  const { data: taxes = [], isLoading } = useTaxes();
  const canCreate = useCan('taxes.create');

  const stats = useMemo(
    () => ({
      total: taxes.length,
      outstanding: taxes.filter(isOutstanding).reduce((sum, t) => sum + Number(t.total_amount), 0),
      overdue: taxes.filter((t) => t.status === 'overdue').length,
      paid: taxes.filter((t) => t.status === 'paid').length,
    }),
    [taxes],
  );

  const categories = useMemo(
    () =>
      TAX_TYPES.map((t) => {
        const items = taxes.filter((x) => x.tax_type === t.value);
        return {
          ...t,
          count: items.length,
          outstanding: items.filter(isOutstanding).reduce((sum, x) => sum + Number(x.total_amount), 0),
        };
      }),
    [taxes],
  );

  const categoryTaxes = useMemo(() => {
    if (!selectedType) return [];
    return taxes.filter((t) => {
      if (t.tax_type !== selectedType) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (ay !== 'all' && t.assessment_year !== ay) return false;
      return true;
    });
  }, [taxes, selectedType, status, ay]);

  const selectedMeta = TAX_TYPES.find((t) => t.value === selectedType);

  const openCreate = () =>
    navigate(selectedType ? `/taxes/new?type=${selectedType}` : '/taxes/new');
  // Open the tax's detail page - Edit and Record payment live there, mirroring
  // the Bills and Insurance card → detail flow.
  const openDetail = (tax: Tax) => navigate(`/taxes/${tax.id}`);

  // ---- Category selection (landing) view ----
  if (!selectedType) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryStatCard label="Obligations" value={String(stats.total)} icon={Receipt} accent="navy" loading={isLoading} />
          <SummaryStatCard
            label="Outstanding"
            value={stats.outstanding ? formatINRCompact(stats.outstanding) : '₹0'}
            icon={Wallet}
            accent={stats.outstanding > 0 ? 'warning' : 'slate'}
            loading={isLoading}
          />
          <SummaryStatCard
            label="Overdue"
            value={String(stats.overdue)}
            icon={AlertTriangle}
            accent={stats.overdue > 0 ? 'danger' : 'slate'}
            sublabel={stats.overdue > 0 ? 'Needs attention' : 'All clear'}
            loading={isLoading}
          />
          <SummaryStatCard label="Paid" value={String(stats.paid)} icon={CheckCircle2} accent="teal" loading={isLoading} />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tax categories</h2>
              <p className="text-sm text-slate-700">Choose a category to view its taxes.</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                onExport={() => generateTaxReport(taxes, { download: true })}
                disabled={taxes.length === 0}
              />
              {canCreate && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add tax
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
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
                  unit="tax"
                  secondary={c.outstanding > 0 ? `${formatINRCompact(c.outstanding)} due` : undefined}
                  onClick={() => selectCategory(c.value)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---- Single category's tax list view ----
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          clearCategory();
          setStatus('all');
          setAy('all');
        }}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-slate-700 hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All categories
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{selectedMeta?.label}</h2>
          <p className="text-sm text-slate-700">
            {categoryTaxes.length} obligation{categoryTaxes.length === 1 ? '' : 's'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add tax
          </Button>
        )}
      </div>

      <FilterBar>
        <Select value={status} onValueChange={(v) => setStatus(v as TaxStatus | 'all')}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TAX_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ay} onValueChange={setAy}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Assessment year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {getFYOptions().map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : categoryTaxes.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={`No ${selectedMeta?.label.toLowerCase()} obligations`}
          description="Add a tax in this category to track its due dates and payments."
          action={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add a tax
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {categoryTaxes.map((tax) => (
            <TaxCard key={tax.id} tax={tax} onView={openDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
