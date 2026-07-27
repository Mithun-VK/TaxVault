import type { Asset } from '@/types';
import { BUILDING_ASSET_TYPES, LAND_ASSET_TYPES } from './buildings';

/**
 * Canonical "Property Details" fields — the single source of truth for their
 * order, labels, and the underlying metadata keys. Display, form, export and
 * back-compat mapping all derive from this list, so the order is guaranteed to
 * be consistent everywhere.
 */
export interface PropertyField {
  /** Canonical metadata key written by the form. */
  key: string;
  label: string;
  /** Legacy keys mapped onto this field when reading old records. */
  aliases: string[];
  /** Form input type (defaults to text). */
  input?: 'text' | 'date';
  placeholder?: string;
  /** Render across both grid columns in the form. */
  wide?: boolean;
  /**
   * Stored in `asset_metadata` rather than a first-class column. Reads fall back
   * to metadata automatically, but the form must write these into metadata.
   */
  meta?: boolean;
  /** Asset types this field applies to (undefined = every property type). */
  types?: string[];
}

/** True if a Property Details field applies to the given asset type. */
export function fieldAppliesToType(field: PropertyField, assetType: string): boolean {
  return !field.types || field.types.includes(assetType);
}

// Ordered for the Property Details layout — five rows of three:
//   1. Owner Name · Address · Deed Type
//   2. Sale Deed Doc. No. · Sale Deed Date · Registration Office
//   3. Survey Nos. · Land Area · Buildup Area
//   4. Patta Number · Chitta Number · Adangal Number
//   5. Property Tax Number · Water Tax Number · EB Nos.
export const PROPERTY_FIELDS: PropertyField[] = [
  { key: 'owner_name', label: 'Owner Name', aliases: ['owner'], wide: true },
  { key: 'address', label: 'Address', aliases: ['location'], wide: true },
  { key: 'deed_type', label: 'Deed Type', aliases: [], meta: true },
  { key: 'deed_number', label: 'Sale Deed Doc. No.', aliases: ['deed_numbers', 'deed_no'] },
  {
    key: 'deed_date',
    label: 'Sale Deed Date',
    aliases: ['deed_dates'],
    placeholder: 'e.g. 2015-09-23, 2016-02-19',
  },
  {
    key: 'registration_office',
    label: 'Registration Office',
    aliases: ['sro', 'revenue_office', 'registration_number'],
  },
  { key: 'survey_number', label: 'Survey Nos.', aliases: ['survey_numbers', 'survey_no', 'survey_nos'] },
  { key: 'land_area', label: 'Land Area', aliases: ['extent_sqft', 'extent', 'extent_sq_ft'] },
  { key: 'buildup_area', label: 'Buildup Area', aliases: [], meta: true, types: BUILDING_ASSET_TYPES },
  {
    key: 'patta_number',
    label: 'Patta Number',
    aliases: ['patta_numbers', 'pattam', 'new_pattam', 'patta'],
  },
  { key: 'chitta', label: 'Chitta Number', aliases: ['chitta_number'] },
  { key: 'adangal', label: 'Adangal Number', aliases: ['adangal_number'] },
  {
    key: 'property_tax_number',
    label: 'Property Tax Number',
    aliases: ['property_tax_id', 'property_tax_no'],
    meta: true,
    types: BUILDING_ASSET_TYPES,
  },
  {
    key: 'water_tax_number',
    label: 'Water Tax Number',
    aliases: ['water_tax_id', 'water_tax_no'],
    meta: true,
    types: BUILDING_ASSET_TYPES,
  },
  {
    key: 'land_tax_number',
    label: 'Land Tax Number',
    aliases: ['land_tax_id', 'land_tax_no'],
    meta: true,
    types: LAND_ASSET_TYPES,
  },
  { key: 'eb_numbers', label: 'EB Nos.', aliases: ['tneb_numbers', 'tneb_number', 'eb_number', 'eb_no', 'eb_nos'] },
];

/** The canonical keys in order. */
export const PROPERTY_FIELD_KEYS = PROPERTY_FIELDS.map((f) => f.key);

/** All keys (canonical + legacy) surfaced by the canonical fields. */
export const KNOWN_PROPERTY_KEYS = new Set<string>(
  PROPERTY_FIELDS.flatMap((f) => [f.key, ...f.aliases]),
);

/** Coerce a metadata value (string | number | array) to a display string. */
function display(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const parts = v.map((x) => String(x).trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  }
  const s = typeof v === 'number' ? String(v) : String(v).trim();
  return s ? s : undefined;
}

/** Resolve one canonical field from metadata, honouring legacy aliases. */
export function resolveField(
  metadata: Record<string, unknown> | null | undefined,
  field: PropertyField,
): string | undefined {
  if (!metadata) return undefined;
  const direct = display(metadata[field.key]);
  if (direct !== undefined) return direct;
  for (const alias of field.aliases) {
    const v = display(metadata[alias]);
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Back-compat: fill each canonical key from its legacy alias when the canonical
 * key is absent, keeping every other (unknown) key intact. Used when loading a
 * record so old data reads under the new field names.
 */
export function normalizePropertyMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const src = metadata ?? {};
  const out: Record<string, unknown> = { ...src };
  for (const f of PROPERTY_FIELDS) {
    if (out[f.key] == null || out[f.key] === '') {
      for (const alias of f.aliases) {
        if (src[alias] != null && src[alias] !== '') {
          out[f.key] = src[alias];
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Resolve a canonical field for an asset: the first-class column wins, then the
 * legacy metadata alias (back-compat for anything not yet backfilled).
 */
export function resolveAssetField(asset: Asset, field: PropertyField): string | undefined {
  const col = display((asset as unknown as Record<string, unknown>)[field.key]);
  if (col !== undefined) return col;
  return resolveField((asset.metadata ?? null) as Record<string, unknown> | null, field);
}

export interface PropertyDetailRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Ordered [{label, value}] for the canonical fields that have a value.
 * `ownerName` (from the linked individual) takes precedence for field #1.
 */
export function getPropertyDetailRows(asset: Asset, ownerName?: string): PropertyDetailRow[] {
  const rows: PropertyDetailRow[] = [];
  for (const f of PROPERTY_FIELDS) {
    if (!fieldAppliesToType(f, asset.asset_type)) continue;
    const value =
      f.key === 'owner_name' ? (ownerName ?? resolveAssetField(asset, f)) : resolveAssetField(asset, f);
    if (value !== undefined && value !== '') rows.push({ key: f.key, label: f.label, value });
  }
  return rows;
}
