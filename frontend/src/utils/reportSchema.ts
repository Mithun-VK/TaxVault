import {
  Briefcase,
  Building2,
  Landmark,
  Shield,
  Receipt,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Asset, Bill, Company, InsurancePolicy, Payment, Tax } from '@/types';
import {
  INSURANCE_TYPES,
  TAX_TYPES,
  ASSET_TYPES,
  allBillCategories,
  gramsToSovereigns,
  gstStateName,
} from './constants';
import { formatINR, getAssetOwner, getStatusLabel } from './formatters';
import { formatDate } from './dates';
import { canonicalEnum } from './enums';
import { PROPERTY_FIELDS, resolveAssetField } from './propertyFields';
import {
  goldCategory,
  goldReference,
  goldShop,
  goldBillNumber,
  goldBillDate,
  goldCount,
  goldPurity,
  goldGrams,
  goldValue,
  goldLocatedAt,
} from './gold';

/**
 * The Reports page is a single, dataset-driven Excel-like grid. Every entity in
 * the app (properties, taxes, insurance, bills, payments) is described here as a
 * set of columns + filters, so the grid, the column picker and the Excel export
 * all read from one source of truth.
 */

export type Cell = string | number | boolean | null | undefined;

export type ColumnType = 'text' | 'money' | 'number' | 'date' | 'label' | 'status' | 'bool';

export interface ReportColumn<T = Row> {
  key: string;
  label: string;
  /** Column-picker grouping. */
  group: string;
  type: ColumnType;
  /** Hidden by default (still selectable in the column picker). */
  defaultHidden?: boolean;
  /** Sum this column in the footer total row. `money` columns total implicitly. */
  total?: boolean;
  get: (row: T) => Cell;
}

/** True if a column should be summed in the footer total row. */
export function isTotalColumn(c: ReportColumn): boolean {
  return c.type === 'money' || c.total === true;
}

// Properties dataset column groups that only apply to certain asset types. Core
// and Meta groups (absent here) apply to every type.
const GROUP_ASSET_TYPES: Record<string, string[]> = {
  Property: [
    'land',
    'building',
    'residential_building',
    'commercial_building',
    'agricultural_land',
    'vacant_land',
    'non_agricultural_land',
  ],
  Building: ['building', 'residential_building', 'commercial_building'],
  Valuation: [
    'land',
    'building',
    'residential_building',
    'commercial_building',
    'agricultural_land',
    'vacant_land',
    'non_agricultural_land',
  ],
  Gold: ['gold'],
  Vehicle: ['vehicle'],
};

/**
 * True if a column is relevant to the selected asset types. With no type filter
 * every column is available; once one or more types are chosen, type-specific
 * groups (Gold/Vehicle/Property) are hidden unless a matching type is selected —
 * so a "Building" report drops the gold/vehicle columns entirely.
 */
export function columnAppliesToTypes(c: ReportColumn, selectedTypes: string[]): boolean {
  if (selectedTypes.length === 0) return true;
  const groupTypes = GROUP_ASSET_TYPES[c.group];
  if (!groupTypes) return true; // Core / Meta — always relevant
  return groupTypes.some((t) => selectedTypes.includes(t));
}

export type FilterKind = 'select' | 'dateRange' | 'numberRange' | 'bool';

export interface ReportFilter<T = Row> {
  key: string;
  label: string;
  kind: FilterKind;
  /** Shown in the main toolbar; the rest live behind "More filters". */
  primary?: boolean;
  /** Options for a `select` filter (derived from the rows). */
  options?: { label: string; value: string }[];
  get: (row: T) => Cell;
}

export interface ReportDataset<T = Row> {
  id: string;
  label: string;
  icon: LucideIcon;
  rows: T[];
  columns: ReportColumn<T>[];
  filters: ReportFilter<T>[];
  rowKey: (row: T) => string;
  search: (row: T) => string;
}

type Row = Record<string, unknown>;

