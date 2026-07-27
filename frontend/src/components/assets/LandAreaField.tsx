import { useState } from 'react';
import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LAND_UNITS,
  convertLandArea,
  formatLandArea,
  landAreaEquivalents,
  parseLandArea,
  roundLandArea,
  type LandUnit,
} from '@/utils/landArea';
import type { AssetFormValues } from './AssetForm';

/**
 * Land area with a unit selector. The magnitude + unit are edited locally and
 * written back to the single `land_area` form field as "<value> <unit>". Picking
 * a different unit converts the current value automatically (acre ⇄ ground ⇄
 * cent ⇄ sq ft).
 */
export function LandAreaField({
  watch,
  setValue,
}: {
  watch: UseFormWatch<AssetFormValues>;
  setValue: UseFormSetValue<AssetFormValues>;
}) {
  const stored = (watch('land_area') as string | undefined) ?? '';
  const parsed = parseLandArea(stored);
  const [value, setLocalValue] = useState(parsed.value);
  const [unit, setUnit] = useState<LandUnit>(parsed.unit);

  const write = (nextValue: string, nextUnit: LandUnit) => {
    setValue('land_area', formatLandArea(nextValue, nextUnit), { shouldDirty: true });
  };

  const onValueChange = (v: string) => {
    setLocalValue(v);
    write(v, unit);
  };

  const onUnitChange = (nextUnit: LandUnit) => {
    // Convert the current magnitude into the newly-selected unit.
    const num = Number(value);
    if (Number.isFinite(num) && num > 0 && nextUnit !== unit) {
      const converted = String(roundLandArea(convertLandArea(num, unit, nextUnit)));
      setLocalValue(converted);
      setUnit(nextUnit);
      write(converted, nextUnit);
    } else {
      setUnit(nextUnit);
      write(value, nextUnit);
    }
  };

  const equivalents = landAreaEquivalents(Number(value), unit);

  return (
    <div className="col-span-2 space-y-2">
      <Label htmlFor="land_area_value">Land Area</Label>
      <div className="flex gap-2">
        <Input
          id="land_area_value"
          type="number"
          step="0.0001"
          min="0"
          inputMode="decimal"
          placeholder="e.g. 2.5"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="flex-1"
        />
        <select
          aria-label="Land area unit"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as LandUnit)}
          className="h-10 w-32 shrink-0 rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          {LAND_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      {equivalents && (
        <p className="text-xs text-slate-600">= {equivalents}</p>
      )}
    </div>
  );
}
