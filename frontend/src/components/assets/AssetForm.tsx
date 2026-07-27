import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ASSET_TYPES } from '@/utils/constants';
import { allOwners, loadCustomOwners, addCustomOwner } from '@/utils/owners';
import { canonicalOwner } from '@/utils/formatters';
import {
  normalizePropertyMetadata,
  KNOWN_PROPERTY_KEYS,
  PROPERTY_FIELDS,
  fieldAppliesToType,
} from '@/utils/propertyFields';
import { toInputDate } from '@/utils/dates';
import { PropertyFields } from './PropertyFields';
import { BuildingFields } from './BuildingFields';
import { VehicleFields } from './VehicleFields';
import { GoldFields } from './GoldFields';
import { hasMarketPrice, valuationMetadata } from '@/utils/buildings';
import { isPropertyType } from '@/types';
import type { Asset, AssetCreate, AssetMetadata, AssetType } from '@/types';

const assetSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  owner: z.string().min(1, 'Select an owner'),
  description: z.string().optional(),
  asset_type: z.enum([
    'land',
    'agricultural_land',
    'vacant_land',
    'non_agricultural_land',
    'vehicle',
    'building',
    'residential_building',
    'commercial_building',
    'gold',
    'other',
  ]),
  acquisition_date: z.string().optional(),
  acquisition_cost: z.coerce.number().optional(),
  notes: z.string().optional(),
  // Property (land & building) — canonical Property Details fields, in order.
  address: z.string().optional(),
  deed_type: z.string().optional(),
  deed_number: z.string().optional(),
  deed_date: z.string().optional(),
  registration_office: z.string().optional(),
  survey_number: z.string().optional(),
  land_area: z.string().optional(),
  buildup_area: z.string().optional(),
  patta_number: z.string().optional(),
  chitta: z.string().optional(),
  adangal: z.string().optional(),
  property_tax_number: z.string().optional(),
  water_tax_number: z.string().optional(),
  land_tax_number: z.string().optional(),
  eb_numbers: z.string().optional(),
  // Valuation — `current_value` is a first-class column; its as-of date is
  // auto-stamped on save.
  current_value: z.coerce.number().optional(),
  vehicle_type: z.string().optional(),
  registration_number: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional(),
  used_by: z.string().optional(),
  fuel_type: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  key_status: z.string().optional(),
  transfer_form: z.string().optional(),
  hypothecation: z.string().optional(),
  // Gold
  gold_category: z.string().optional(),
  gold_reference: z.string().optional(),
  gold_shop: z.string().optional(),
  gold_bill_number: z.string().optional(),
  gold_bill_date: z.string().optional(),
  gold_count: z.coerce.number().optional(),
  gold_purchased_value: z.coerce.number().optional(),
  gold_located_at: z.string().optional(),
  purity: z.string().optional(),
  weight_grams: z.coerce.number().optional(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;

/** Sentinel value for the "+ Add owner…" option in the owner select. */
const ADD_OWNER = '__add_owner__';

function buildMetadata(v: AssetFormValues): AssetMetadata {
  switch (v.asset_type) {
    case 'building':
    case 'residential_building':
    case 'commercial_building':
    case 'land':
    case 'agricultural_land':
    case 'vacant_land':
    case 'non_agricultural_land':
      // Canonical Property Details live in dedicated asset columns; the
      // valuation extras (buildup area, market price + auto date) are merged in
      // by submit() via valuationMetadata().
      return {};
    case 'vehicle':
      return {
        vehicle_type: v.vehicle_type,
        registration_number: v.registration_number,
        make: v.make,
        model: v.model,
        year: v.year,
        fuel_type: v.fuel_type,
        used_by: v.used_by,
        purchase_price: v.purchase_price,
        key_status: v.key_status,
        transfer_form: v.transfer_form,
        hypothecation: v.hypothecation,
      };
    case 'gold':
      return {
        category: v.gold_category,
        reference_number: v.gold_reference,
        shop_name: v.gold_shop,
        bill_number: v.gold_bill_number,
        bill_date: v.gold_bill_date,
        count: v.gold_count && v.gold_count > 0 ? v.gold_count : 1,
        purity: v.purity,
        weight_grams: v.weight_grams,
        purchased_value: v.gold_purchased_value,
        located_at: v.gold_located_at,
      };
    default:
      return {};
  }
}

interface AssetFormProps {
  formId: string;
  asset?: Asset;
  /** Pre-selected owner when creating an asset from within an owner's view. */
  defaultOwner?: string;
  /** Pre-selected asset type when creating (e.g. from a nav "+"). */
  defaultType?: AssetType;
  /** Pre-selected gold category when adding a jewel from inside a category. */
  defaultGoldCategory?: string;
  /** Hide the type selector and lock to defaultType (e.g. the Land/Gold "+"). */
  lockType?: boolean;
  onSubmit: (data: AssetCreate) => Promise<void> | void;
}

export function AssetForm({
  formId,
  asset,
  defaultOwner,
  defaultType,
  defaultGoldCategory,
  lockType,
  onSubmit,
}: AssetFormProps) {
  // Normalize on load so legacy keys (location, sro, extent_sqft, tneb_numbers…)
  // populate the canonical Property Details fields.
  const meta = normalizePropertyMetadata(asset?.metadata) as Record<string, unknown>;
  // Prefer the first-class column; fall back to (normalized) metadata.
  const cols = asset as unknown as Record<string, unknown> | undefined;
  const field = (key: string): string =>
    ((cols?.[key] as string | undefined) ?? (meta[key] as string | undefined) ?? '') as string;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: asset?.name ?? '',
      owner:
        canonicalOwner(field('owner_name') || (meta.owner as string) || undefined) ??
        defaultOwner ??
        '',
      description: asset?.description ?? '',
      asset_type: asset?.asset_type ?? defaultType ?? 'residential_building',
      acquisition_date: asset ? toInputDate(asset.acquisition_date) : toInputDate(new Date()),
      acquisition_cost: asset?.acquisition_cost || undefined,
      notes: asset?.notes ?? '',
      // Property Details (land & building), in canonical order — column or
      // metadata, resolved by field().
      address: field('address'),
      deed_type: field('deed_type'),
      deed_number: field('deed_number'),
      deed_date: field('deed_date'),
      registration_office: field('registration_office'),
      survey_number: field('survey_number'),
      land_area: field('land_area'),
      buildup_area: field('buildup_area'),
      patta_number: field('patta_number'),
      chitta: field('chitta'),
      adangal: field('adangal'),
      property_tax_number: field('property_tax_number'),
      water_tax_number: field('water_tax_number'),
      land_tax_number: field('land_tax_number'),
      eb_numbers: field('eb_numbers'),
      current_value: asset?.current_value || undefined,
      vehicle_type: (meta.vehicle_type as string) ?? 'car',
      registration_number: (meta.registration_number as string) ?? '',
      make: (meta.make as string) ?? '',
      model: (meta.model as string) ?? '',
      year: (meta.year as number) ?? undefined,
      used_by: (meta.used_by as string) ?? '',
      fuel_type: (meta.fuel_type as string) ?? '',
      purchase_price: (meta.purchase_price as number) ?? undefined,
      key_status: (meta.key_status as string) ?? '',
      transfer_form: (meta.transfer_form as string) ?? '',
      hypothecation: (meta.hypothecation as string) ?? '',
      gold_category: (meta.category as string) ?? defaultGoldCategory ?? 'chain',
      gold_reference: (meta.reference_number as string) ?? (meta.receipt_number as string) ?? '',
      gold_shop: (meta.shop_name as string) ?? '',
      gold_bill_number: (meta.bill_number as string) ?? '',
      gold_bill_date: meta.bill_date ? toInputDate(meta.bill_date as string) : '',
      gold_count: (meta.count as number) ?? 1,
      gold_purchased_value: (meta.purchased_value as number) ?? undefined,
      gold_located_at: (meta.located_at as string) ?? (meta.storage_location as string) ?? '',
      purity: (meta.purity as string) ?? '24K',
      weight_grams: (meta.weight_grams as number) ?? undefined,
    },
  });

  const assetType = watch('asset_type');
  const owner = watch('owner');

  // Owners: built-ins + user-added (persisted per-browser). "+ Add owner…" opens
  // an inline field to capture a new one.
  const [customOwners, setCustomOwners] = useState(() => loadCustomOwners());
  const [addingOwner, setAddingOwner] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const owners = allOwners(customOwners, owner);
  const commitNewOwner = () => {
    const name = newOwner.trim();
    if (!name) return;
    setCustomOwners(addCustomOwner(name));
    setValue('owner', name, { shouldDirty: true });
    setNewOwner('');
    setAddingOwner(false);
  };

  const submit = (values: AssetFormValues) => {
    const isProperty = isPropertyType(values.asset_type);
    const nz = (v?: string) => (v && v.trim() ? v.trim() : undefined);

    // Preserve extra metadata keys (deed_type, water_tax_id, lease_note, …) but
    // drop the canonical keys now that they live in dedicated columns.
    const extras: Record<string, unknown> = { ...(asset?.metadata ?? {}) };
    for (const key of KNOWN_PROPERTY_KEYS) delete extras[key];

    // Canonical Property Details split by storage: first-class columns vs
    // metadata-backed fields (deed_type, buildup_area, tax numbers).
    const propColumns: Record<string, unknown> = {};
    const propMeta: Record<string, unknown> = {};
    if (isProperty) {
      for (const f of PROPERTY_FIELDS) {
        if (f.key === 'owner_name') continue; // handled via the owner select
        if (!fieldAppliesToType(f, values.asset_type)) continue; // e.g. land tax vs property/water
        const val = nz((values as Record<string, unknown>)[f.key] as string | undefined);
        if (f.meta) propMeta[f.key] = val;
        else propColumns[f.key] = val;
      }
    }

    // Valuation for buildings and land: the current value is a first-class
    // column; its auto-stamped as-of date goes to metadata.
    const hasValuation = hasMarketPrice(values.asset_type);
    const currentValue =
      hasValuation && values.current_value && values.current_value > 0
        ? values.current_value
        : undefined;
    const valuation = hasValuation
      ? valuationMetadata(currentValue, asset?.current_value ?? null, asset?.metadata ?? null)
      : {};

    const payload: AssetCreate = {
      name: values.name,
      description: values.description,
      asset_type: values.asset_type,
      // Empty string must become undefined — the backend field is `date | None`
      // and cannot parse '' (assets with no acquisition date would 422 on save).
      acquisition_date: nz(values.acquisition_date),
      acquisition_cost: values.acquisition_cost || undefined,
      // Current value is editable for immovable properties (buildings + land);
      // its as-of date is auto-stamped in metadata (see valuation above).
      ...(hasValuation ? { current_value: currentValue } : {}),
      notes: values.notes,
      // Owner applies to every asset type; the rest are property-only.
      owner_name: nz(values.owner),
      ...(isProperty ? (propColumns as Partial<AssetCreate>) : {}),
      metadata: { ...extras, ...propMeta, ...buildMetadata(values), ...valuation },
    };
    return onSubmit(payload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Asset name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. Velachery Apartment" />
        {errors.name && <p className="text-xs text-brand-danger">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Owner</Label>
        <Select
          value={owner || undefined}
          onValueChange={(v) => {
            if (v === ADD_OWNER) {
              setAddingOwner(true);
              return;
            }
            setValue('owner', v, { shouldDirty: true });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an owner" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
            <SelectItem value={ADD_OWNER} className="text-brand-navy">
              + Add owner…
            </SelectItem>
          </SelectContent>
        </Select>
        {addingOwner && (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitNewOwner();
                }
              }}
              placeholder="New owner name"
            />
            <Button type="button" size="sm" onClick={commitNewOwner}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAddingOwner(false);
                setNewOwner('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        {errors.owner && <p className="text-xs text-brand-danger">{errors.owner.message}</p>}
      </div>

      {!lockType && (
        <div className="space-y-2">
          <Label>Asset type</Label>
          <Select value={assetType} onValueChange={(v) => setValue('asset_type', v as AssetType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="acquisition_date">Acquisition date</Label>
          <Input id="acquisition_date" type="date" {...register('acquisition_date')} />
        </div>
        {(isPropertyType(assetType) || assetType === 'other') && (
          <div className="space-y-2">
            <Label htmlFor="acquisition_cost">Purchase value (₹)</Label>
            <Input
              id="acquisition_cost"
              type="number"
              step="0.01"
              placeholder="Price at purchase"
              {...register('acquisition_cost')}
            />
          </div>
        )}
      </div>

      {assetType !== 'other' && (
        <div className="rounded-lg border border-surface-border bg-slate-50/50 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {isPropertyType(assetType) ? 'Property Details' : `${assetType} details`}
          </p>
          {isPropertyType(assetType) && (
            <PropertyFields
              register={register}
              watch={watch}
              setValue={setValue}
              assetType={assetType}
            />
          )}
          {hasMarketPrice(assetType) && (
            <div className="mt-4 border-t border-surface-border pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Valuation
              </p>
              <div className="grid grid-cols-2 gap-3">
                <BuildingFields register={register} />
              </div>
            </div>
          )}
          {assetType === 'vehicle' && <VehicleFields register={register} />}
          {assetType === 'gold' && (
            <GoldFields register={register} watch={watch} setValue={setValue} />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>
    </form>
  );
}
