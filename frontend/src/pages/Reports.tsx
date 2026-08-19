import { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  Download,
  SlidersHorizontal,
  Columns3,
  GripVertical,
  X,
  Check,
  TableProperties,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Coins } from 'lucide-react';
import { MultiSelect } from '@/components/shared/MultiSelect';
import { goldGrams } from '@/utils/gold';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { useAssets } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { useCompanies } from '@/api/companies';
import { useTaxes } from '@/api/taxes';
import { useInsurancePolicies } from '@/api/insurance';
import { useBills } from '@/api/bills';
import { usePayments } from '@/api/payments';
import { exportGrid } from '@/utils/reports';
import { formatINR } from '@/utils/formatters';
import {
  buildDatasets,
  columnAppliesToTypes,
  formatCell,
  isNumericColumn,
  isTotalColumn,
  type Cell,
  type ReportColumn,
  type ReportDataset,
  type ReportFilter,
} from '@/utils/reportSchema';

type Row = Record<string, unknown>;
type DateRange = { from: string; to: string };
type NumberRange = { min: string; max: string };
// `select` filters hold an array of chosen values (empty = "all"); everything else
// keeps its scalar/range shape.
type FilterValue = string | string[] | DateRange | NumberRange;

function defaultFilterValue(f: ReportFilter): FilterValue {
  switch (f.kind) {
    case 'dateRange':
      return { from: '', to: '' } as DateRange;
    case 'numberRange':
      return { min: '', max: '' } as NumberRange;
    case 'select':
      return [] as string[];
    default:
      return 'all';
  }
}

function isFilterActive(f: ReportFilter, v: FilterValue): boolean {
  if (f.kind === 'dateRange') return !!((v as DateRange).from || (v as DateRange).to);
  if (f.kind === 'numberRange') return !!((v as NumberRange).min || (v as NumberRange).max);
  if (f.kind === 'select') return (v as string[]).length > 0;
  return v !== 'all' && v !== '';
}

function matchesFilter(f: ReportFilter, v: FilterValue, row: Row): boolean {
  const cell = f.get(row);
  if (f.kind === 'select') {
    const chosen = v as string[];
    return chosen.length === 0 || chosen.includes(String(cell ?? ''));
  }
  if (f.kind === 'bool') return v === 'all' || (cell ? 'yes' : 'no') === v;
  if (f.kind === 'dateRange') {
    const { from, to } = v as DateRange;
    if (!from && !to) return true;
    if (!cell) return false;
    const d = String(cell).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }
  if (f.kind === 'numberRange') {
    const { min, max } = v as NumberRange;
    const n = Number(cell) || 0;
    if (min !== '' && n < Number(min)) return false;
    if (max !== '' && n > Number(max)) return false;
    return true;
  }
  return true;
}

