import { COMPLIANCE_RULES, type ComplianceRule } from './constants';
import type { Bill, Company, CompanyDocument, Tax } from '@/types';

/**
 * Turns a company + its documents into the Compliance tab's checklist.
 *
 * Three sources feed the table:
 *   1. `COMPLIANCE_RULES` — the statutory calendar, with annual dates derived
 *      from the company's own financial-year end.
 *   2. `company_documents` carrying an expiry date — license renewals.
 *   3. Tax obligations and recurring bills whose name mentions the company —
 *      the payables the client already tracks by hand.
 *
 * A filing counts as done when a document of the matching category exists for
 * the same financial year; there is no separate "marked done" flag, so the
 * proof and the status are the same thing.
 */

export type ComplianceStatus =
  | 'done'
  | 'overdue'
  | 'due_soon'
  | 'pending'
  | 'expiring'
  | 'expired';

export interface ComplianceRow {
  id: string;
  label: string;
  frequency: 'Monthly' | 'Quarterly' | 'Annual';
  dueDate: string; // ISO yyyy-mm-dd
  status: ComplianceStatus;
  kind: 'filing' | 'license' | 'payable';
  /** Document category that satisfies this row (drives the upload action). */
  category?: string;
  financialYear?: string;
  /** Set when an existing document already satisfies the row. */
  documentId?: string;
}

export const STATUS_LABELS: Record<ComplianceStatus, string> = {
  done: 'Done',
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  pending: 'Pending',
  expiring: 'Expiring',
  expired: 'Expired',
};

/** Tailwind classes per status — green/red/amber/blue/orange, as specified. */
export const STATUS_TONES: Record<ComplianceStatus, string> = {
  done: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-brand-danger',
  due_soon: 'bg-amber-50 text-amber-700',
  pending: 'bg-sky-50 text-sky-700',
  expiring: 'bg-orange-50 text-orange-700',
  expired: 'bg-red-100 text-red-900',
};

/**
 * Local-time ISO date. `toISOString()` would convert local midnight to the
 * previous day everywhere east of UTC — in IST every deadline landed a day
 * early — so the parts are read off the local calendar instead.
 */
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** Parse a yyyy-mm-dd string as local midnight, for the same reason. */
function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(y, m - 1, d)
    : new Date(value);
}

/** Whole days between two dates, counted on the calendar rather than the clock. */
const daysBetween = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/** Clamp a day-of-month to a month that may be shorter (31 Feb → 28/29 Feb). */
function dateIn(year: number, month1: number, day: number): Date {
  const lastDay = new Date(year, month1, 0).getDate();
  return new Date(year, month1 - 1, Math.min(day, lastDay));
}

function parseFyEnd(fyEnd: string | undefined): { month: number; day: number } {
  const [m, d] = (fyEnd ?? '03-31').split('-').map(Number);
  return Number.isFinite(m) && Number.isFinite(d) ? { month: m, day: d } : { month: 3, day: 31 };
}

/** The financial year that most recently closed, as "2025-26". */
export function lastClosedFinancialYear(fyEnd: string | undefined, today = new Date()): string {
  const { month, day } = parseFyEnd(fyEnd);
  const past =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() > day);
  const currentStart = past ? today.getFullYear() : today.getFullYear() - 1;
  const start = currentStart - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** The last `count` financial years, newest (most recently closed) first. */
export function recentFinancialYears(fyEnd: string | undefined, count = 4, today = new Date()) {
  const first = Number(lastClosedFinancialYear(fyEnd, today).slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const y = first - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });
}

/** Due date for an annual rule: the FY end, plus the rule's month offset.
 *
 * The month is advanced arithmetically rather than with `setMonth`, which would
 * roll a 31 March year end forward into October when asked for +6 months
 * (September has 30 days), pushing every annual deadline out by a month.
 */
function annualDueDate(rule: ComplianceRule, fyEnd: string | undefined, fy: string): Date {
  const { month } = parseFyEnd(fyEnd);
  const fyStartYear = Number(fy.slice(0, 4));
  // The label "2025-26" ends in the calendar year the FY end falls in: a
  // Jan-Mar year end lands in the following year, a later one in the same year.
  const endYear = month <= 3 ? fyStartYear + 1 : fyStartYear;

  const monthsFromJan = month - 1 + (rule.fyOffsetMonths ?? 0);
  const targetYear = endYear + Math.floor(monthsFromJan / 12);
  const targetMonth = (((monthsFromJan % 12) + 12) % 12) + 1;
  return dateIn(targetYear, targetMonth, rule.day);
}

/** Next occurrence of a monthly/quarterly deadline, from today. */
function periodicDueDate(rule: ComplianceRule, today: Date): Date {
  if (rule.frequency === 'quarterly') {
    // Quarters end Jun/Sep/Dec/Mar; the return follows the month after.
    const quarterEnds = [1, 4, 7, 10]; // filing months
    const month = quarterEnds.find((m) => dateIn(today.getFullYear(), m, rule.day) >= today);
    return month
      ? dateIn(today.getFullYear(), month, rule.day)
      : dateIn(today.getFullYear() + 1, quarterEnds[0], rule.day);
  }
  const thisMonth = dateIn(today.getFullYear(), today.getMonth() + 1, rule.day);
  if (thisMonth >= today) return thisMonth;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return dateIn(next.getFullYear(), next.getMonth() + 1, rule.day);
}

