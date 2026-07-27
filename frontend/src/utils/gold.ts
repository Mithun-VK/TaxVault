import { GOLD_CATEGORIES, gramsToSovereigns } from './constants';
import { getStatusLabel } from './formatters';
import type { Asset } from '@/types';

/** Read a value off a gold asset's metadata bag. */
function goldMeta(a: Asset, key: string): unknown {
  return (a.metadata as Record<string, unknown> | null)?.[key];
}

export interface GoldCategoryDef {
  value: string;
  label: string;
}

/** The stored jewellery category slug of a gold asset ('other' when unset). */
export function goldCategory(a: Asset): string {
  const c = goldMeta(a, 'category');
  return typeof c === 'string' && c.trim() ? c : 'other';
}

// ── Category management ───────────────────────────────────────────────────────
// Built-in categories live here; the user's custom additions are persisted in
// the database (see api/goldCategories.ts) and passed into the helpers below.

/** The six built-in jewellery categories (everything except the "other" bucket). */
export function builtinGoldCategories(): GoldCategoryDef[] {
  return GOLD_CATEGORIES.filter((c) => c.value !== 'other').map((c) => ({
    value: c.value,
    label: c.label,
  }));
}

/**
 * Every category to display: built-ins + custom + any category slug already used
 * by a gold item (so imported/legacy categories surface as their own card).
 */
export function allGoldCategories(assets: Asset[], custom: GoldCategoryDef[]): GoldCategoryDef[] {
  const base = [...builtinGoldCategories(), ...custom];
  const seen = new Set(base.map((c) => c.value));
  const discovered: GoldCategoryDef[] = [];
  for (const a of assets) {
    const v = goldCategory(a);
    if (v !== 'other' && !seen.has(v)) {
      seen.add(v);
      discovered.push({ value: v, label: getStatusLabel(v) });
    }
  }
  return [...base, ...discovered];
}

/** Options for the gold form's category select (built-ins + custom + Other). */
export function goldCategoryOptions(custom: GoldCategoryDef[]): GoldCategoryDef[] {
  return [...builtinGoldCategories(), ...custom, { value: 'other', label: 'Other' }];
}

/** Physical pieces this entry represents (a pair of bangles = 2). Defaults to 1. */
export function goldCount(a: Asset): number {
  const n = Number(goldMeta(a, 'count'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function goldGrams(a: Asset): number {
  const n = Number(goldMeta(a, 'weight_grams'));
  return Number.isFinite(n) ? n : 0;
}

export function goldPurity(a: Asset): string | undefined {
  const p = goldMeta(a, 'purity');
  return typeof p === 'string' && p ? p : undefined;
}

function metaStr(a: Asset, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = goldMeta(a, k);
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

/** Reference / receipt number (new key first, legacy fallback). */
export function goldReference(a: Asset): string | undefined {
  return metaStr(a, 'reference_number', 'receipt_number');
}

export function goldShop(a: Asset): string | undefined {
  return metaStr(a, 'shop_name');
}

export function goldBillNumber(a: Asset): string | undefined {
  return metaStr(a, 'bill_number');
}

export function goldBillDate(a: Asset): string | undefined {
  return metaStr(a, 'bill_date');
}

/** Where the item is kept (new key first, legacy `storage_location` fallback). */
export function goldLocatedAt(a: Asset): string | undefined {
  return metaStr(a, 'located_at', 'storage_location');
}

/** Best-known worth: explicit purchased value, else valuation, else weight × rate. */
export function goldValue(a: Asset): number {
  const purchased = Number(goldMeta(a, 'purchased_value')) || 0;
  if (purchased) return purchased;
  const rate = Number(goldMeta(a, 'purchase_price_per_gram')) || 0;
  return Number(a.current_value) || goldGrams(a) * rate || 0;
}

export interface GoldCategoryStat {
  key: string;
  label: string;
  /** Number of physical jewels in this category. */
  pieces: number;
  grams: number;
  sovereigns: number;
  value: number;
  items: Asset[];
}

export interface GoldSummary {
  categories: GoldCategoryStat[];
  totals: { pieces: number; grams: number; sovereigns: number; value: number; entries: number };
}

/**
 * Group gold assets into jewellery categories with piece counts and weights.
 * Every category in `defs` always appears (even at zero pieces); items whose
 * category isn't in `defs` fall into the "other" bucket, which only shows when
 * it actually holds items.
 */
export function goldSummary(
  assets: Asset[],
  defs: GoldCategoryDef[] = builtinGoldCategories(),
): GoldSummary {
  const known = new Set(defs.map((c) => c.value));
  const byCat = new Map<string, Asset[]>();
  for (const a of assets) {
    const raw = goldCategory(a);
    const bucket = known.has(raw) ? raw : 'other';
    const arr = byCat.get(bucket) ?? [];
    arr.push(a);
    byCat.set(bucket, arr);
  }

  // Ensure the trailing "other" bucket is representable without duplicating it.
  const withOther = defs.some((c) => c.value === 'other')
    ? defs
    : [...defs, { value: 'other', label: 'Other' }];

  const categories = withOther
    .map(({ value, label }) => {
      const items = byCat.get(value) ?? [];
      const grams = items.reduce((s, a) => s + goldGrams(a), 0);
      return {
        key: value,
        label,
        pieces: items.reduce((s, a) => s + goldCount(a), 0),
        grams,
        sovereigns: gramsToSovereigns(grams),
        value: items.reduce((s, a) => s + goldValue(a), 0),
        items,
      };
    })
    .filter((c) => c.key !== 'other' || c.items.length > 0);

  const grams = categories.reduce((s, c) => s + c.grams, 0);
  return {
    categories,
    totals: {
      pieces: categories.reduce((s, c) => s + c.pieces, 0),
      grams,
      sovereigns: gramsToSovereigns(grams),
      value: categories.reduce((s, c) => s + c.value, 0),
      entries: assets.length,
    },
  };
}
