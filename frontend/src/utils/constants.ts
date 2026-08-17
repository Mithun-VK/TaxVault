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

// ── Company module ───────────────────────────────────────────────────────────
// Mirrors CompanyType / CompanyStatus / CompanyDocumentCategory in the backend
// (app/models/company.py, app/models/company_document.py). Keep in sync — the
// API rejects any value not in its own enum.

export const COMPANY_TYPES: Option[] = [
  { value: 'private_limited', label: 'Private Limited (Pvt Ltd)' },
  { value: 'public_limited', label: 'Public Limited (Ltd)' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
  { value: 'partnership', label: 'Partnership Firm' },
  { value: 'proprietorship', label: 'Sole Proprietorship' },
  { value: 'trust', label: 'Charitable / Religious Trust' },
  { value: 'section_8', label: 'Section 8 Company (NGO)' },
  { value: 'one_person', label: 'One Person Company (OPC)' },
  { value: 'foreign_subsidiary', label: 'Foreign Subsidiary' },
  { value: 'branch_office', label: 'Branch / Liaison Office' },
  { value: 'other', label: 'Other' },
];

export const COMPANY_STATUSES: Option[] = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'dormant', label: 'Dormant', color: 'amber' },
  { value: 'under_winding', label: 'Under Winding Up', color: 'red' },
  { value: 'struck_off', label: 'Struck Off', color: 'slate' },
  { value: 'dissolved', label: 'Dissolved', color: 'slate' },
];

/** Document-category groups, in the order the Documents tab stacks them. */
export const COMPANY_DOC_GROUP_LABELS: Record<string, string> = {
  incorporation: 'Incorporation',
  tax: 'Tax Registrations',
  filings: 'Annual Filings',
  licenses: 'Licenses & Renewals',
  foreign: 'Foreign Entity',
  banking: 'Banking',
  hr: 'HR & Payroll',
  other: 'Other',
};

export const COMPANY_DOCUMENT_CATEGORIES: Option[] = [
  { value: 'coi', label: 'Certificate of Incorporation', group: 'incorporation' },
  { value: 'moa', label: 'Memorandum of Association', group: 'incorporation' },
  { value: 'aoa', label: 'Articles of Association', group: 'incorporation' },
  { value: 'llp_agreement', label: 'LLP Agreement', group: 'incorporation' },
  { value: 'partnership_deed', label: 'Partnership Deed', group: 'incorporation' },
  { value: 'trust_deed', label: 'Trust Deed', group: 'incorporation' },
  { value: 'pan_card', label: 'Company PAN Card', group: 'tax' },
  { value: 'gst_certificate', label: 'GST Registration Certificate', group: 'tax' },
  { value: 'tan_allotment', label: 'TAN Allotment Letter', group: 'tax' },
  { value: 'annual_return', label: 'ROC Annual Return', group: 'filings' },
  { value: 'financial_stmt', label: 'Audited Financial Statements', group: 'filings' },
  { value: 'directors_report', label: 'Directors Report', group: 'filings' },
  { value: 'audit_report', label: 'Auditor Report', group: 'filings' },
  { value: 'itr', label: 'Income Tax Return', group: 'filings' },
  { value: 'gst_return', label: 'GST Annual Return (GSTR-9)', group: 'filings' },
  { value: 'tds_certificate', label: 'TDS Certificate', group: 'filings' },
  { value: 'trade_license', label: 'Trade License', group: 'licenses' },
  { value: 'fssai_license', label: 'FSSAI Food License', group: 'licenses' },
  { value: 'import_export', label: 'IEC Certificate', group: 'licenses' },
  { value: 'spice_board', label: 'Spice Board Registration', group: 'licenses' },
  { value: 'aepc_cert', label: 'AEPC Registration', group: 'licenses' },
  { value: 'textiles_cert', label: 'Textiles Committee Certificate', group: 'licenses' },
  { value: 'jafza_license', label: 'JAFZA Trade License', group: 'foreign' },
  { value: 'foreign_reg', label: 'Foreign Registration', group: 'foreign' },
  { value: 'vat_certificate', label: 'UAE VAT Registration', group: 'foreign' },
  { value: 'bank_statement', label: 'Bank Statement', group: 'banking' },
  { value: 'cancelled_cheque', label: 'Cancelled Cheque', group: 'banking' },
  { value: 'epf_certificate', label: 'EPF Registration', group: 'hr' },
  { value: 'esi_certificate', label: 'ESI Registration', group: 'hr' },
  { value: 'pt_certificate', label: 'Professional Tax Registration', group: 'hr' },
  { value: 'board_resolution', label: 'Board Resolution', group: 'other' },
  { value: 'power_of_attorney', label: 'Power of Attorney', group: 'other' },
  { value: 'other', label: 'Other Document', group: 'other' },
];

/** Categories that recur each financial year — these prompt for an FY. */
export const COMPANY_FILING_CATEGORIES = [
  'annual_return',
  'financial_stmt',
  'directors_report',
  'audit_report',
  'itr',
  'gst_return',
  'tds_certificate',
] as const;