function dateStatus(due: Date, today: Date): ComplianceStatus {
  const days = daysBetween(today, due);
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due_soon';
  return 'pending';
}

function expiryStatus(expiry: Date, today: Date): ComplianceStatus {
  const days = daysBetween(today, expiry);
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring';
  return 'pending';
}

export interface ComplianceInput {
  company: Company;
  documents: CompanyDocument[];
  taxes?: Tax[];
  bills?: Bill[];
  today?: Date;
}

export function buildComplianceRows({
  company,
  documents,
  taxes = [],
  bills = [],
  today = new Date(),
}: ComplianceInput): ComplianceRow[] {
  const rows: ComplianceRow[] = [];
  const fy = lastClosedFinancialYear(company.financial_year_end, today);
  const currentFy = (() => {
    const start = Number(fy.slice(0, 4)) + 1;
    return `${start}-${String(start + 1).slice(-2)}`;
  })();

  const docFor = (category?: string, year?: string) =>
    category
      ? documents.find(
          (d) => d.category === category && (!year || d.financial_year === year),
        )
      : undefined;

  // 1. Statutory calendar.
  for (const rule of COMPLIANCE_RULES) {
    // Skip what the company isn't registered for — no GSTIN, no GST return;
    // no EPF code, no EPF return. Keeps the table to real obligations.
    const held: Record<string, string | undefined> = {
      gstin: company.gstin,
      tan: company.tan_number,
      epf: company.epf_number,
      esi: company.esi_number,
      pt: company.professional_tax_number,
    };
    if (rule.requires && !held[rule.requires]) continue;

    const annual = rule.frequency === 'annual';
    const due = annual
      ? annualDueDate(rule, company.financial_year_end, fy)
      : periodicDueDate(rule, today);
    const year = annual ? fy : currentFy;
    const doc = docFor(rule.category, year);

    rows.push({
      id: `${rule.id}-${year}`,
      label: rule.label,
      frequency:
        rule.frequency === 'annual'
          ? 'Annual'
          : rule.frequency === 'quarterly'
            ? 'Quarterly'
            : 'Monthly',
      dueDate: iso(due),
      status: doc ? 'done' : dateStatus(due, today),
      kind: 'filing',
      category: rule.category,
      financialYear: year,
      documentId: doc?.id,
    });
  }

  // 2. License renewals — anything on file with an expiry date.
  for (const doc of documents) {
    if (!doc.expiry_date) continue;
    const expiry = parseDate(doc.expiry_date);
    rows.push({
      id: `license-${doc.id}`,
      label: `${doc.label} renewal`,
      frequency: 'Annual',
      dueDate: doc.expiry_date,
      status: expiryStatus(expiry, today),
      kind: 'license',
      category: doc.category,
      documentId: doc.id,
    });
  }

  // 3. Registrations kept as JSON rather than as uploaded documents.
  for (const reg of company.other_registrations ?? []) {
    if (!reg.expiry_date) continue;
    rows.push({
      id: `reg-${reg.name}-${reg.expiry_date}`,
      label: `${reg.name} renewal`,
      frequency: 'Annual',
      dueDate: reg.expiry_date,
      status: expiryStatus(parseDate(reg.expiry_date), today),
      kind: 'license',
    });
  }

  if (company.foreign_registration_expiry) {
    rows.push({
      id: 'foreign-registration',
      label: `${company.foreign_jurisdiction ?? 'Foreign registration'} renewal`,
      frequency: 'Annual',
      dueDate: company.foreign_registration_expiry,
      status: expiryStatus(parseDate(company.foreign_registration_expiry), today),
      kind: 'license',
      category: 'foreign_reg',
    });
  }

  // 4. Payables the client already tracks that name this company. Matching is
  // by name because taxes and bills have no company_id of their own.
  const needle = (company.trade_name || company.legal_name).toLowerCase();
  const mentionsCompany = (text: string | null | undefined) =>
    !!text && needle.length > 2 && text.toLowerCase().includes(needle);

  for (const tax of taxes) {
    if (!tax.due_date) continue;
    if (!mentionsCompany(tax.name) && !mentionsCompany(tax.description) && !mentionsCompany(tax.notes))
      continue;
    rows.push({
      id: `tax-${tax.id}`,
      label: tax.name || tax.description || 'Tax obligation',
      frequency: 'Annual',
      dueDate: tax.due_date,
      status: tax.status === 'paid' ? 'done' : dateStatus(parseDate(tax.due_date), today),
      kind: 'payable',
    });
  }

  for (const bill of bills) {
    if (!bill.next_due_date) continue;
    if (!mentionsCompany(bill.name) && !mentionsCompany(bill.provider_name) && !mentionsCompany(bill.notes))
      continue;
    rows.push({
      id: `bill-${bill.id}`,
      label: bill.name || bill.provider_name,
      frequency: 'Monthly',
      dueDate: bill.next_due_date,
      status: dateStatus(parseDate(bill.next_due_date), today),
      kind: 'payable',
    });
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Rows that need attention now — drives the "N items need attention" strip. */
export function needsAttention(rows: ComplianceRow[]): ComplianceRow[] {
  return rows.filter((r) =>
    ['overdue', 'due_soon', 'expiring', 'expired'].includes(r.status),
  );
}