export interface ReportData {
  assets: Asset[];
  companies?: Company[];
  taxes: Tax[];
  insurance: InsurancePolicy[];
  bills: Bill[];
  payments: Payment[];
  /** Resolve a linked asset/individual id to its display name (Reports builds it). */
  linkedName: (id?: string | null) => string | undefined;
}

type LinkedNameFn = (id?: string | null) => string | undefined;

// ── Cell formatting (shared by the grid and the Excel export) ────────────────
export function formatCell(type: ColumnType, value: Cell): string {
  if (type === 'bool') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return formatINR(Number(value));
    case 'number':
      return String(value);
    case 'date':
      return formatDate(String(value));
    case 'label':
    case 'status':
      return getStatusLabel(String(value));
    default:
      return String(value);
  }
}

export function isNumericColumn(type: ColumnType): boolean {
  return type === 'money' || type === 'number';
}

/** Distinct values of an accessor across rows, as select options. */
function distinctOptions<T>(
  rows: T[],
  get: (row: T) => Cell,
  label: (v: string) => string = getStatusLabel,
): { label: string; value: string }[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = get(r);
    if (v !== null && v !== undefined && v !== '') seen.add(String(v));
  }
  return [...seen]
    .sort((a, b) => label(a).localeCompare(label(b)))
    .map((v) => ({ label: label(v), value: v }));
}

const optionsFrom = (opts: { label: string; value: string }[]) =>
  opts.map((o) => ({ label: o.label, value: o.value }));

