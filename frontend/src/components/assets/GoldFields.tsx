import { useState } from 'react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/utils/formatters';
import { gramsToSovereigns } from '@/utils/constants';
import { goldCategoryOptions } from '@/utils/gold';
import { useGoldCategories } from '@/api/goldCategories';
import { AddGoldCategoryDialog } from './AddGoldCategoryDialog';
import type { AssetFormValues } from './AssetForm';

const ADD_NEW = '__add_new__';

// Fixed storage locations; "Others" reveals a free-text box.
const LOCATED_AT_OPTIONS = ['Home', 'Bank Locker', 'Daily wearables'] as const;
const OTHERS = 'Others';

export function GoldFields({
  register,
  watch,
  setValue,
}: {
  register: UseFormRegister<AssetFormValues>;
  watch: UseFormWatch<AssetFormValues>;
  setValue: UseFormSetValue<AssetFormValues>;
}) {
  const weight = Number(watch('weight_grams')) || 0;
  const value = Number(watch('gold_purchased_value')) || 0;
  const selectedCategory = watch('gold_category');

  // "Located at" is a fixed choice, with a manual fallback under "Others".
  const locatedAt = watch('gold_located_at') ?? '';
  const isKnownLocation = (LOCATED_AT_OPTIONS as readonly string[]).includes(locatedAt);
  const [locationMode, setLocationMode] = useState<string>(
    locatedAt === '' ? '' : isKnownLocation ? locatedAt : OTHERS,
  );
  register('gold_located_at');
  // Built-ins + any categories the user has added (persisted in the DB).
  const { data: custom = [] } = useGoldCategories();
  const categories = goldCategoryOptions(custom);
  const [addOpen, setAddOpen] = useState(false);
  // Keep the field registered even though the select is controlled.
  register('gold_category');

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="gold_category">Category</Label>
        <select
          id="gold_category"
          value={selectedCategory ?? ''}
          onChange={(e) => {
            if (e.target.value === ADD_NEW) {
              setAddOpen(true);
              return;
            }
            setValue('gold_category', e.target.value, { shouldDirty: true });
          }}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
          <option value={ADD_NEW}>+ Add category…</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gold_reference">Reference number</Label>
        <Input id="gold_reference" {...register('gold_reference')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gold_shop">Shop name</Label>
        <Input id="gold_shop" placeholder="e.g. Lalitha Jewellery" {...register('gold_shop')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gold_purchased_value">Purchased value (₹)</Label>
        <Input id="gold_purchased_value" type="number" step="0.01" {...register('gold_purchased_value')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gold_bill_number">
          Bill number <span className="text-slate-600">(optional)</span>
        </Label>
        <Input id="gold_bill_number" {...register('gold_bill_number')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gold_bill_date">
          Bill date <span className="text-slate-600">(optional)</span>
        </Label>
        <Input id="gold_bill_date" type="date" {...register('gold_bill_date')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="weight_grams">Weight (grams)</Label>
        <Input id="weight_grams" type="number" step="0.01" {...register('weight_grams')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gold_count">Quantity (pieces)</Label>
        <Input id="gold_count" type="number" min="1" step="1" {...register('gold_count')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purity">Purity</Label>
        <select
          id="purity"
          {...register('purity')}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="24K">24K</option>
          <option value="22K">22K</option>
          <option value="18K">18K</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gold_located_at_select">Located at</Label>
        <select
          id="gold_located_at_select"
          value={locationMode}
          onChange={(e) => {
            const v = e.target.value;
            setLocationMode(v);
            // A fixed choice writes straight through; "Others" clears for manual
            // entry unless the current value is already a custom one.
            if (v === OTHERS) {
              if (isKnownLocation) setValue('gold_located_at', '', { shouldDirty: true });
            } else {
              setValue('gold_located_at', v, { shouldDirty: true });
            }
          }}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="" disabled>
            Select location
          </option>
          {LOCATED_AT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={OTHERS}>Others…</option>
        </select>
        {locationMode === OTHERS && (
          <Input
            aria-label="Custom location"
            placeholder="Enter location"
            value={isKnownLocation ? '' : locatedAt}
            onChange={(e) => setValue('gold_located_at', e.target.value, { shouldDirty: true })}
          />
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs text-slate-700">
        <span>
          Weight:{' '}
          <span className="font-mono font-medium text-slate-800">
            {weight.toFixed(2)} g · {gramsToSovereigns(weight).toFixed(3)} sov
          </span>
        </span>
        <span>
          Purchased value:{' '}
          <span className="font-mono font-medium text-slate-800">{formatINR(value)}</span>
        </span>
      </div>

      <AddGoldCategoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(slug) => {
          // The category list refreshes via the query cache; just select it.
          setValue('gold_category', slug, { shouldDirty: true });
        }}
      />
    </div>
  );
}
