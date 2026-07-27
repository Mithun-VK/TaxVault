import { useMemo, useState } from 'react';
import { Download, Wallet, Table2, Rows3, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { MultiSelect } from '@/components/shared/MultiSelect';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PaymentAccordion } from '@/components/payments/PaymentAccordion';
import { PaymentRow } from '@/components/payments/PaymentRow';
import { ReceiptViewer } from '@/components/payments/ReceiptViewer';
import { usePayments, usePaymentSummary } from '@/api/payments';
import { useDocuments } from '@/api/documents';
import { generatePaymentsReport } from '@/utils/reports';
import { useTaxes } from '@/api/taxes';
import { useBills } from '@/api/bills';
import { useInsurancePolicies } from '@/api/insurance';
import { useAssets } from '@/api/assets';
import { TAX_TYPES, BILL_TYPES, INSURANCE_TYPES, ASSET_TYPES } from '@/utils/constants';
import { formatINR, getEntityTypeLabel, getPaymentMethodLabel } from '@/utils/formatters';
import { formatDate, toInputDate, getCurrentFY, getFYOptions } from '@/utils/dates';
import type { Payment, PaymentEntityType, PaymentMethod } from '@/types';

// Sub-types offered once a category is chosen — mirrors the Analytics explorer.
type SubCategory = Exclude<PaymentEntityType, 'all'>;
const SUBTYPES: Record<SubCategory, { value: string; label: string }[]> = {
  tax: TAX_TYPES,
  bill: BILL_TYPES,
  insurance: INSURANCE_TYPES,
  asset: ASSET_TYPES,
};
const SUB_LABEL: Record<SubCategory, string> = {
  tax: 'Tax type',
  bill: 'Bill type',
  insurance: 'Policy type',
  asset: 'Asset type',
};
const ENTITY_LABEL: Record<SubCategory, string> = {
  tax: 'Obligation',
  bill: 'Provider',
  insurance: 'Policy',
  asset: 'Asset',
};

const CATEGORY_OPTIONS = [
  { value: 'asset', label: 'Assets' },
  { value: 'bill', label: 'Bills' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'tax', label: 'Taxes' },
];

// Date-range presets. Quarter / half / year-to-date / financial-year follow the
// Indian financial year (Apr–Mar), matching the rest of the app.
type DatePreset = 'all' | 'this_month' | 'quarter' | 'half' | 'ytd' | 'fy' | 'custom';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this_month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'half', label: 'Half year' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'fy', label: 'Financial year' },
  { value: 'custom', label: 'Custom range' },
];

/** Resolve a preset to a concrete { from, to } (YYYY-MM-DD); empty = unbounded. */
function presetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0 = Jan, 3 = Apr
  const iso = (d: Date) => toInputDate(d);
  const fyStartYear = m >= 3 ? y : y - 1; // FY starts in April
  const fyStart = new Date(fyStartYear, 3, 1);
  const fyEnd = new Date(fyStartYear + 1, 2, 31);
  const offset = (m - 3 + 12) % 12; // months since the FY start (0–11)

  switch (preset) {
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'quarter': {
      const qStartCal = (3 + Math.floor(offset / 3) * 3) % 12; // Apr/Jul/Oct/Jan
      const qStartYear = qStartCal >= 3 ? fyStartYear : fyStartYear + 1;
      return {
        from: iso(new Date(qStartYear, qStartCal, 1)),
        to: iso(new Date(qStartYear, qStartCal + 3, 0)),
      };
    }
    case 'half':
      return offset < 6
        ? { from: iso(new Date(fyStartYear, 3, 1)), to: iso(new Date(fyStartYear, 9, 0)) }
        : { from: iso(new Date(fyStartYear, 9, 1)), to: iso(new Date(fyStartYear + 1, 3, 0)) };
    case 'ytd':
      return { from: iso(fyStart), to: iso(now) };
    case 'fy':
      return { from: iso(fyStart), to: iso(fyEnd) };
    default:
      return { from: '', to: '' };
  }
}