// ── Properties ────────────────────────────────────────────────────────────────
function propertiesDataset(assets: Asset[], goldPricePerGram = 0): ReportDataset<Asset> {
  const meta = (a: Asset, key: string): Cell => {
    const v = (a.metadata as Record<string, unknown> | null)?.[key];
    return v === null || v === undefined ? undefined : (v as Cell);
  };

  const columns: ReportColumn<Asset>[] = [
    { key: 'name', label: 'Property Name', group: 'Core', type: 'text', get: (a) => a.name },
    { key: 'owner', label: 'Owner', group: 'Core', type: 'text', get: (a) => getAssetOwner(a) },
    { key: 'asset_type', label: 'Type', group: 'Core', type: 'label', get: (a) => a.asset_type },
    { key: 'status', label: 'Status', group: 'Core', type: 'status', get: (a) => a.status },
    {
      key: 'current_value',
      label: 'Current Value',
      group: 'Core',
      type: 'money',
      get: (a) => a.current_value || undefined,
    },
    {
      key: 'acquisition_date',
      label: 'Acquired',
      group: 'Core',
      type: 'date',
      get: (a) => a.acquisition_date ?? undefined,
    },
    {
      key: 'acquisition_cost',
      label: 'Purchase Price',
      group: 'Core',
      type: 'money',
      defaultHidden: true,
      get: (a) => a.acquisition_cost || undefined,
    },
    {
      key: 'description',
      label: 'Description',
      group: 'Core',
      type: 'text',
      defaultHidden: true,
      get: (a) => a.description,
    },
    // Property (land & building) fields, in canonical order.
    ...PROPERTY_FIELDS.filter((f) => f.key !== 'owner_name').map<ReportColumn<Asset>>((f) => ({
      key: `prop_${f.key}`,
      label: f.label,
      group: 'Property',
      type: f.input === 'date' ? 'date' : 'text',
      defaultHidden: true,
      get: (a) => resolveAssetField(a, f),
    })),
    // Buildup area, deed type & tax numbers come from the PROPERTY_FIELDS map
    // above. The current value lives in the Core `current_value` column; its
    // auto-stamped as-of date is in metadata.
    { key: 'current_value_at', label: 'Value As Of', group: 'Valuation', type: 'date', defaultHidden: true, get: (a) => meta(a, 'current_value_at') },
    // Gold — full jewel detail (only populated for gold assets).
    { key: 'gold_category', label: 'Gold Category', group: 'Gold', type: 'label', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldCategory(a) : undefined) },
    { key: 'gold_reference', label: 'Reference No.', group: 'Gold', type: 'text', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldReference(a) : undefined) },
    { key: 'gold_shop', label: 'Shop Name', group: 'Gold', type: 'text', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldShop(a) : undefined) },
    { key: 'gold_bill_number', label: 'Bill No.', group: 'Gold', type: 'text', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldBillNumber(a) : undefined) },
    { key: 'gold_bill_date', label: 'Bill Date', group: 'Gold', type: 'date', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldBillDate(a) : undefined) },
    { key: 'gold_count', label: 'Pieces', group: 'Gold', type: 'number', defaultHidden: true, total: true, get: (a) => (a.asset_type === 'gold' ? goldCount(a) : undefined) },
    { key: 'gold_purity', label: 'Purity', group: 'Gold', type: 'text', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldPurity(a) : undefined) },
    { key: 'gold_weight', label: 'Weight (g)', group: 'Gold', type: 'number', defaultHidden: true, total: true, get: (a) => (a.asset_type === 'gold' && goldGrams(a) ? goldGrams(a).toFixed(2) : undefined) },
    { key: 'gold_sovereigns', label: 'Sovereign', group: 'Gold', type: 'number', defaultHidden: true, total: true, get: (a) => (a.asset_type === 'gold' && goldGrams(a) ? gramsToSovereigns(goldGrams(a)).toFixed(3) : undefined) },
    { key: 'gold_value', label: 'Purchased Value', group: 'Gold', type: 'money', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldValue(a) || undefined : undefined) },
    {
      key: 'gold_current_value',
      label: 'Current Gold Value',
      group: 'Gold',
      type: 'money',
      defaultHidden: true,
      // Live valuation: grams × the current per-gram price entered on the toolbar.
      get: (a) =>
        a.asset_type === 'gold' && goldPricePerGram > 0 && goldGrams(a)
          ? Math.round(goldGrams(a) * goldPricePerGram)
          : undefined,
    },
    { key: 'gold_located_at', label: 'Located At', group: 'Gold', type: 'text', defaultHidden: true, get: (a) => (a.asset_type === 'gold' ? goldLocatedAt(a) : undefined) },
    // Vehicle
    { key: 'veh_reg', label: 'Reg. Number', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'registration_number') },
    { key: 'veh_make', label: 'Make', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'make') },
    { key: 'veh_model', label: 'Model', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'model') },
    { key: 'veh_year', label: 'Year', group: 'Vehicle', type: 'number', defaultHidden: true, get: (a) => meta(a, 'year') },
    { key: 'veh_fuel', label: 'Fuel', group: 'Vehicle', type: 'label', defaultHidden: true, get: (a) => meta(a, 'fuel_type') },
    { key: 'veh_key_status', label: 'Key Status', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'key_status') },
    { key: 'veh_transfer_form', label: 'Transfer Form', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'transfer_form') },
    { key: 'veh_hypothecation', label: 'Hypothecation', group: 'Vehicle', type: 'text', defaultHidden: true, get: (a) => meta(a, 'hypothecation') },
    // Meta
    { key: 'notes', label: 'Remarks', group: 'Meta', type: 'text', defaultHidden: true, get: (a) => a.notes },
    { key: 'created_at', label: 'Added', group: 'Meta', type: 'date', defaultHidden: true, get: (a) => a.created_at },
  ];

  const filters: ReportFilter<Asset>[] = [
    {
      key: 'owner',
      label: 'Owner',
      kind: 'select',
      primary: true,
      options: distinctOptions(assets, (a) => getAssetOwner(a), (v) => v),
      get: (a) => getAssetOwner(a),
    },
    {
      key: 'asset_type',
      label: 'Type',
      kind: 'select',
      primary: true,
      options: optionsFrom(ASSET_TYPES),
      get: (a) => a.asset_type,
    },
    {
      key: 'status',
      label: 'Status',
      kind: 'select',
      primary: true,
      options: distinctOptions(assets, (a) => a.status),
      get: (a) => a.status,
    },
    {
      key: 'gold_category',
      label: 'Gold Category',
      kind: 'select',
      options: distinctOptions(
        assets.filter((a) => a.asset_type === 'gold'),
        (a) => goldCategory(a),
      ),
      get: (a) => (a.asset_type === 'gold' ? goldCategory(a) : undefined),
    },
    {
      key: 'located_at',
      label: 'Located At',
      kind: 'select',
      options: distinctOptions(
        assets.filter((a) => a.asset_type === 'gold'),
        (a) => goldLocatedAt(a),
        (v) => v,
      ),
      get: (a) => (a.asset_type === 'gold' ? goldLocatedAt(a) : undefined),
    },
    { key: 'acquisition_date', label: 'Acquired', kind: 'dateRange', get: (a) => a.acquisition_date ?? undefined },
    { key: 'created_at', label: 'Added', kind: 'dateRange', get: (a) => a.created_at },
  ];

  return {
    id: 'properties',
    label: 'Properties',
    icon: Building2,
    rows: assets,
    columns,
    filters,
    rowKey: (a) => a.id,
    search: (a) => `${a.name} ${a.description ?? ''} ${getAssetOwner(a) ?? ''}`,
  };
}

