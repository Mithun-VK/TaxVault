import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { INSURANCE_TYPES, PREMIUM_FREQUENCIES, slugifyCategory } from '@/utils/constants';
import { loadCustomCategories, addCustomCategory } from '@/utils/customCategories';
import { toInputDate } from '@/utils/dates';
import { useAssets } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { isPropertyType } from '@/types';

/** Policy types that cover a person (link to an individual, not an asset). */
const PERSON_INSURANCE_TYPES = new Set(['life', 'term', 'health', 'medical']);

/** Sentinel for the "+ Add new category…" option in the insurance type select. */
const NEW_CATEGORY = '__new_insurance_category__';
import type {
  InsuranceCreate,
  InsurancePolicy,
  InsuranceType,
  PremiumFrequency,
} from '@/types';

const schema = z.object({
  name: z.string().optional(),
  policy_number: z.string().min(2, 'Policy number is required'),
  provider: z.string().min(2, 'Provider is required'),
  insurance_type: z.string().min(1, 'Select or add a category'),
  sum_insured: z.coerce.number().positive('Sum insured must be greater than zero'),
  premium_amount: z.coerce.number().positive('Premium must be greater than zero'),
  premium_frequency: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly', 'annual']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  next_premium_date: z.string().min(1, 'Next premium date is required'),
  linked_asset_id: z.string().optional(),
  nominee: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface PolicyFormProps {
  formId: string;
  policy?: InsurancePolicy;
  /** Pre-selected insurance type when adding from within a category. */
  defaultType?: InsuranceType;
  /** Pre-linked property when adding from a property's page. */
  defaultAssetId?: string;
  onSubmit: (data: InsuranceCreate) => Promise<void> | void;
}

export function PolicyForm({
  formId,
  policy,
  defaultType,
  defaultAssetId,
  onSubmit,
}: PolicyFormProps) {
  const { data: assets = [] } = useAssets();
  const { data: individualsData } = useIndividuals();
  const individuals = individualsData?.items ?? [];

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [customCats, setCustomCats] = useState(() => loadCustomCategories('insurance'));
  const typeCategories = [...INSURANCE_TYPES, ...customCats];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: policy?.name ?? '',
      policy_number: policy?.policy_number ?? '',
      provider: policy?.provider ?? '',
      insurance_type: policy?.insurance_type ?? defaultType ?? 'life',
      sum_insured: policy?.sum_insured ?? 0,
      premium_amount: policy?.premium_amount ?? 0,
      premium_frequency: policy?.premium_frequency ?? 'yearly',
      start_date: policy ? toInputDate(policy.start_date) : toInputDate(new Date()),
      end_date: policy ? toInputDate(policy.end_date) : '',
      next_premium_date: policy ? toInputDate(policy.next_premium_date) : toInputDate(new Date()),
      linked_asset_id:
        policy?.linked_asset_id ?? policy?.linked_individual_id ?? defaultAssetId ?? 'none',
      nominee: policy?.nominee ?? '',
      notes: policy?.notes ?? '',
    },
  });

  // What the "Linked …" field points at depends on the policy type:
  //  • life / term / health / medical → a person (individual)
  //  • vehicle → vehicle assets · property → land/buildings · other → any asset
  const insuranceType = watch('insurance_type');
  const isPersonPolicy = PERSON_INSURANCE_TYPES.has(insuranceType);
  const linkOptions = useMemo<{ id: string; name: string }[]>(() => {
    if (isPersonPolicy) return individuals.map((i) => ({ id: i.id, name: i.full_name }));
    const pool =
      insuranceType === 'vehicle'
        ? assets.filter((a) => a.asset_type === 'vehicle')
        : insuranceType === 'property'
          ? assets.filter((a) => isPropertyType(a.asset_type))
          : assets;
    return pool.map((a) => ({ id: a.id, name: a.name }));
  }, [assets, individuals, insuranceType, isPersonPolicy]);

  const submit = (values: FormValues) => {
    const linked =
      values.linked_asset_id && values.linked_asset_id !== 'none'
        ? values.linked_asset_id
        : null;
    const payload: InsuranceCreate = {
      ...values,
      insurance_type: values.insurance_type as InsuranceType,
      // Route the selected id to the asset link or the person link, never both.
      linked_asset_id: isPersonPolicy ? null : linked,
      linked_individual_id: isPersonPolicy ? linked : null,
    };
    return onSubmit(payload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. Ciaz Car Insurance" />
        <p className="text-xs text-slate-600">Shown on the calendar, payments &amp; reports.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="policy_number">Policy number</Label>
          <Input id="policy_number" {...register('policy_number')} />
          {errors.policy_number && (
            <p className="text-xs text-brand-danger">{errors.policy_number.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Input id="provider" {...register('provider')} />
          {errors.provider && (
            <p className="text-xs text-brand-danger">{errors.provider.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={addingNew ? NEW_CATEGORY : watch('insurance_type')}
            onValueChange={(v) => {
              if (v === NEW_CATEGORY) {
                setAddingNew(true);
                setNewName('');
                setValue('insurance_type', '');
                return;
              }
              setAddingNew(false);
              setValue('insurance_type', v);
              // Clear a now-irrelevant link (e.g. a vehicle when switching to property/life).
              setValue('linked_asset_id', 'none');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {typeCategories.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY}>+ Add new category…</SelectItem>
            </SelectContent>
          </Select>
          {addingNew && (
            <>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Input
                autoFocus
                value={newName}
                placeholder="e.g. Travel"
                onChange={(e) => {
                  setNewName(e.target.value);
                  setValue('insurance_type', slugifyCategory(e.target.value));
                }}
                onBlur={() => {
                  if (newName.trim()) {
                    setCustomCats(
                      addCustomCategory('insurance', newName, INSURANCE_TYPES.map((t) => t.value)),
                    );
                  }
                }}
              />
              <p className="text-xs text-slate-600">
                Saved as{' '}
                <span className="font-mono text-slate-700">{slugifyCategory(newName) || '…'}</span>
              </p>
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label>Premium frequency</Label>
          <Select
            value={watch('premium_frequency')}
            onValueChange={(v) => setValue('premium_frequency', v as PremiumFrequency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREMIUM_FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sum_insured">Sum insured (₹)</Label>
          <Input
            id="sum_insured"
            type="number"
            className="font-mono tabular-nums"
            {...register('sum_insured')}
          />
          {errors.sum_insured && (
            <p className="text-xs text-brand-danger">{errors.sum_insured.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="premium_amount">Premium (₹)</Label>
          <Input
            id="premium_amount"
            type="number"
            className="font-mono tabular-nums"
            {...register('premium_amount')}
          />
          {errors.premium_amount && (
            <p className="text-xs text-brand-danger">{errors.premium_amount.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start</Label>
          <Input id="start_date" type="date" {...register('start_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End</Label>
          <Input id="end_date" type="date" {...register('end_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next_premium_date">Next due</Label>
          <Input id="next_premium_date" type="date" {...register('next_premium_date')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{isPersonPolicy ? 'Linked person (optional)' : 'Linked asset (optional)'}</Label>
        <Select
          value={watch('linked_asset_id')}
          onValueChange={(v) => setValue('linked_asset_id', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {isPersonPolicy ? 'No linked person' : 'No linked asset'}
            </SelectItem>
            {linkOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nominee">Nominee</Label>
        <Input id="nominee" {...register('nominee')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>
    </form>
  );
}
