import {
  Landmark,
  Wheat,
  Car,
  Building2,
  Boxes,
  Phone,
  Zap,
  Wifi,
  Droplets,
  Tv,
  CreditCard,
  Receipt,
  HeartPulse,
  Shield,
  ShieldCheck,
  Home,
  Banknote,
  Smartphone,
  Building,
  Wallet,
  FileText,
  Plane,
  Landmark as TaxIcon,
  Gem,
  type LucideIcon,
} from 'lucide-react';
import type {
  AssetType,
  BillType,
  BillingCycle,
  TaxType,
  TaxStatus,
  InsuranceType,
  PremiumFrequency,
  PaymentMethod,
  DocumentCategory,
  AlertChannel,
  AlertDays,
} from '@/types';

export interface Option<T extends string = string> {
  label: string;
  value: T;
  color?: string;
  icon?: LucideIcon;
  group?: string;
}

/** Family members who can own assets. Matches the seeded Individual profiles
 * and the imported client data's `owner_name` values. */
export const ASSET_OWNERS = [
  'TAIG FASHION PROFILES',
  'Inigo Irudayaraj',
  'Felci Rajam',
  'Jesurajan',
  'Allwyn Tony',
] as const;
export type AssetOwner = (typeof ASSET_OWNERS)[number];

export const ASSET_TYPES: Option<AssetType>[] = [
  // Immovable
  { label: 'Residential Building', value: 'residential_building', color: '#0369A1', icon: Home, group: 'immovable' },
  { label: 'Commercial Building', value: 'commercial_building', color: '#B45309', icon: Building2, group: 'immovable' },
  { label: 'Agricultural Land', value: 'agricultural_land', color: '#15803D', icon: Wheat, group: 'immovable' },
  { label: 'Non-Agricultural Land', value: 'non_agricultural_land', color: '#7C3AED', icon: Landmark, group: 'immovable' },
  // Movable
  { label: 'Vehicle', value: 'vehicle', color: '#9D174D', icon: Car, group: 'movable' },
  { label: 'Gold', value: 'gold', color: '#C8860D', icon: Gem, group: 'movable' },
  { label: 'Other', value: 'other', color: '#475569', icon: Boxes, group: 'movable' },
];

export const GOLD_FORMS: Option[] = [
  { label: 'Gold Coins', value: 'coin' },
  { label: 'Jewellery', value: 'jewellery' },
  { label: 'Gold Bar', value: 'bar' },
  { label: 'Gold ETF / SGB', value: 'etf' },
];

/** Built-in jewellery categories the Gold vault groups items by. Users can add
 * their own (persisted per browser). `other` is the catch-all bucket for coins,
 * bars and anything without a category set. */
export const GOLD_CATEGORIES: Option[] = [
  { label: 'Chain', value: 'chain' },
  { label: 'Stud', value: 'stud' },
  { label: 'Necklace', value: 'necklace' },
  { label: 'Ring', value: 'ring' },
  { label: 'Bangles', value: 'bangles' },
  { label: 'Aaram', value: 'aaram' },
  { label: 'Other', value: 'other' },
];

/** One sovereign of gold is reckoned as 8 grams here. */
export const GRAMS_PER_SOVEREIGN = 8;

export function gramsToSovereigns(grams: number): number {
  return grams / GRAMS_PER_SOVEREIGN;
}

export const GOLD_PURITIES: Option[] = [
  { label: '24K', value: '24K' },
  { label: '22K', value: '22K' },
  { label: '18K', value: '18K' },
  { label: 'Other', value: 'other' },
];

export const VEHICLE_TYPES: Option[] = [
  { label: 'Car', value: 'car' },
  { label: 'Two Wheeler', value: 'two_wheeler' },
  { label: 'Truck / Commercial', value: 'truck' },
  { label: 'Tractor', value: 'tractor' },
  { label: 'Other', value: 'other' },
];

export const FUEL_TYPES: Option[] = [
  { label: 'Petrol', value: 'petrol' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'Electric', value: 'electric' },
  { label: 'CNG', value: 'cng' },
];

export const VISA_TYPES: Option[] = [
  { label: 'Tourist', value: 'Tourist' },
  { label: 'Residence', value: 'Residence' },
  { label: 'Work', value: 'Work' },
  { label: 'Student', value: 'Student' },
  { label: 'Transit', value: 'Transit' },
  { label: 'Other', value: 'Other' },
];

export const RELATIONSHIP_OPTIONS: Option[] = [
  { label: 'Self', value: 'Self' },
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Son', value: 'Son' },
  { label: 'Daughter', value: 'Daughter' },
  { label: 'Father', value: 'Father' },
  { label: 'Mother', value: 'Mother' },
  { label: 'Family Member', value: 'Family Member' },
  { label: 'Other', value: 'Other' },
];