// ── Taxes ─────────────────────────────────────────────────────────────────────
function taxesDataset(taxes: Tax[], linkedName: LinkedNameFn): ReportDataset<Tax> {
  const columns: ReportColumn<Tax>[] = [
    { key: 'name', label: 'Name', group: 'Core', type: 'text', get: (t) => t.name || t.description },
    { key: 'description', label: 'Description', group: 'Core', type: 'text', get: (t) => t.description },
    { key: 'tax_number', label: 'Tax Number', group: 'Core', type: 'text', get: (t) => t.tax_number },
    { key: 'tax_type', label: 'Type', group: 'Core', type: 'label', get: (t) => t.tax_type },
    { key: 'assessment_year', label: 'Assessment Year', group: 'Core', type: 'text', get: (t) => t.assessment_year },
    { key: 'total_amount', label: 'Amount', group: 'Core', type: 'money', get: (t) => t.total_amount || undefined },
    { key: 'due_date', label: 'Due Date', group: 'Core', type: 'date', get: (t) => t.due_date },
    { key: 'status', label: 'Status', group: 'Core', type: 'status', get: (t) => t.status },
    { key: 'paid_date', label: 'Paid Date', group: 'Detail', type: 'date', defaultHidden: true, get: (t) => t.paid_date ?? undefined },
    { key: 'linked_to', label: 'Linked To', group: 'Detail', type: 'text', get: (t) => linkedName(t.linked_asset_id ?? t.individual_id) },
    { key: 'notes', label: 'Remarks', group: 'Detail', type: 'text', defaultHidden: true, get: (t) => t.notes },
    { key: 'created_at', label: 'Added', group: 'Meta', type: 'date', defaultHidden: true, get: (t) => t.created_at },
  ];

  const filters: ReportFilter<Tax>[] = [
    { key: 'tax_type', label: 'Type', kind: 'select', primary: true, options: optionsFrom(TAX_TYPES), get: (t) => t.tax_type },
    { key: 'status', label: 'Status', kind: 'select', primary: true, options: distinctOptions(taxes, (t) => t.status), get: (t) => t.status },
    {
      key: 'assessment_year',
      label: 'Assessment Year',
      kind: 'select',
      primary: true,
      options: distinctOptions(taxes, (t) => t.assessment_year, (v) => v),
      get: (t) => t.assessment_year,
    },
    { key: 'due_date', label: 'Due date', kind: 'dateRange', get: (t) => t.due_date },
    { key: 'total_amount', label: 'Amount', kind: 'numberRange', get: (t) => t.total_amount },
  ];

  return {
    id: 'taxes',
    label: 'Taxes',
    icon: Landmark,
    rows: taxes,
    columns,
    filters,
    rowKey: (t) => t.id,
    search: (t) =>
      `${t.name ?? ''} ${t.description} ${t.tax_number ?? ''} ${linkedName(t.linked_asset_id ?? t.individual_id) ?? ''}`,
  };
}

