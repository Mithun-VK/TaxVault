/**
 * Land-area units and conversions. Everything is defined relative to square feet
 * (the base unit), so any pair converts by dividing through sq ft:
 *
 *   1 Acre   = 43,560 sq ft
 *   1 Ground =  2,400 sq ft
 *   1 Cent   =    435.6 sq ft
 *   1 Sq ft  =      1 sq ft
 */
export type LandUnit = 'acre' | 'ground' | 'cent' | 'sqft';

export const LAND_UNITS: { value: LandUnit; label: string; short: string }[] = [
  { value: 'acre', label: 'Acre', short: 'acre' },
  { value: 'ground', label: 'Ground', short: 'ground' },
  { value: 'cent', label: 'Cent', short: 'cent' },
  { value: 'sqft', label: 'Square feet', short: 'sq ft' },
];

/** Square feet per one of each unit. */
const SQFT_PER: Record<LandUnit, number> = {
  acre: 43_560,
  ground: 2_400,
  cent: 435.6,
  sqft: 1,
};

const UNIT_LABELS: Record<LandUnit, string> = {
  acre: 'acre',
  ground: 'ground',
  cent: 'cent',
  sqft: 'sq ft',
};

/** Convert a value between land units via square feet. */
export function convertLandArea(value: number, from: LandUnit, to: LandUnit): number {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  const sqft = value * SQFT_PER[from];
  return sqft / SQFT_PER[to];
}

/** Trim trailing zeros from a converted value (keep up to 4 decimals). */
export function roundLandArea(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

/** Short unit label ("sq ft", "acre", …). */
export function landUnitLabel(unit: LandUnit): string {
  return UNIT_LABELS[unit];
}

/**
 * Parse a stored land-area string ("2.5 acre", "1200 sq ft", "1200") into a
 * numeric value + unit. Defaults to square feet when no unit is recognised.
 */
export function parseLandArea(raw: string | undefined | null): { value: string; unit: LandUnit } {
  const s = (raw ?? '').trim();
  if (!s) return { value: '', unit: 'sqft' };
  const numMatch = s.match(/[\d.,]+/);
  const value = numMatch ? numMatch[0].replace(/,/g, '') : '';
  const lower = s.toLowerCase();
  let unit: LandUnit = 'sqft';
  if (/\bacre?s?\b/.test(lower)) unit = 'acre';
  else if (/\bground?s?\b/.test(lower)) unit = 'ground';
  else if (/\bcent?s?\b/.test(lower)) unit = 'cent';
  else if (/sq\.?\s*ft|sqft|square\s*f/.test(lower)) unit = 'sqft';
  return { value, unit };
}

/** Compose the canonical stored string, e.g. "2.5 acre". */
export function formatLandArea(value: string, unit: LandUnit): string {
  const v = value.trim();
  if (!v) return '';
  return `${v} ${UNIT_LABELS[unit]}`;
}

/** Human-readable equivalents in the other units, for helper text. */
export function landAreaEquivalents(value: number, unit: LandUnit): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const others = LAND_UNITS.filter((u) => u.value !== unit);
  return others
    .map((u) => {
      const converted = roundLandArea(convertLandArea(value, unit, u.value));
      return `${converted.toLocaleString('en-IN')} ${u.short}`;
    })
    .join(' · ');
}