/** Built-in bill categories. Users can add their own — see customBillTypes(). */
export const BILL_TYPES: Option<BillType>[] = [
  { label: 'Phone', value: 'phone', color: '#7C3AED', icon: Phone },
  { label: 'Electricity', value: 'electricity', color: '#D97706', icon: Zap },
  { label: 'WiFi / Broadband', value: 'wifi', color: '#0369A1', icon: Wifi },
  { label: 'DTH / Cable', value: 'dth', color: '#7C3AED', icon: Tv },
  { label: 'Dubai', value: 'dubai', color: '#C8860D', icon: Plane },
  { label: 'Other', value: 'other', color: '#475569', icon: Receipt },
];

/** Colour + icon used for user-created categories. */
export const CUSTOM_BILL_COLOR = '#475569';
export const CUSTOM_BILL_ICON = Receipt;

/** Turn a typed category name into a stable slug ("Cable TV" -> "cable_tv"). */
export function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Every category to show: the built-ins plus any custom slug already used by a
 * bill, so user-created categories appear without needing a lookup table.
 */
export function allBillCategories(usedTypes: string[]): Option<BillType>[] {
  const known = new Set(BILL_TYPES.map((t) => t.value));
  const custom = [...new Set(usedTypes)]
    .filter((t) => t && !known.has(t))
    .sort()
    .map<Option<BillType>>((value) => ({
      label: value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      value,
      color: CUSTOM_BILL_COLOR,
      icon: CUSTOM_BILL_ICON,
    }));
  return [...BILL_TYPES, ...custom];
}

export const CUSTOM_INSURANCE_COLOR = '#475569';
export const CUSTOM_INSURANCE_ICON = Shield;

