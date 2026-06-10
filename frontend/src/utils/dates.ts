import { differenceInCalendarDays, parseISO, format } from 'date-fns';

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const target = parseISO(dateStr);
  const today = new Date();
  // Clear times to calculate purely by calendar day difference
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  
  return differenceInCalendarDays(targetDay, today);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return format(parseISO(dateStr), 'dd MMM yyyy');
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  return format(parseISO(dateStr), 'dd MMM');
}

export function urgencyLevel(days: number): 'overdue' | 'critical' | 'warning' | 'safe' {
  if (days < 0) return 'overdue';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'safe';
}

export function getCurrentFY(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  
  if (month >= 3) {
    // April to December: FY is current_year - next_year_short (e.g. 2026-27)
    const nextYearShort = String(year + 1).slice(-2);
    return `${year}-${nextYearShort}`;
  } else {
    // January to March: FY is prev_year - current_year_short
    const prevYear = year - 1;
    const currentYearShort = String(year).slice(-2);
    return `${prevYear}-${currentYearShort}`;
  }
}

export function getFYOptions(): string[] {
  // Return last 5 FYs + next 1 FY
  const currentFY = getCurrentFY();
  const [startYear] = currentFY.split('-').map(Number);
  
  const options: string[] = [];
  for (let i = -4; i <= 1; i++) {
    const yr = startYear + i;
    const nextYrShort = String(yr + 1).slice(-2);
    options.push(`${yr}-${nextYrShort}`);
  }
  return options;
}