export const DIRECTOR_DESIGNATIONS = [
  'Director',
  'Managing Director',
  'Whole-time Director',
  'Independent Director',
  'Nominee Director',
  'Partner',
  'Designated Partner',
  'Trustee',
  'Managing Trustee',
  'Secretary',
] as const;

export const ACCOUNT_TYPES: Option[] = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'cc', label: 'Cash Credit (CC)' },
  { value: 'od', label: 'Overdraft (OD)' },
];

export const FINANCIAL_YEAR_ENDS: Option[] = [
  { value: '03-31', label: 'March 31 (Indian standard)' },
  { value: '09-30', label: 'September 30 (UAE aligned)' },
  { value: '12-31', label: 'December 31 (Calendar year)' },
  { value: '06-30', label: 'June 30' },
];

/** GSTIN's first two digits → state. Lets the UI show "33 → Tamil Nadu". */
export const GST_STATE_NAMES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

export const gstStateName = (code?: string): string | undefined =>
  code ? GST_STATE_NAMES[code] : undefined;

/** Typeahead suggestions for the bank-account form. */
export const BANK_NAME_SUGGESTIONS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India',
  'Indian Bank', 'Indian Overseas Bank', 'Kotak Mahindra Bank', 'IndusInd Bank',
  'Yes Bank', 'IDFC First Bank', 'Federal Bank', 'South Indian Bank',
  'Karur Vysya Bank', 'Tamilnad Mercantile Bank', 'City Union Bank',
] as const;

/**
 * The statutory calendar the Compliance tab is built from.
 *
 * `day` is the day of the month a monthly filing is due; annual rows use
 * `month`/`day` as a fixed calendar date, except `fyOffsetMonths`, which counts
 * months from the company's own financial-year end (so a Sept-30 FY shifts the
 * whole annual set with it). `category` ties a row to the document that proves
 * it was filed.
 */
export interface ComplianceRule {
  id: string;
  label: string;
  frequency: 'monthly' | 'quarterly' | 'annual';
  /** Day of month the filing is due. */
  day: number;
  /** Fixed month (1-12) for annual rows pinned to the calendar. */
  month?: number;
  /** Months after the company's FY end, for annual rows that follow it. */
  fyOffsetMonths?: number;
  /** Document category that satisfies this filing. */
  category?: string;
  /** Only applies when the company is registered for this. */
  requires?: 'gstin' | 'tan';
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  { id: 'gst_monthly', label: 'GST Return (GSTR-3B)', frequency: 'monthly', day: 11, requires: 'gstin' },
  { id: 'tds_payable', label: 'TDS Payable', frequency: 'monthly', day: 7, requires: 'tan' },
  { id: 'epf_return', label: 'EPF Return', frequency: 'monthly', day: 14, category: 'epf_certificate' },
  { id: 'esi_return', label: 'ESI Return', frequency: 'monthly', day: 15, category: 'esi_certificate' },
  { id: 'tds_quarterly', label: 'TDS Return (Quarterly)', frequency: 'quarterly', day: 31, category: 'tds_certificate', requires: 'tan' },
  // Annual due dates hang off the company's own FY end, so a Sept-30 year
  // (JAFZA) shifts the whole set. Offsets reproduce the Indian statutory
  // calendar for a March-31 year: ITR 30 Sep, ROC 12 Oct, AOC-4 30 Oct,
  // GSTR-9 31 Dec.
  { id: 'itr', label: 'Company Income Tax Return', frequency: 'annual', day: 30, fyOffsetMonths: 6, category: 'itr' },
  { id: 'roc_annual', label: 'ROC Annual Return', frequency: 'annual', day: 12, fyOffsetMonths: 7, category: 'annual_return' },
  { id: 'financials', label: 'Audited Financial Statements', frequency: 'annual', day: 30, fyOffsetMonths: 7, category: 'financial_stmt' },
  { id: 'gstr9', label: 'GST Annual Return (GSTR-9)', frequency: 'annual', day: 31, fyOffsetMonths: 9, category: 'gst_return', requires: 'gstin' },
];

/** Company type → accent colour for the card's left border (mirrors the asset tiers). */
export const COMPANY_TYPE_COLOR: Record<string, string> = {
  private_limited: '#1A3C6E', // navy
  public_limited: '#1A3C6E',
  llp: '#0369A1', // blue
  partnership: '#0369A1',
  proprietorship: '#0F6E56', // teal
  trust: '#7C3AED', // purple
  section_8: '#7C3AED',
  one_person: '#0F6E56',
  foreign_subsidiary: '#9D174D', // rose
  branch_office: '#9D174D',
  other: '#475569', // slate
};

export const ALERT_CHANNELS: Option<AlertChannel>[] = [
  { label: 'WhatsApp', value: 'whatsapp', color: '#25D366' },
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
