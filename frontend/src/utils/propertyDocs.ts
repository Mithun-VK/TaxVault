import { isPropertyType } from '@/types';
import type { AssetType, DocumentCategory, TaxDocument } from '@/types';

/** How a slot captures its "when" during upload. */
export type DocDateInput = 'date' | 'fy_half';

/**
 * Canonical property document checklist - the single source of truth for the
 * documents a property should keep on file, their order, and behaviour. Display,
 * upload, matching and status all derive from this list.
 */
export interface PropertyDocSlot {
  /** Stable slug - used as the document category and as a tag for matching. */
  key: string;
  label: string;
  category: DocumentCategory;
  /** Keyword fallbacks so papers uploaded before this checklist still match. */
  keywords: string[];
  /** Allow more than one file (Parent Documents; EC keeps its 6-monthly history). */
  multiple?: boolean;
  /** Mandatory paper - flagged prominently in the checklist when missing. */
  required?: boolean;
  /** Recurring paper with an expiry (EC = every 6 months). */
  expiryMonths?: number;
  /**
   * What the uploader asks for: a specific document date ('date') or a financial
   * year + half ('fy_half', for property/land/water tax). Undefined = no prompt.
   */
  dateInput?: DocDateInput;
  /**
   * Match documents to this slot by shared `category`. Off for slots that share
   * a category with others (property/water tax both use `tax_receipt`), where
   * only the explicit slot tag / keyword may claim a document.
   */
  matchByCategory?: boolean;
}

