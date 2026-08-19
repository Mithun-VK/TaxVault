import type { Asset } from '@/types';
import { formatINR } from './formatters';
import { formatDate } from './dates';

/**
 * Property valuation:
 *   • current_value    - first-class `current_value` column (editable), the
 *                        property's current worth, for buildings + land.
 *   • current_value_at - auto-stamped datetime the value was recorded (metadata)
 *   • buildup_area     - buildings only (residential / commercial), metadata
 */
export const BUILDING_ASSET_TYPES = ['residential_building', 'commercial_building', 'building'];
export const LAND_ASSET_TYPES = ['agricultural_land', 'non_agricultural_land', 'vacant_land', 'land'];

export function isBuildingType(type: string): boolean {
  return BUILDING_ASSET_TYPES.includes(type);
}

export function isLandType(type: string): boolean {
  return LAND_ASSET_TYPES.includes(type);
}

/** True for immovable property types that track a current value (buildings + land). */
export function hasMarketPrice(type: string): boolean {
  return isBuildingType(type) || isLandType(type);
}

/** Metadata keys the valuation block owns - kept out of the generic dump.
 * (`current_value` is a column, not metadata.) The legacy market-price keys are
 * listed so any test data written earlier doesn't leak into "other details". */
export const BUILDING_META_KEYS = [
  'current_value_at',
  'current_market_price',
  'current_market_price_at',
];

/**
 * Build the valuation metadata for a property on save. `current_value_at` is
 * stamped **automatically** with the current date-time whenever the current
 * value is newly set or changed (an unchanged value keeps its timestamp).
 */
export function valuationMetadata(
  currentValue: number | undefined,
  oldValue: number | null | undefined,
  oldMeta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (currentValue === undefined) return { current_value_at: undefined };
  const changed = oldValue == null || Number(oldValue) !== Number(currentValue);
  return {
    current_value_at: changed
      ? new Date().toISOString()
      : (oldMeta?.current_value_at as string) || new Date().toISOString(),
  };
}

function metaStr(a: Asset, key: string): string | undefined {
  const v = (a.metadata as Record<string, unknown> | null)?.[key];
  return v == null || v === '' ? undefined : String(v);
}

export const buildupArea = (a: Asset): string | undefined => metaStr(a, 'buildup_area');
export const currentValueAt = (a: Asset): string | undefined => metaStr(a, 'current_value_at');

export interface BuildingDetailRow {
  key: string;
  label: string;
  value: string;
}

/** The current-value row (with its auto-recorded as-of date) for the detail
 * page - buildings + land. Empty when no value is set. */
export function getValuationRows(a: Asset): BuildingDetailRow[] {
  const value = Number(a.current_value) || 0;
  if (value <= 0) return [];
  const at = currentValueAt(a);
  return [
    {
      key: 'current_value',
      label: 'Current Value',
      value: at ? `${formatINR(value)} · as of ${formatDate(at)}` : formatINR(value),
    },
  ];
}