export function Reports() {
  // Reports include archived properties too (shown with an "Archived" status).
  const { data: assets = [] } = useAssets({ include_archived: true });
  const { data: individualsData } = useIndividuals();
  const { data: companiesData } = useCompanies();
  const { data: taxes = [] } = useTaxes();
  const { data: insurance = [] } = useInsurancePolicies();
  const { data: bills = [] } = useBills();
  const { data: payments = [] } = usePayments();

  // Resolve a linked asset/individual id → its name, for the taxes & insurance
  // "Linked To" columns (a policy or tax points at either a property or a person).
  const linkedName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) map.set(a.id, a.name);
    for (const i of individualsData?.items ?? []) map.set(i.id, i.full_name);
    return (id?: string | null) => (id ? map.get(id) : undefined);
  }, [assets, individualsData]);

  // Current gold price per gram (₹), typed on the toolbar - drives the live
  // "Current Gold Value" column and the active-gold valuation summary.
  const [goldPrice, setGoldPrice] = useState('');
  const goldPricePerGram = Number(goldPrice) || 0;

  const companies = companiesData?.items ?? [];

  const datasets = useMemo(
    () =>
      buildDatasets(
        { assets, companies, taxes, insurance, bills, payments, linkedName },
        goldPricePerGram,
      ),
    [assets, companies, taxes, insurance, bills, payments, linkedName, goldPricePerGram],
  );

  const [datasetId, setDatasetId] = useState('properties');
  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0];

  const [search, setSearch] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(datasets[0].columns.map((c) => [c.key, !c.defaultHidden])),
  );
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>(() =>
    Object.fromEntries(datasets[0].filters.map((f) => [f.key, defaultFilterValue(f)])),
  );
  // User-defined column order (list of column keys) - drag-to-reorder in the
  // Columns menu. Reset to the schema order whenever the dataset changes.
  const [colOrder, setColOrder] = useState<string[]>(() => datasets[0].columns.map((c) => c.key));

  // Reset column visibility + order + filters whenever the active dataset changes.
  useEffect(() => {
    setVisibleCols(
      Object.fromEntries(dataset.columns.map((c) => [c.key, !c.defaultHidden])),
    );
    setColOrder(dataset.columns.map((c) => c.key));
    setFilterValues(Object.fromEntries(dataset.filters.map((f) => [f.key, defaultFilterValue(f)])));
    setSearch('');
    setShowMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  // Asset types chosen in the filter (properties dataset only) drive which
  // type-specific columns (gold / vehicle / property) are even available.
  const selectedTypes =
    dataset.id === 'properties' ? ((filterValues['asset_type'] as string[]) ?? []) : [];

  // Columns in user order, then narrowed to the selected asset type(s).
  const byKey = useMemo(
    () => new Map(dataset.columns.map((c) => [c.key, c])),
    [dataset],
  );
  const orderedKeys = useMemo(() => {
    const known = new Set(colOrder);
    // Append any schema columns missing from the saved order (defensive).
    return [...colOrder, ...dataset.columns.map((c) => c.key).filter((k) => !known.has(k))];
  }, [colOrder, dataset]);
  const availableColumns = orderedKeys
    .map((k) => byKey.get(k))
    .filter((c): c is ReportColumn => !!c && columnAppliesToTypes(c, selectedTypes));

  const columns = availableColumns.filter(
    (c) => visibleCols[c.key] || (c.key === 'gold_current_value' && goldPricePerGram > 0),
  );

  // Reorder the available subset, keeping non-available columns pinned in place.
  const handleReorder = (newAvailableKeys: string[]) => {
    const availableSet = new Set(availableColumns.map((c) => c.key));
    const queue = [...newAvailableKeys];
    setColOrder(orderedKeys.map((k) => (availableSet.has(k) ? (queue.shift() ?? k) : k)));
  };
  const primaryFilters = dataset.filters.filter((f) => f.primary);
  const moreFilters = dataset.filters.filter((f) => !f.primary);

  const activeFilterCount = dataset.filters.reduce(
    (n, f) => n + (isFilterActive(f, filterValues[f.key] ?? defaultFilterValue(f)) ? 1 : 0),
    0,
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.rows.filter((row) => {
      if (q && !dataset.search(row).toLowerCase().includes(q)) return false;
      return dataset.filters.every((f) =>
        matchesFilter(f, filterValues[f.key] ?? defaultFilterValue(f), row as Row),
      );
    });
  }, [dataset, search, filterValues]);

  // Column totals for money + flagged numeric columns (sticky footer row).
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of columns) {
      if (!isTotalColumn(c)) continue;
      t[c.key] = rows.reduce((s, r) => s + (Number(c.get(r as Row)) || 0), 0);
    }
    return t;
  }, [columns, rows]);

  // Live valuation of gold assets currently in "active" status.
  const activeGold = useMemo(() => {
    const rows = assets.filter((a) => a.asset_type === 'gold' && a.status === 'active');
    const grams = rows.reduce((s, a) => s + goldGrams(a), 0);
    return { count: rows.length, grams, value: grams * goldPricePerGram };
  }, [assets, goldPricePerGram]);

  const resetFilters = () => {
    setFilterValues(Object.fromEntries(dataset.filters.map((f) => [f.key, defaultFilterValue(f)])));
    setSearch('');
  };

  const setFilter = (key: string, value: FilterValue) =>
    setFilterValues((prev) => ({ ...prev, [key]: value }));

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const body: (string | number)[][] = rows.map((r) =>
      columns.map((c) => formatCell(c.type, c.get(r as Row))),
    );
    // Append a summation row for money + flagged numeric columns.
    if (columns.some(isTotalColumn)) {
      const totalRow = columns.map((c, idx) => {
        if (isTotalColumn(c)) {
          return c.type === 'money'
            ? formatINR(totals[c.key] ?? 0)
            : (totals[c.key] ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
        }
        return idx === 0 ? 'TOTAL' : '';
      });
      body.push(new Array(columns.length).fill(''), totalRow);
    }
    exportGrid(headers, body, dataset.label, `TaxVault_${dataset.label}`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <TableProperties className="h-5 w-5 text-brand-navy" /> Reports
          </h1>
          <p className="mt-0.5 text-sm text-slate-700">
            Build a spreadsheet from any part of the vault - pick the columns, filter the rows, export to Excel.
          </p>
        </div>
        <Button onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export to Excel</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      {/* Dataset tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap">
        {datasets.map((d) => {
          const Icon = d.icon;
          const active = d.id === datasetId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDatasetId(d.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {d.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-white/20' : 'bg-slate-100 text-slate-700',
                )}
              >
                {d.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-surface-border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${dataset.label.toLowerCase()}…`}
            className="w-full sm:w-56"
          />
          {primaryFilters.map((f) => (
            <FilterControl
              key={f.key}
              filter={f}
              value={filterValues[f.key] ?? defaultFilterValue(f)}
              onChange={(v) => setFilter(f.key, v)}
            />
          ))}

          <div className="ml-auto flex items-center gap-2">
            {moreFilters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMore((s) => !s)}
                className={cn(showMore && 'border-brand-navy text-brand-navy')}
              >
                <SlidersHorizontal className="h-4 w-4" /> More filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-brand-navy px-1.5 text-xs text-white tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}
            <ColumnPicker
              columns={availableColumns}
              visible={visibleCols}
              onToggle={(key) =>
                setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              onReorder={handleReorder}
              onReset={() => {
                setVisibleCols(
                  Object.fromEntries(dataset.columns.map((c) => [c.key, !c.defaultHidden])),
                );
                setColOrder(dataset.columns.map((c) => c.key));
              }}
            />
          </div>
        </div>

        {/* More filters panel */}
        {showMore && moreFilters.length > 0 && (
          <div className="mt-3 space-y-3 border-t border-surface-border pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {moreFilters.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">{f.label}</label>
                  <FilterControl
                    filter={f}
                    value={filterValues[f.key] ?? defaultFilterValue(f)}
                    onChange={(v) => setFilter(f.key, v)}
                    expanded
                  />
                </div>
              ))}
              {datasetId === 'properties' && (
                <div className="space-y-1.5">
                  <label htmlFor="gold-price" className="text-xs font-medium text-slate-700">
                    Gold price (₹/g)
                  </label>
                  <Input
                    id="gold-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="Current price per gram"
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
            </div>

            {/* Live gold valuation (active status) */}
            {datasetId === 'properties' && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-surface-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <Coins className="h-4 w-4 text-slate-600" /> Active gold
                </span>
                <span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {activeGold.count}
                  </span>{' '}
                  {activeGold.count === 1 ? 'item' : 'items'} ·{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {activeGold.grams.toFixed(2)} g
                  </span>
                </span>
                <span>
                  Current value:{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {goldPricePerGram > 0 ? formatINR(activeGold.value) : '-'}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result meta */}
      <div className="flex items-center justify-between text-sm text-slate-700">
        <span>
          <span className="font-semibold text-slate-800 tabular-nums">{rows.length}</span> of{' '}
          {dataset.rows.length} {dataset.label.toLowerCase()} · {columns.length} columns
        </span>
        {(activeFilterCount > 0 || search) && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {columns.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="No columns selected"
          description="Use the Columns menu to choose which fields appear in the grid."
        />
      ) : (
        <ReportGrid dataset={dataset} columns={columns} rows={rows as Row[]} totals={totals} />
      )}
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function ReportGrid({
  dataset,
  columns,
  rows,
  totals,
}: {
  dataset: ReportDataset;
  columns: ReportColumn[];
  rows: Row[];
  totals: Record<string, number>;
}) {
  const hasTotals = columns.some(isTotalColumn);
  return (
    <div className="overflow-auto rounded-xl border border-surface-border bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 w-10 border-b border-r border-surface-border bg-slate-50 px-2 py-2 text-right font-semibold text-slate-600">
              #
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  'whitespace-nowrap border-b border-r border-surface-border bg-slate-50 px-3 py-2 font-semibold uppercase tracking-wide text-slate-700',
                  isNumericColumn(c.type) ? 'text-right' : 'text-left',
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-4 py-12 text-center text-sm text-slate-600"
              >
                No {dataset.label.toLowerCase()} match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={dataset.rowKey(row)} className="even:bg-slate-50/40 hover:bg-brand-navy-muted/40">
                <td className="sticky left-0 z-[1] border-b border-r border-surface-border bg-inherit px-2 py-1.5 text-right font-mono text-slate-500">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <GridCell key={c.key} column={c} value={c.get(row)} />
                ))}
              </tr>
            ))
          )}
        </tbody>
        {hasTotals && rows.length > 0 && (
          <tfoot className="sticky bottom-0">
            <tr className="bg-slate-100 font-medium">
              <td className="sticky left-0 border-t border-r border-surface-border bg-slate-100 px-2 py-2" />
              {columns.map((c, idx) => (
                <td
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap border-t border-r border-surface-border px-3 py-2 text-slate-700',
                    isNumericColumn(c.type) ? 'text-right font-mono tabular-nums' : 'text-left',
                  )}
                >
                  {c.type === 'money'
                    ? formatINR(totals[c.key] ?? 0)
                    : isTotalColumn(c)
                      ? (totals[c.key] ?? 0).toLocaleString('en-IN', {
                          maximumFractionDigits: 3,
                        })
                      : idx === 0
                        ? 'Total'
                        : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function GridCell({ column, value }: { column: ReportColumn; value: Cell }) {
  const numeric = isNumericColumn(column.type);
  return (
    <td
      className={cn(
        'whitespace-nowrap border-b border-r border-surface-border px-3 py-2',
        numeric ? 'text-right font-mono tabular-nums text-slate-900' : 'text-slate-800',
      )}
    >
      {column.type === 'status' && value ? (
        <StatusBadge status={String(value)} showIcon={false} />
      ) : (
        formatCell(column.type, value)
      )}
    </td>
  );
}

// ── Column picker (toggle visibility + drag to reorder) ──────────────────────
function ColumnPicker({
  columns,
  visible,
  onToggle,
  onReorder,
  onReset,
}: {
  columns: ReportColumn[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
  onReorder: (keys: string[]) => void;
  onReset: () => void;
}) {
  const shown = columns.filter((c) => visible[c.key]).length;
  const orderKeys = columns.map((c) => c.key);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4" /> Columns
          <span className="ml-1 text-xs text-slate-600 tabular-nums">
            {shown}/{columns.length}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div>
            <span className="text-xs font-semibold text-slate-700">Columns</span>
            <p className="text-[12px] text-slate-600">Drag to reorder · click to show/hide</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-brand-navy hover:underline"
          >
            Reset
          </button>
        </div>
        <Reorder.Group axis="y" values={orderKeys} onReorder={onReorder} className="py-1">
          {columns.map((c) => (
            <ColumnRow
              key={c.key}
              column={c}
              visible={!!visible[c.key]}
              onToggle={() => onToggle(c.key)}
            />
          ))}
        </Reorder.Group>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnRow({
  column,
  visible,
  onToggle,
}: {
  column: ReportColumn;
  visible: boolean;
  onToggle: () => void;
}) {
  // Drag only starts from the grip handle so the visibility toggle stays clickable.
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={column.key}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 hover:bg-slate-100"
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none text-slate-600 hover:text-slate-600"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-2 text-left text-sm text-slate-700"
      >
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
            visible ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-300',
          )}
        >
          {visible && <Check className="h-3 w-3" />}
        </span>
        {column.label}
      </button>
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-600">
        {column.group}
      </span>
    </Reorder.Item>
  );
}

// ── Filter controls ─────────────────────────────────────────────────────────
function FilterControl({
  filter,
  value,
  onChange,
  expanded,
}: {
  filter: ReportFilter;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  expanded?: boolean;
}) {
  if (filter.kind === 'select') {
    return (
      <MultiSelect
        label={filter.label}
        options={filter.options ?? []}
        selected={(value as string[]) ?? []}
        onChange={(v) => onChange(v)}
        expanded={expanded}
      />
    );
  }

  if (filter.kind === 'bool') {
    return (
      <Select value={value as string} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className={cn('h-9', expanded ? 'w-full' : 'w-auto min-w-[8rem]')} aria-label={filter.label}>
          <SelectValue placeholder={filter.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{filter.label}: Any</SelectItem>
          <SelectItem value="yes">{filter.label}: Yes</SelectItem>
          <SelectItem value="no">{filter.label}: No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (filter.kind === 'dateRange') {
    const v = value as DateRange;
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={v.from}
          onChange={(e) => onChange({ ...v, from: e.target.value })}
          className="h-9"
          aria-label={`${filter.label} from`}
        />
        <span className="text-xs text-slate-600">to</span>
        <Input
          type="date"
          value={v.to}
          onChange={(e) => onChange({ ...v, to: e.target.value })}
          className="h-9"
          aria-label={`${filter.label} to`}
        />
      </div>
    );
  }

  // numberRange
  const v = value as NumberRange;
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        placeholder="Min"
        value={v.min}
        onChange={(e) => onChange({ ...v, min: e.target.value })}
        className="h-9"
        aria-label={`${filter.label} minimum`}
      />
      <span className="text-xs text-slate-600">–</span>
      <Input
        type="number"
        inputMode="numeric"
        placeholder="Max"
        value={v.max}
        onChange={(e) => onChange({ ...v, max: e.target.value })}
        className="h-9"
        aria-label={`${filter.label} maximum`}
      />
    </div>
  );
}