export const PROPERTY_DOC_SLOTS: PropertyDocSlot[] = [
  {
    key: 'sale_deed',
    label: 'Sale Deed',
    category: 'sale_deed',
    keywords: ['sale deed', 'deed'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'parent_document',
    label: 'Parent Documents',
    category: 'parent_document',
    keywords: ['parent'],
    multiple: true,
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'patta',
    label: 'Patta',
    category: 'patta',
    keywords: ['patta'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'chitta',
    label: 'Chitta',
    category: 'chitta',
    keywords: ['chitta'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'adangal',
    label: 'Adangal',
    category: 'adangal',
    keywords: ['adangal'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'fmb_sketch',
    label: 'FMB Sketch',
    category: 'fmb_sketch',
    keywords: ['fmb'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'a1_registration',
    label: 'A1 Registration',
    category: 'a1_registration',
    keywords: ['a1 ', 'a-1'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'ec',
    label: 'Encumbrance Certificate (EC)',
    category: 'encumbrance',
    keywords: ['encumbrance', ' ec ', '_ec'],
    multiple: true,
    expiryMonths: 6,
    dateInput: 'date',
    matchByCategory: true,
  },
  // Recurring tax / bill receipts - keep the full history (recent first), and
  // are claimed by their explicit slot tag only (shared `tax_receipt` category).
  {
    key: 'property_tax',
    label: 'Property Tax',
    category: 'tax_receipt',
    keywords: ['property tax'],
    multiple: true,
    dateInput: 'fy_half',
    matchByCategory: false,
  },
  {
    key: 'water_tax',
    label: 'Water Tax',
    category: 'tax_receipt',
    keywords: ['water tax'],
    multiple: true,
    dateInput: 'fy_half',
    matchByCategory: false,
  },
  {
    key: 'eb_bill',
    label: 'EB Bill',
    category: 'bill_receipt',
    keywords: ['eb bill', 'electricity', 'tneb', 'eb card'],
    multiple: true,
    dateInput: 'date',
    matchByCategory: false,
  },
];

/**
 * Canonical vehicle document checklist. RC is mandatory; insurance receipts keep
 * their full history (renewals stack up newest-first).
 */
export const VEHICLE_DOC_SLOTS: PropertyDocSlot[] = [
  {
    key: 'rc',
    label: 'RC (Registration Certificate)',
    category: 'rc',
    keywords: ['rc', 'registration certificate', 'registration'],
    required: true,
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'insurance_receipt',
    label: 'Insurance Receipts',
    category: 'premium_receipt',
    keywords: ['insurance', 'premium', 'policy receipt'],
    multiple: true,
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'hypothecation',
    label: 'Hypothecation Document',
    category: 'hypothecation',
    keywords: ['hypothecation', 'hypothec', 'loan', 'form 34', 'form 35'],
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'transfer_form',
    label: 'Transfer Form',
    category: 'transfer_form',
    keywords: ['transfer form', 'transfer', 'form 29', 'form 30'],
    dateInput: 'date',
    matchByCategory: true,
  },
];

/**
 * Canonical gold document checklist. Jewel photos stack up (multiple angles /
 * pieces); the purchase bill is a single optional paper.
 */
export const GOLD_DOC_SLOTS: PropertyDocSlot[] = [
  {
    key: 'jewel_photo',
    label: 'Jewel Photos',
    category: 'jewel_photo',
    keywords: ['jewel', 'photo', 'image', 'picture'],
    multiple: true,
    dateInput: 'date',
    matchByCategory: true,
  },
  {
    key: 'purchase_bill',
    label: 'Purchase Bill',
    category: 'purchase_bill',
    keywords: ['bill', 'invoice', 'receipt', 'purchase'],
    dateInput: 'date',
    matchByCategory: true,
  },
];

/** The document checklist that applies to an asset type (empty = no checklist). */
export function docSlotsForType(assetType: AssetType): PropertyDocSlot[] {
  if (isPropertyType(assetType)) return PROPERTY_DOC_SLOTS;
  if (assetType === 'vehicle') return VEHICLE_DOC_SLOTS;
  if (assetType === 'gold') return GOLD_DOC_SLOTS;
  return [];
}

/** True if a document belongs to a given slot (by tag, category, or keyword). */
export function docMatchesSlot(doc: TaxDocument, slot: PropertyDocSlot): boolean {
  const tags = doc.tags.map((t) => t.toLowerCase());
  if (tags.includes(slot.key)) return true;
  // Only trust a shared category when the slot opts in (unique-category slots).
  if (slot.matchByCategory !== false && doc.category === slot.category) return true;
  const label = doc.label.toLowerCase();
  return slot.keywords.some((k) => label.includes(k));
}

// ── Upload metadata encoded in tags ──────────────────────────────────────────
// The documents table has no dedicated date/half column, so slot uploads encode
// their "when" as tags: `date:YYYY-MM-DD` for dated papers, `half:H1|H2` (paired
// with the document's financial_year) for tax receipts.

const DATE_TAG = /^date:(\d{4}-\d{2}-\d{2})$/i;
const HALF_TAG = /^half:(h1|h2)$/i;

export const HALF_LABEL: Record<'H1' | 'H2', string> = {
  H1: '1st half (Apr–Sep)',
  H2: '2nd half (Oct–Mar)',
};

export function dateTag(isoDate: string): string {
  return `date:${isoDate}`;
}

export function halfTag(half: 'H1' | 'H2'): string {
  return `half:${half}`;
}

/** The document date encoded on a slot upload, if any (ISO string). */
export function docDate(doc: TaxDocument): string | undefined {
  for (const t of doc.tags) {
    const m = DATE_TAG.exec(t);
    if (m) return m[1];
  }
  return undefined;
}

/** The financial-year half encoded on a tax-receipt upload, if any. */
export function docHalf(doc: TaxDocument): 'H1' | 'H2' | undefined {
  for (const t of doc.tags) {
    const m = HALF_TAG.exec(t);
    if (m) return m[1].toUpperCase() as 'H1' | 'H2';
  }
  return undefined;
}

/** The most meaningful date for a document: its recorded date, else upload time. */
export function effectiveDocDate(doc: TaxDocument): string {
  return docDate(doc) ?? doc.created_at;
}

export type ECStatus = 'valid' | 'expiring' | 'expired';

export interface ECInfo {
  uploadedAt: string;
  /** 6 months after upload. */
  expiresAt: Date;
  daysLeft: number;
  status: ECStatus;
}

/** Expiry + status for an EC document, computed from its document/upload date. */
export function ecInfo(doc: TaxDocument, expiryMonths = 6): ECInfo {
  const uploaded = new Date(effectiveDocDate(doc));
  const expiresAt = new Date(uploaded);
  expiresAt.setMonth(expiresAt.getMonth() + expiryMonths);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
  const status: ECStatus = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'valid';
  return { uploadedAt: effectiveDocDate(doc), expiresAt, daysLeft, status };
}