// ── Insurance ─────────────────────────────────────────────────────────────────
function insuranceDataset(
  policies: InsurancePolicy[],
  linkedName: LinkedNameFn,
): ReportDataset<InsurancePolicy> {
  const columns: ReportColumn<InsurancePolicy>[] = [
    { key: 'name', label: 'Name', group: 'Core', type: 'text', get: (p) => p.name || p.provider },
    { key: 'policy_number', label: 'Policy Number', group: 'Core', type: 'text', get: (p) => p.policy_number },
    { key: 'provider', label: 'Provider', group: 'Core', type: 'text', get: (p) => p.provider },
    { key: 'insurance_type', label: 'Type', group: 'Core', type: 'label', get: (p) => p.insurance_type },
    { key: 'sum_insured', label: 'Sum Insured', group: 'Core', type: 'money', get: (p) => p.sum_insured ?? undefined },
    { key: 'premium_amount', label: 'Premium', group: 'Core', type: 'money', get: (p) => p.premium_amount || undefined },
    { key: 'premium_frequency', label: 'Frequency', group: 'Core', type: 'label', get: (p) => canonicalEnum(p.premium_frequency) },
    { key: 'next_premium_date', label: 'Next Premium', group: 'Core', type: 'date', get: (p) => p.next_premium_date },
    { key: 'status', label: 'Status', group: 'Core', type: 'status', get: (p) => canonicalEnum(p.status) },
    { key: 'linked_to', label: 'Linked To', group: 'Core', type: 'text', get: (p) => linkedName(p.linked_asset_id ?? p.linked_individual_id) },
    { key: 'start_date', label: 'Start Date', group: 'Detail', type: 'date', defaultHidden: true, get: (p) => p.start_date },
    { key: 'end_date', label: 'End Date', group: 'Detail', type: 'date', defaultHidden: true, get: (p) => p.end_date },
    { key: 'nominee', label: 'Nominee', group: 'Detail', type: 'text', defaultHidden: true, get: (p) => p.nominee },
    { key: 'notes', label: 'Remarks', group: 'Detail', type: 'text', defaultHidden: true, get: (p) => p.notes },
  ];

  const filters: ReportFilter<InsurancePolicy>[] = [
    { key: 'insurance_type', label: 'Type', kind: 'select', primary: true, options: optionsFrom(INSURANCE_TYPES), get: (p) => p.insurance_type },
    { key: 'status', label: 'Status', kind: 'select', primary: true, options: distinctOptions(policies, (p) => canonicalEnum(p.status)), get: (p) => canonicalEnum(p.status) },
    { key: 'premium_frequency', label: 'Frequency', kind: 'select', primary: true, options: distinctOptions(policies, (p) => canonicalEnum(p.premium_frequency)), get: (p) => canonicalEnum(p.premium_frequency) },
    { key: 'next_premium_date', label: 'Next premium', kind: 'dateRange', get: (p) => p.next_premium_date },
    { key: 'premium_amount', label: 'Premium', kind: 'numberRange', get: (p) => p.premium_amount },
  ];

  return {
    id: 'insurance',
    label: 'Insurance',
    icon: Shield,
    rows: policies,
    columns,
    filters,
    rowKey: (p) => p.id,
    search: (p) =>
      `${p.name ?? ''} ${p.provider} ${p.policy_number} ${p.nominee ?? ''} ${linkedName(p.linked_asset_id ?? p.linked_individual_id) ?? ''}`,
  };
}

