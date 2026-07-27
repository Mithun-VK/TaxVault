import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, CreditCard, AlertTriangle, Clock, Repeat, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterBar } from '@/components/shared/FilterBar';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { CategoryCard } from '@/components/shared/CategoryCard';
import { ExportButton } from '@/components/shared/ExportButton';
import { BillCard } from '@/components/bills/BillCard';
import { useBills } from '@/api/bills';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { allBillCategories } from '@/utils/constants';
import { generateBillsReport } from '@/utils/reports';
import { formatINRCompact } from '@/utils/formatters';
import type { BillType } from '@/types';

export function Bills() {
  const navigate = useNavigate();
  // Selected category lives in the URL so the view is shareable / refresh-safe.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  // Any slug is valid — categories can be user-created.
  const selectedType = rawType ? (rawType as BillType) : null;
  const selectCategory = (t: BillType) => setSearchParams({ type: t });
  const clearCategory = () => setSearchParams({});

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const isAdmin = useIsAdmin();

  const { data: bills = [], isLoading } = useBills();

  // Create opens a dedicated page, seeding the current category as the bill type.
  const openCreate = () =>
    navigate(selectedType ? `/bills/new?type=${selectedType}` : '/bills/new');

  // Built-ins + any custom categories users have created (derived from the data,
  // so a new category shows up as soon as a bill uses it).
  const billCategories = useMemo(
    () => allBillCategories(bills.map((b) => b.bill_type)),
    [bills],
  );

  const stats = useMemo(
    () => ({
      total: bills.length,
      pending: bills.filter((b) => b.status === 'pending').length,
      overdue: bills.filter((b) => b.status === 'overdue').length,
      autoPay: bills.filter((b) => b.auto_pay).length,
    }),
    [bills],
  );

  const categories = useMemo(
    () =>
      billCategories.map((t) => {
        const items = bills.filter((b) => b.bill_type === t.value);
        return {
          ...t,
          count: items.length,
          spend: items.reduce((sum, b) => sum + (Number(b.average_amount) || 0), 0),
        };
      }),
    [bills, billCategories],
  );

  const categoryBills = useMemo(() => {
    if (!selectedType) return [];
    const q = debounced.trim().toLowerCase();
    return bills.filter((b) => {
      if (b.bill_type !== selectedType) return false;
      if (q && !`${b.provider_name} ${b.account_number ?? ''}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [bills, selectedType, debounced]);

  const selectedMeta = billCategories.find((t) => t.value === selectedType);

  // ---- Category selection (landing) view ----
  if (!selectedType) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryStatCard
            label="Total bills"
            value={String(stats.total)}
            icon={CreditCard}
            accent="navy"
            loading={isLoading}
          />
          <SummaryStatCard
            label="Pending"
            value={String(stats.pending)}
            icon={Clock}
            accent="slate"
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
          <SummaryStatCard
            label="Auto-pay on"
            value={String(stats.autoPay)}
            icon={Repeat}
            accent="teal"
            loading={isLoading}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bill categories</h2>
              <p className="text-sm text-slate-700">Choose a category to view its bills.</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                onExport={() => generateBillsReport(bills, { download: true })}
                disabled={bills.length === 0}
              />
              {isAdmin && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add bill
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
                  unit="bill"
                  secondary={c.spend > 0 ? `${formatINRCompact(c.spend)} / cycle` : undefined}
                  onClick={() => selectCategory(c.value)}
                />
              ))}
            </div>
          )}
        </section>


      </div>
    );
  }

  // ---- Single category's bill list view ----
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          clearCategory();
          setSearch('');
        }}
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-slate-700 hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All categories
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{selectedMeta?.label}</h2>
          <p className="text-sm text-slate-700">
            {categoryBills.length} bill{categoryBills.length === 1 ? '' : 's'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add bill
          </Button>
        )}
      </div>

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search provider or account…"
          className="flex-1 sm:min-w-[240px]"
        />
      </FilterBar>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : categoryBills.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={`No ${selectedMeta?.label.toLowerCase()} bills`}
          description="Add a bill in this category to track its due dates and amounts."
          action={
            isAdmin ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add a bill
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
          {categoryBills.map((bill) => (
            <BillCard key={bill.id} bill={bill} onClick={(b) => navigate(`/bills/${b.id}`)} />
          ))}
        </div>
      )}


    </div>
  );
}
