import {
  format,
  parseISO,
  differenceInCalendarDays,
  addMonths,
  addDays,
  formatDistanceToNow,
  isValid,
} from 'date-fns';
import type { BillingCycle } from '@/types';

function toDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date(value);
}

export type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'safe';

/** Whole calendar days from today until the given date (negative = past). */
export function daysUntil(date: string | Date): number {
  return differenceInCalendarDays(toDate(date), new Date());
}

export function isOverdue(date: string | Date): boolean {
  return daysUntil(date) < 0;
}

/** "12 Jun 2025" */
export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
}

/** "12 Jun" */
export function formatDateShort(date: string | Date | null | undefined): string {
  const d = toDate(date);
  return isValid(d) ? format(d, 'dd MMM') : '—';
}

/** "12 Jun 2025, 4:30 PM" */
export function formatDateTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  return isValid(d) ? format(d, 'dd MMM yyyy, h:mm a') : '—';
}

/** ISO yyyy-MM-dd for form inputs. */
export function toInputDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
}

export function formatRelative(date: string | Date | null | undefined): string {
  const d = toDate(date);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

export function urgencyLevel(date: string | Date): UrgencyLevel {
  const days = daysUntil(date);
  if (days <= 0) return 'overdue';
  if (days <= 3) return 'critical';
  if (days <= 30) return 'warning';
  return 'safe';
}

/** Indian financial year (Apr–Mar) as "2025-26". */
export function getCurrentFY(reference: Date = new Date()): string {
  const month = reference.getMonth(); // 0 = Jan, 3 = Apr
  const year = reference.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

/** Last 5 financial years + the next one, newest first. */
export function getFYOptions(): string[] {
  const current = new Date();
  const options: string[] = [];
  for (let offset = 1; offset >= -5; offset--) {
    const ref = new Date(current.getFullYear() + offset, current.getMonth(), 1);
    const fy = getCurrentFY(ref);
    if (!options.includes(fy)) options.push(fy);
  }
  return options;
}

/** Advance a due date by one billing cycle. */
export function advanceDueDate(date: string | Date, cycle: BillingCycle): string {
  const d = toDate(date);
  const map: Record<BillingCycle, number> = {
    monthly: 1,
    bi_monthly: 2,
    bimonthly: 2,
    quarterly: 3,
    yearly: 12,
    annual: 12,
  };
  return format(addMonths(d, map[cycle]), 'yyyy-MM-dd');
}

/** Advance a premium date by one premium frequency. */
export function advancePremiumDate(
  date: string | Date,
  frequency: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'annual',
): string {
  const d = toDate(date);
  const map = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12, annual: 12 } as const;
  return format(addMonths(d, map[frequency]), 'yyyy-MM-dd');
}

export { addDays, addMonths };