// ── Bills ─────────────────────────────────────────────────────────────────────
function billsDataset(bills: Bill[]): ReportDataset<Bill> {
  const columns: ReportColumn<Bill>[] = [
    { key: 'name', label: 'Name', group: 'Core', type: 'text', get: (b) => b.name || b.provider_name },
    { key: 'provider_name', label: 'Provider', group: 'Core', type: 'text', get: (b) => b.provider_name },
    { key: 'bill_type', label: 'Type', group: 'Core', type: 'label', get: (b) => b.bill_type },
    { key: 'account_number', label: 'Account Number', group: 'Core', type: 'text', get: (b) => b.account_number },
    { key: 'billing_cycle', label: 'Billing Cycle', group: 'Core', type: 'label', get: (b) => canonicalEnum(b.billing_cycle) },
    { key: 'average_amount', label: 'Avg Amount', group: 'Core', type: 'money', get: (b) => b.average_amount || undefined },
    { key: 'next_due_date', label: 'Next Due', group: 'Core', type: 'date', get: (b) => b.next_due_date },
    { key: 'status', label: 'Status', group: 'Core', type: 'status', get: (b) => b.status },
    { key: 'auto_pay', label: 'Auto Pay', group: 'Core', type: 'bool', get: (b) => b.auto_pay },
    { key: 'notes', label: 'Remarks', group: 'Detail', type: 'text', defaultHidden: true, get: (b) => b.notes },
  ];

  const billTypeOptions = allBillCategories(bills.map((b) => b.bill_type));

  const filters: ReportFilter<Bill>[] = [
    { key: 'bill_type', label: 'Type', kind: 'select', primary: true, options: optionsFrom(billTypeOptions), get: (b) => b.bill_type },
    { key: 'status', label: 'Status', kind: 'select', primary: true, options: distinctOptions(bills, (b) => b.status), get: (b) => b.status },
    { key: 'billing_cycle', label: 'Billing Cycle', kind: 'select', primary: true, options: distinctOptions(bills, (b) => canonicalEnum(b.billing_cycle)), get: (b) => canonicalEnum(b.billing_cycle) },
    { key: 'auto_pay', label: 'Auto Pay', kind: 'bool', get: (b) => b.auto_pay },
    { key: 'next_due_date', label: 'Next due', kind: 'dateRange', get: (b) => b.next_due_date },
    { key: 'average_amount', label: 'Avg amount', kind: 'numberRange', get: (b) => b.average_amount },
  ];

  return {
    id: 'bills',
    label: 'Bills',
    icon: Receipt,
    rows: bills,
    columns,
    filters,
    rowKey: (b) => b.id,
    search: (b) => `${b.name ?? ''} ${b.provider_name} ${b.account_number ?? ''}`,
  };
}

// ── Payments ──────────────────────────────────────────────────────────────────
function paymentsDataset(payments: Payment[]): ReportDataset<Payment> {
  const columns: ReportColumn<Payment>[] = [
    { key: 'payment_date', label: 'Date', group: 'Core', type: 'date', get: (p) => p.payment_date },
    { key: 'entity_type', label: 'Category', group: 'Core', type: 'label', get: (p) => p.entity_type },
    { key: 'entity_name', label: 'Entity', group: 'Core', type: 'text', get: (p) => p.entity_name },
    { key: 'amount_paid', label: 'Amount', group: 'Core', type: 'money', get: (p) => Number(p.amount_paid) },
    { key: 'payment_method', label: 'Method', group: 'Core', type: 'label', get: (p) => canonicalEnum(p.payment_method) },
    { key: 'reference_number', label: 'Reference', group: 'Detail', type: 'text', get: (p) => p.reference_number },
    { key: 'notes', label: 'Remarks', group: 'Detail', type: 'text', defaultHidden: true, get: (p) => p.notes },
  ];

  const filters: ReportFilter<Payment>[] = [
    { key: 'entity_type', label: 'Category', kind: 'select', primary: true, options: distinctOptions(payments, (p) => p.entity_type), get: (p) => p.entity_type },
    { key: 'payment_method', label: 'Method', kind: 'select', primary: true, options: distinctOptions(payments, (p) => canonicalEnum(p.payment_method)), get: (p) => canonicalEnum(p.payment_method) },
    { key: 'payment_date', label: 'Date', kind: 'dateRange', get: (p) => p.payment_date },
    { key: 'amount_paid', label: 'Amount', kind: 'numberRange', get: (p) => Number(p.amount_paid) },
  ];

  return {
    id: 'payments',
    label: 'Payments',
    icon: Wallet,
    rows: payments,
    columns,
    filters,
    rowKey: (p) => p.id,
    search: (p) => `${p.entity_name ?? ''} ${p.reference_number ?? ''}`,
  };
}

