import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AssetFormValues } from './AssetForm';

/**
 * Valuation field for immovable properties (buildings + land): the editable
 * `Current Value`. The "as-of" date is recorded automatically (current
 * date-time) on save — see valuationMetadata — so there is no date input here.
 * (Buildup area now lives in the main Property Details grid.)
 */
export function BuildingFields({ register }: { register: UseFormRegister<AssetFormValues> }) {
  return (
    <div className="col-span-2 space-y-2">
      <Label htmlFor="current_value">Current Value (₹)</Label>
      <Input
        id="current_value"
        type="number"
        step="0.01"
        placeholder="Latest valuation"
        className="font-mono tabular-nums"
        {...register('current_value')}
      />
      <p className="text-xs text-slate-600">
        The valuation date is recorded automatically when you save.
      </p>
    </div>
  );
}
