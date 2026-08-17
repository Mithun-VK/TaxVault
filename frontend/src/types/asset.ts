export type AssetType =
  | 'land' // legacy — normalized to 'non_agricultural_land' on read (see api/assets.ts)
  | 'agricultural_land'
  | 'vacant_land' // legacy — renamed to 'non_agricultural_land'
  | 'non_agricultural_land'
  | 'vehicle'
  | 'building' // legacy — split into residential/commercial building
  | 'residential_building'
  | 'commercial_building'
  | 'gold'
  | 'other';

export type AssetCategory = 'immovable' | 'movable';

/** Real-property (immovable) asset types — buildings + the land kinds. */
export const PROPERTY_ASSET_TYPES: AssetType[] = [
  'residential_building',
  'commercial_building',
  'agricultural_land',
  'non_agricultural_land',
  // legacy
  'building',
  'vacant_land',
  'land',
];

/** True for immovable/real-property types (buildings + agricultural/non-agri land). */
export function isPropertyType(type: AssetType | string): boolean {
  return (
    type === 'residential_building' ||
    type === 'commercial_building' ||
    type === 'agricultural_land' ||
    type === 'non_agricultural_land' ||
    // legacy
    type === 'building' ||
    type === 'vacant_land' ||
    type === 'land'
  );
}

/** Immovable = real property; movable = everything else. Mirrors the backend. */
export function assetCategory(type: AssetType): AssetCategory {
  return isPropertyType(type) ? 'immovable' : 'movable';
}

export type AssetStatus = 'active' | 'archived' | 'sold' | 'transferred';

/**
 * Canonical Property Details metadata (land & building), in the order these
 * fields are displayed. Legacy keys (location, sro, extent_sqft, tneb_numbers,
 * pattam, …) are mapped onto these via normalizePropertyMetadata().
 */
export interface PropertyMetadata {
  owner_name?: string; // 1. Owner Name
  address?: string; // 2. Address
  deed_number?: string; // 3. Sale Deed Doc. No.
  deed_date?: string; // 4. Sale Deed Date
  registration_office?: string; // 5. Registration Office (was SRO / Revenue Office)
  survey_number?: string; // 6. Survey Nos.
  land_area?: string; // 7. Land Area (was Extent)
  patta_number?: string; // 8. Patta Number (was Pattam / New Pattam)
  chitta?: string; // Chitta Number
  adangal?: string; // Adangal Number
  eb_numbers?: string; // EB Nos. (was TNEB numbers)
  // Metadata-backed Property Details fields (not first-class columns).
  deed_type?: string; // e.g. "Sale Deed"
  buildup_area?: string; // e.g. "1500 sq.ft" (buildings only)
  property_tax_number?: string; // buildings only
  water_tax_number?: string; // buildings only
  land_tax_number?: string; // land only
  // Valuation: the current value itself is the first-class `current_value`
  // column; only the date it was recorded lives here (auto-stamped on change).
  current_value_at?: string; // ISO datetime the current value was recorded
}

/** @deprecated use PropertyMetadata — kept as an alias for back-compat. */
export type LandMetadata = PropertyMetadata;

export interface VehicleMetadata {
  vehicle_type: string;
  registration_number: string;
  make: string;
  model: string;
  year: number;
  fuel_type: string;
  used_by: string;
  purchase_price: number;
  /** Where the vehicle's key is kept (free text). */
  key_status: string;
  /** Whether the ownership transfer form is on hand ('Available' | 'Not Available'). */
  transfer_form: string;
  /** Whether the vehicle is under hypothecation / loan ('Yes' | 'No'). */
  hypothecation: string;
}

export interface GoldMetadata {
  category: string; // chain | ring | stud | bangles | aaram | necklace | other
  reference_number: string; // reference / receipt number
  shop_name: string;
  bill_number: string; // optional
  bill_date: string; // optional (ISO date)
  count: number; // number of physical pieces (e.g. a pair of bangles = 2)
  purity: string; // 24K | 22K | 18K | other
  weight_grams: number;
  purchased_value: number;
  located_at: string; // where the item is kept
  // Legacy keys kept for back-compat with older records.
  form?: string; // coin | jewellery | bar | etf
  purchase_price_per_gram?: number;
  storage_location?: string;
  receipt_number?: string;
}

export type AssetMetadata = (
  | Partial<PropertyMetadata>
  | Partial<VehicleMetadata>
  | Partial<GoldMetadata>
  | Record<string, never>
) & {
  /** Legacy owner key — superseded by PropertyMetadata.owner_name. */
  owner?: string;
  /** Free-form: unknown/extra keys (deed_type, water_tax_id, lease_note, …)
   * are preserved on the record even though they aren't curated fields. */
  [key: string]: unknown;
};

export interface Asset extends PropertyMetadata {
  id: string;
  name: string;
  description: string;
  asset_type: AssetType;
  acquisition_date: string | null;
  acquisition_cost: number;
  current_value: number;
  notes: string;
  status: AssetStatus;
  individual_id?: string | null;
  /** Set when the property is held by a company rather than a person. */
  company_id?: string | null;
  metadata: AssetMetadata;
  created_at: string;
  updated_at: string;
}

export interface AssetCreate extends PropertyMetadata {
  name: string;
  description?: string;
  asset_type: AssetType;
  acquisition_date?: string;
  acquisition_cost?: number;
  current_value?: number;
  notes?: string;
  individual_id?: string | null;
  company_id?: string | null;
  metadata?: AssetMetadata;
}

export type AssetUpdate = Partial<AssetCreate> & { status?: AssetStatus };

export interface AssetFilters {
  search?: string;
  asset_type?: AssetType | 'all';
  status?: AssetStatus | 'all';
  /** Include archived assets in the result (default hidden). Used by Reports. */
  include_archived?: boolean;
}