/** Title-case a category slug (e.g. `travel_cover` → `Travel Cover`). */
function prettifySlug(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Every insurance category to show: the built-ins plus any custom slug the user
 * created (`customLabels`, from localStorage) or already used on a policy
 * (`usedTypes`, from data), so user-created categories appear on the Insurance
 * page — not just inside the form's picker. Custom labels win over a prettified
 * slug; data-derived customs cover policies created on another device.
 */
export function allInsuranceCategories(
  usedTypes: string[],
  customLabels: { value: string; label: string }[] = [],
): Option<InsuranceType>[] {
  const known = new Set<string>(INSURANCE_TYPES.map((t) => t.value));
  const labelFor = new Map(customLabels.map((c) => [c.value, c.label]));
  const seen = new Set<string>();
  const custom: Option<InsuranceType>[] = [];
  for (const value of [...customLabels.map((c) => c.value), ...usedTypes]) {
    if (!value || known.has(value) || seen.has(value)) continue;
    seen.add(value);
    custom.push({
      label: labelFor.get(value) ?? prettifySlug(value),
      value: value as InsuranceType,
      color: CUSTOM_INSURANCE_COLOR,
      icon: CUSTOM_INSURANCE_ICON,
    });
  }
  return [...INSURANCE_TYPES, ...custom];
}

export const TAX_TYPES: Option<TaxType>[] = [
  { label: 'Property Tax', value: 'property_tax', color: '#0369A1', icon: Home },
  { label: 'Land Tax', value: 'land_tax', color: '#7C3AED', icon: Landmark },
  { label: 'Water Tax', value: 'water_tax', color: '#0891B2', icon: Droplets },
  { label: 'Professional Tax', value: 'professional_tax', color: '#475569', icon: Banknote },
  { label: 'Income Tax', value: 'income_tax', color: '#1A3C6E', icon: TaxIcon },
  { label: 'GST', value: 'gst', color: '#0F6E56', icon: Receipt },
  { label: 'Other', value: 'other', color: '#475569', icon: FileText },
];

export const TAX_STATUSES: Option<TaxStatus>[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Exempt', value: 'exempt' },
];

export const INSURANCE_TYPES: Option<InsuranceType>[] = [
  { label: 'Life', value: 'life', color: '#1A3C6E', icon: Shield },
  { label: 'Term', value: 'term', color: '#0F6E56', icon: ShieldCheck },
  { label: 'Health', value: 'health', color: '#DC2626', icon: HeartPulse },
  { label: 'Medical', value: 'medical', color: '#DC2626', icon: HeartPulse },
  { label: 'Vehicle', value: 'vehicle', color: '#9D174D', icon: Car },
  { label: 'Property', value: 'property', color: '#0369A1', icon: Building },
  { label: 'Other', value: 'other', color: '#475569', icon: Shield },
];

export const PREMIUM_FREQUENCIES: Option<PremiumFrequency>[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Half-Yearly', value: 'half_yearly' },
  { label: 'Yearly', value: 'yearly' },
];

export const BILLING_CYCLES: Option<BillingCycle>[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Bi-Monthly', value: 'bimonthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annual', value: 'annual' },
];

export const PAYMENT_METHODS: Option<PaymentMethod>[] = [
  { label: 'UPI', value: 'upi', icon: Smartphone },
  { label: 'Net Banking', value: 'net_banking', icon: Building2 },
  { label: 'Credit Card', value: 'credit_card', icon: CreditCard },
  { label: 'Debit Card', value: 'debit_card', icon: CreditCard },
  { label: 'Cash', value: 'cash', icon: Banknote },
  { label: 'Cheque', value: 'cheque', icon: FileText },
  { label: 'Auto Debit', value: 'auto_debit', icon: Wallet },
];

export const DOCUMENT_GROUP_LABELS: Record<string, string> = {
  property: 'Property',
  vehicle: 'Vehicle',
  gold: 'Gold',
  tax: 'Tax',
  insurance: 'Insurance',
  bill: 'Bills',
  compliance: 'Compliance',
  other: 'Other',
};

export const DOCUMENT_CATEGORIES: Option<DocumentCategory>[] = [
  // Property documents — canonical checklist (see utils/propertyDocs.ts)
  { value: 'patta', label: 'Patta', group: 'property', color: '#0369A1' },
  { value: 'chitta', label: 'Chitta', group: 'property', color: '#0369A1' },
  { value: 'adangal', label: 'Adangal', group: 'property', color: '#0369A1' },
  { value: 'fmb_sketch', label: 'FMB Sketch', group: 'property', color: '#0369A1' },
  { value: 'parent_document', label: 'Parent Documents', group: 'property', color: '#0369A1' },
  { value: 'encumbrance', label: 'Encumbrance Certificate (EC)', group: 'property', color: '#0369A1' },
  { value: 'a1_registration', label: 'A1 Registration', group: 'property', color: '#0369A1' },
  { value: 'sale_deed', label: 'Sale Deed', group: 'property', color: '#0369A1' },
  { value: 'fssai', label: 'FSSAI Registration', group: 'property', color: '#0369A1' },
  // Vehicle documents — canonical checklist (see utils/propertyDocs.ts)
  { value: 'rc', label: 'RC (Registration Certificate)', group: 'vehicle', color: '#0369A1' },
  { value: 'hypothecation', label: 'Hypothecation Document', group: 'vehicle', color: '#0369A1' },
  { value: 'transfer_form', label: 'Transfer Form', group: 'vehicle', color: '#0369A1' },
  // Gold documents — canonical checklist (see utils/propertyDocs.ts)
  { value: 'jewel_photo', label: 'Jewel Photo', group: 'gold', color: '#C8860D' },
  { value: 'purchase_bill', label: 'Purchase Bill', group: 'gold', color: '#C8860D' },
  // Tax documents
  { value: 'tax_receipt', label: 'Tax Payment Receipt', group: 'tax', color: '#1A3C6E' },
  { value: 'tax_notice', label: 'Tax Notice / Demand', group: 'tax', color: '#1A3C6E' },
  { value: 'assessment', label: 'Tax Assessment Order', group: 'tax', color: '#1A3C6E' },
  // Insurance documents
  { value: 'policy_doc', label: 'Insurance Policy Document', group: 'insurance', color: '#7C3AED' },
  { value: 'premium_receipt', label: 'Premium Receipt', group: 'insurance', color: '#7C3AED' },
  { value: 'claim', label: 'Claim Document', group: 'insurance', color: '#7C3AED' },
  // Bill documents
  { value: 'bill_receipt', label: 'Bill Payment Receipt', group: 'bill', color: '#D97706' },
  { value: 'bill_copy', label: 'Bill Copy', group: 'bill', color: '#D97706' },
  // Compliance
  { value: 'itr', label: 'Income Tax Return', group: 'compliance', color: '#0F6E56' },
  { value: 'gst_return', label: 'GST Return', group: 'compliance', color: '#0F6E56' },
  { value: 'tds_cert', label: 'TDS Certificate', group: 'compliance', color: '#0F6E56' },
  // Other
  { value: 'other', label: 'Other Document', group: 'other', color: '#475569' },
];

/** Bill classification (UI-only) — variable bills change month-on-month. */
export const VARIABLE_BILL_TYPES = ['electricity', 'phone'] as const;
export const FIXED_BILL_TYPES = ['wifi', 'dth', 'dubai', 'other'] as const;

export const BILL_PRIORITY: Record<string, 'variable' | 'fixed'> = {
  electricity: 'variable', // EB bill — amount changes monthly
  phone: 'variable', // mobile bill — data usage varies
  wifi: 'fixed', // fixed monthly plan
  dth: 'fixed', // DTH / cable — fixed plan
  dubai: 'fixed', // Dubai — fixed
  other: 'fixed', // EMI, etc.
};

export function billPriority(type: string): 'variable' | 'fixed' {
  return BILL_PRIORITY[type] ?? 'fixed';
}

export const ALERT_CHANNELS: Option<AlertChannel>[] = [
  { label: 'Email', value: 'email', color: '#1A3C6E' },
  { label: 'SMS', value: 'sms', color: '#0F6E56' },
  { label: 'Push', value: 'push', color: '#7C3AED' },
];

export const ALERT_DAYS: AlertDays[] = [15, 7, 1];

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];