// ── Companies ─────────────────────────────────────────────────────────────────
function companiesDataset(companies: Company[]): ReportDataset<Company> {
  const primaryBank = (c: Company) =>
    (c.bank_accounts ?? []).find((b) => b.is_primary) ?? (c.bank_accounts ?? [])[0];

  const columns: ReportColumn<Company>[] = [
    { key: 'legal_name', label: 'Legal Name', group: 'Core', type: 'text', get: (c) => c.legal_name },
    { key: 'trade_name', label: 'Trade Name', group: 'Core', type: 'text', get: (c) => c.trade_name },
    { key: 'company_type', label: 'Type', group: 'Core', type: 'label', get: (c) => c.company_type },
    { key: 'status', label: 'Status', group: 'Core', type: 'status', get: (c) => c.status },
    { key: 'industry', label: 'Industry', group: 'Core', type: 'text', get: (c) => c.industry },
    { key: 'incorporation_date', label: 'Incorporated', group: 'Incorporation', type: 'date', get: (c) => c.incorporation_date },
    { key: 'incorporation_state', label: 'State', group: 'Incorporation', type: 'text', get: (c) => c.incorporation_state },
    { key: 'cin', label: 'CIN', group: 'Registrations', type: 'text', get: (c) => c.cin },
    { key: 'llpin', label: 'LLPIN', group: 'Registrations', type: 'text', defaultHidden: true, get: (c) => c.llpin },
    { key: 'pan_number', label: 'PAN', group: 'Registrations', type: 'text', get: (c) => c.pan_number },
    { key: 'tan_number', label: 'TAN', group: 'Registrations', type: 'text', get: (c) => c.tan_number },
    { key: 'gstin', label: 'GSTIN', group: 'Registrations', type: 'text', get: (c) => c.gstin },
    { key: 'gst_state', label: 'GST State', group: 'Registrations', type: 'text', get: (c) => gstStateName(c.gstin_state_code) },
    { key: 'income_tax_ward', label: 'IT Ward', group: 'Registrations', type: 'text', defaultHidden: true, get: (c) => c.income_tax_ward },
    { key: 'foreign_jurisdiction', label: 'Foreign Jurisdiction', group: 'Foreign', type: 'text', defaultHidden: true, get: (c) => c.foreign_jurisdiction },
    { key: 'foreign_registration_number', label: 'Foreign Reg. No.', group: 'Foreign', type: 'text', defaultHidden: true, get: (c) => c.foreign_registration_number },
    { key: 'foreign_registration_expiry', label: 'Foreign Reg. Expiry', group: 'Foreign', type: 'date', defaultHidden: true, get: (c) => c.foreign_registration_expiry },
    { key: 'other_registrations', label: 'Other Registrations', group: 'Registrations', type: 'text', defaultHidden: true, get: (c) => (c.other_registrations ?? []).map((r) => r.name).join(', ') },
    { key: 'authorized_capital', label: 'Authorized Capital', group: 'Capital', type: 'money', get: (c) => (c.authorized_capital != null ? Number(c.authorized_capital) : undefined) },
    { key: 'paid_up_capital', label: 'Paid-up Capital', group: 'Capital', type: 'money', get: (c) => (c.paid_up_capital != null ? Number(c.paid_up_capital) : undefined) },
    { key: 'auditor_name', label: 'Auditor', group: 'Audit', type: 'text', get: (c) => c.auditor_name },
    { key: 'auditor_firm_number', label: 'ICAI FRN', group: 'Audit', type: 'text', defaultHidden: true, get: (c) => c.auditor_firm_number },
    { key: 'financial_year_end', label: 'FY End', group: 'Audit', type: 'text', get: (c) => c.financial_year_end },
    { key: 'active_director_count', label: 'Directors', group: 'Counts', type: 'number', total: true, get: (c) => c.active_director_count },
    { key: 'document_count', label: 'Documents', group: 'Counts', type: 'number', total: true, get: (c) => c.document_count },
    { key: 'asset_count', label: 'Properties', group: 'Counts', type: 'number', total: true, get: (c) => c.asset_count },
    { key: 'expiring_docs_count', label: 'Expiring', group: 'Counts', type: 'number', total: true, get: (c) => c.expiring_docs_count },
    { key: 'has_compliance_gap', label: 'Compliance Gap', group: 'Counts', type: 'bool', get: (c) => c.has_compliance_gap },
    { key: 'phone_number', label: 'Phone', group: 'Contact', type: 'text', defaultHidden: true, get: (c) => c.phone_number },
    { key: 'email', label: 'Email', group: 'Contact', type: 'text', defaultHidden: true, get: (c) => c.email },
    { key: 'website', label: 'Website', group: 'Contact', type: 'text', defaultHidden: true, get: (c) => c.website },
    { key: 'registered_address', label: 'Registered Address', group: 'Contact', type: 'text', defaultHidden: true, get: (c) => c.registered_address },
    { key: 'bank_name', label: 'Primary Bank', group: 'Banking', type: 'text', defaultHidden: true, get: (c) => primaryBank(c)?.bank_name },
    { key: 'bank_ifsc', label: 'Primary IFSC', group: 'Banking', type: 'text', defaultHidden: true, get: (c) => primaryBank(c)?.ifsc_code },
    { key: 'notes', label: 'Remarks', group: 'Detail', type: 'text', defaultHidden: true, get: (c) => c.notes },
  ];

  const filters: ReportFilter<Company>[] = [
    { key: 'company_type', label: 'Type', kind: 'select', primary: true, options: distinctOptions(companies, (c) => c.company_type), get: (c) => c.company_type },
    { key: 'status', label: 'Status', kind: 'select', primary: true, options: distinctOptions(companies, (c) => c.status), get: (c) => c.status },
    { key: 'industry', label: 'Industry', kind: 'select', primary: true, options: distinctOptions(companies, (c) => c.industry), get: (c) => c.industry },
    { key: 'has_compliance_gap', label: 'Compliance gap', kind: 'bool', get: (c) => c.has_compliance_gap },
    { key: 'incorporation_date', label: 'Incorporated', kind: 'dateRange', get: (c) => c.incorporation_date },
    { key: 'paid_up_capital', label: 'Paid-up capital', kind: 'numberRange', get: (c) => (c.paid_up_capital != null ? Number(c.paid_up_capital) : undefined) },
  ];

  return {
    id: 'companies',
    label: 'Companies',
    icon: Briefcase,
    rows: companies,
    columns,
    filters,
    rowKey: (c) => c.id,
    search: (c) => `${c.legal_name} ${c.trade_name ?? ''} ${c.cin ?? ''} ${c.gstin ?? ''}`,
  };
}

/** Build every dataset from the currently-loaded data. */
export function buildDatasets(data: ReportData, goldPricePerGram = 0): ReportDataset[] {
  return [
    propertiesDataset(data.assets, goldPricePerGram),
    companiesDataset(data.companies ?? []),
    taxesDataset(data.taxes, data.linkedName),
    insuranceDataset(data.insurance, data.linkedName),
    billsDataset(data.bills),
    paymentsDataset(data.payments),
  ] as unknown as ReportDataset[];
}