/** A specific Indian FY like "2025-26" → its Apr 1 → Mar 31 range. */
function fyRange(fy: string): { from: string; to: string } {
  const start = parseInt(fy.slice(0, 4), 10);
  if (!start) return { from: '', to: '' };
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

// Current FY + the previous five (newest first) — getFYOptions() also includes
// next year, which isn't useful for a past-payments filter, so drop it.
const FY_CHOICES = getFYOptions().filter((fy) => fy <= getCurrentFY());

export function Payments() {
  // Every filter is now multi-select (empty array = "all"), so category narrowing
  // happens client-side and we always fetch the full ledger for the date window.
  const [categories, setCategories] = useState<string[]>([]);
  const [subTypes, setSubTypes] = useState<string[]>([]);
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  // Which financial year is active when the "Financial year" preset is chosen.
  const [fyChoice, setFyChoice] = useState<string>(getCurrentFY());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'ledger' | 'grouped'>('ledger');

  // Presets compute a concrete from/to; "Custom range" keeps the manual inputs.
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    // "Financial year" spans the chosen FY (Apr–Mar), not just the current one.
    const range = preset === 'fy' ? fyRange(fyChoice) : presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  };

  const applyFyChoice = (fy: string) => {
    setFyChoice(fy);
    const range = fyRange(fy);
    setFrom(range.from);
    setTo(range.to);
  };

  const { data: payments = [], isLoading } = usePayments({
    date_from: from || undefined,
    date_to: to || undefined,
  });
  const { data: summary } = usePaymentSummary();
  const { data: documents = [] } = useDocuments();
  const [receiptDocId, setReceiptDocId] = useState<string | null>(null);

  // Sub-type isn't a payment field, so resolve entity_id → sub-type from the
  // entity lists (UUIDs never collide across types, so one flat map is safe).
  const { data: taxes = [] } = useTaxes();
  const { data: bills = [] } = useBills();
  const { data: policies = [] } = useInsurancePolicies();
  const { data: assets = [] } = useAssets();
  const subTypeById = useMemo(() => {
    const m = new Map<string, string>();
    taxes.forEach((t) => m.set(t.id, t.tax_type));
    bills.forEach((b) => m.set(b.id, b.bill_type));
    policies.forEach((p) => m.set(p.id, p.insurance_type));
    assets.forEach((a) => m.set(a.id, a.asset_type));
    return m;
  }, [taxes, bills, policies, assets]);

  const showCascade = categories.length > 0;
  // Use the category-specific wording when exactly one category is chosen.
  const singleCategory = categories.length === 1 ? (categories[0] as SubCategory) : null;
  const subTypeFilterLabel = singleCategory ? SUB_LABEL[singleCategory] : 'Type';
  const entityFilterLabel = singleCategory ? ENTITY_LABEL[singleCategory] : 'Entity';
  // Union of the sub-types offered by whichever categories are selected.
  const subTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const c of categories) {
      for (const o of SUBTYPES[c as SubCategory] ?? []) {
        if (!seen.has(o.value)) {
          seen.add(o.value);
          opts.push(o);
        }
      }
    }
    return opts;
  }, [categories]);

  // Specific entities present in the current category (+ sub-type) selection.
  const entityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of payments) {
      if (categories.length > 0 && !categories.includes(p.entity_type)) continue;
      if (subTypes.length > 0 && !subTypes.includes(subTypeById.get(p.entity_id) ?? '')) continue;
      seen.set(p.entity_id, p.entity_name ?? getEntityTypeLabel(p.entity_type));
    }
    return [...seen]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payments, categories, subTypes, subTypeById]);

  // Payment methods actually present in the ledger.
  const methodOptions = useMemo(() => {
    const seen = new Set<PaymentMethod>();
    for (const p of payments) if (p.payment_method) seen.add(p.payment_method);
    return [...seen]
      .map((m) => ({ value: m, label: getPaymentMethodLabel(m) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payments]);

  // The ledger rows after all client-side narrowing.
  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        if (categories.length > 0 && !categories.includes(p.entity_type)) return false;
        if (subTypes.length > 0 && !subTypes.includes(subTypeById.get(p.entity_id) ?? '')) return false;
        if (entityIds.length > 0 && !entityIds.includes(p.entity_id)) return false;
        if (methods.length > 0 && !methods.includes(p.payment_method)) return false;
        return true;
      }),
    [payments, categories, subTypes, entityIds, methods, subTypeById],
  );

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0),
    [filteredPayments],
  );

  const docsById = new Map(documents.map((d) => [d.id, d]));

  // Open the receipt in the inline viewer; downloading happens from inside it.
  const handleReceipt = (docId: string) => setReceiptDocId(docId);

  // Export exactly the rows currently in view (after all filters), like Reports.
  const handleExport = () => {
    generatePaymentsReport(filteredPayments, { download: true, filename: 'TaxVault_Payments' });
  };

  const columns: Column<Payment>[] = [
    { header: 'Date', cell: (p) => <span className="text-slate-600">{formatDate(p.payment_date)}</span> },
    {
      header: 'Type',
      cell: (p) => (
        <Badge variant="outline" className="text-slate-700">
          {getEntityTypeLabel(p.entity_type)}
        </Badge>
      ),
    },
    { header: 'Entity', cell: (p) => <span className="font-medium text-slate-800">{p.entity_name}</span> },
    {
      header: 'Amount',
      headClassName: 'text-right',
      className: 'text-right',
      cell: (p) => (
        <span className="font-mono font-semibold tabular-nums text-slate-900">
          {formatINR(p.amount_paid)}
        </span>
      ),
    },
    { header: 'Method', cell: (p) => getPaymentMethodLabel(p.payment_method) },
    {
      header: 'Period',
      cell: (p) => <span className="text-slate-700">{p.period || '—'}</span>,
    },
    {
      header: 'Reference',
      cell: (p) => <span className="text-slate-700">{p.reference_number || '—'}</span>,
    },
    {
      header: 'Receipt',
      cell: (p) => {
        if (!p.receipt_document_id) return <span className="text-slate-500">—</span>;
        const doc = docsById.get(p.receipt_document_id);
        const label = doc?.label ?? 'Receipt';
        const tip = doc
          ? `View ${doc.file_name || label} · uploaded ${formatDate(doc.created_at)}`
          : 'View receipt';
        return (
          <button
            type="button"
            onClick={() => handleReceipt(p.receipt_document_id as string)}
            title={tip}
            className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-2 py-1 text-sm text-brand-navy hover:bg-slate-100"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="flex items-center justify-between gap-2 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs text-slate-700 sm:text-sm">Paid this month</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
              {summary ? formatINR(summary.total_this_month) : '—'}
            </p>
          </div>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal sm:flex">
            <Wallet className="h-5 w-5" />
          </div>
        </Card>
        <Card className="flex items-center justify-between gap-2 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs text-slate-700 sm:text-sm">Paid this financial year</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
              {summary ? formatINR(summary.total_this_fy) : '—'}
            </p>
          </div>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy sm:flex">
            <Wallet className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Category-aware multi-select filters: Category → Sub-type → Entity, + Method */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">
            Category
          </Label>
          <MultiSelect
            label="Categories"
            options={CATEGORY_OPTIONS}
            selected={categories}
            onChange={(v) => {
              setCategories(v);
              // Dependent selections no longer make sense once the categories change.
              setSubTypes([]);
              setEntityIds([]);
            }}
            className="h-11 text-base font-medium sm:w-60"
          />
        </div>

        {showCascade && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">
              {subTypeFilterLabel}
            </Label>
            <MultiSelect
              label={subTypeFilterLabel}
              options={subTypeOptions}
              selected={subTypes}
              onChange={(v) => {
                setSubTypes(v);
                setEntityIds([]);
              }}
              className="h-11 text-base font-medium sm:w-52"
            />
          </div>
        )}

        {showCascade && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">
              {entityFilterLabel}
            </Label>
            <MultiSelect
              label={entityFilterLabel}
              options={entityOptions}
              selected={entityIds}
              onChange={setEntityIds}
              className="h-11 text-base font-medium sm:w-64"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">
            Method
          </Label>
          <MultiSelect
            label="Methods"
            options={methodOptions}
            selected={methods}
            onChange={setMethods}
            className="h-11 text-base font-medium sm:w-52"
          />
        </div>
      </div>

      <FilterBar>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
            <Label className="text-xs text-slate-600">Period</Label>
            <Select value={datePreset} onValueChange={(v) => applyDatePreset(v as DatePreset)}>
              <SelectTrigger aria-label="Date period" className="w-full min-w-0 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {datePreset === 'fy' && (
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-slate-600">FY</Label>
              <Select value={fyChoice} onValueChange={applyFyChoice}>
                <SelectTrigger aria-label="Financial year" className="w-full min-w-0 sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FY_CHOICES.map((fy) => (
                    <SelectItem key={fy} value={fy}>
                      {fy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {datePreset === 'custom' && (
            <>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="from" className="text-xs text-slate-600">From</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full min-w-0 sm:w-auto"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="to" className="text-xs text-slate-600">To</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full min-w-0 sm:w-auto"
                />
              </div>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredPayments.length === 0}
          >
            <Download className="h-4 w-4" /> Export to Excel
          </Button>
          <div className="flex rounded-lg border border-surface-border p-0.5">
            <button
              type="button"
              onClick={() => setView('ledger')}
              aria-label="Ledger view"
              className={cn('rounded-md p-1.5', view === 'ledger' ? 'bg-slate-100 text-brand-navy' : 'text-slate-600')}
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('grouped')}
              aria-label="Grouped view"
              className={cn('rounded-md p-1.5', view === 'grouped' ? 'bg-slate-100 text-brand-navy' : 'text-slate-600')}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </FilterBar>

      {/* Selection summary — count + total for the active filter */}
      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-sm text-slate-700">
          {filteredPayments.length} payment{filteredPayments.length === 1 ? '' : 's'}
        </p>
        <p className="text-sm text-slate-700">
          Total{' '}
          <span className="font-mono font-semibold tabular-nums text-slate-900">
            {formatINR(filteredTotal)}
          </span>
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : view === 'ledger' ? (
        <>
          {/* Desktop: full multi-column ledger. */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredPayments}
              getRowKey={(p) => p.id}
              emptyState="No payments match these filters."
            />
          </div>
          {/* Mobile: a tidy card list — the 7-column table can't fit a phone. */}
          <div className="md:hidden">
            {filteredPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border py-10 text-center text-sm text-slate-600">
                No payments match these filters.
              </div>
            ) : (
              <div className="divide-y divide-surface-border rounded-xl border border-surface-border bg-white px-4">
                {filteredPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} onReceipt={handleReceipt} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <PaymentAccordion payments={filteredPayments} onReceipt={handleReceipt} />
      )}

      <ReceiptViewer
        documentId={receiptDocId}
        doc={receiptDocId ? docsById.get(receiptDocId) : undefined}
        onClose={() => setReceiptDocId(null)}
      />
    </div>
  );
}
