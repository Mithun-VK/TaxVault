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
import { TAX_TYPES, slugifyCategory } from '@/utils/constants';
import { loadCustomCategories, addCustomCategory } from '@/utils/customCategories';
import { getFYOptions, toInputDate } from '@/utils/dates';
import { useAssets } from '@/api/assets';
import { useIndividuals } from '@/api/individuals';
import { isPropertyType } from '@/types';
import type { Tax, TaxCreate, TaxType } from '@/types';

/** Taxes that attach to a person (professional/income/GST/other) vs. a property. */
const PERSON_TAX_TYPES = new Set(['professional_tax', 'income_tax', 'gst', 'other']);

/** Sentinel for the "+ Add new category…" option in the tax type select. */
const NEW_CATEGORY = '__new_tax_category__';

const schema = z.object({
  name: z.string().optional(),
  tax_type: z.string().min(1, 'Select or add a category'),
  tax_number: z.string().optional(),
  description: z.string().min(2, 'Description is required'),
  linked_asset_id: z.string().optional(),
  assessment_year: z.string().min(1, 'Assessment year is required'),
  total_amount: z.coerce.number().positive('Amount must be greater than zero'),
  due_date: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface TaxFormProps {
  formId: string;
  tax?: Tax;
  /** Pre-selected tax type when adding from within a category. */
  defaultType?: TaxType;
  /** Pre-linked property when adding from a property's page. */
  defaultAssetId?: string;
  /** Pre-linked person when adding a personal tax from an individual's page. */
  defaultIndividualId?: string;
  onSubmit: (data: TaxCreate) => Promise<void> | void;
}

export function TaxForm({
  formId,
  tax,
  defaultType,
  defaultAssetId,
  defaultIndividualId,
  onSubmit,
}: TaxFormProps) {
  const { data: assets = [] } = useAssets();
  const { data: individualsData } = useIndividuals();
  const individuals = individualsData?.items ?? [];

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [customCats, setCustomCats] = useState(() => loadCustomCategories('tax'));
  const taxCategories = [...TAX_TYPES, ...customCats];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tax?.name ?? '',
      tax_type: tax?.tax_type ?? defaultType ?? 'property_tax',
      tax_number: tax?.tax_number ?? '',
      description: tax?.description ?? '',
      linked_asset_id:
        tax?.linked_asset_id ??
        tax?.individual_id ??
        defaultAssetId ??
        defaultIndividualId ??
        'none',
      assessment_year: tax?.assessment_year ?? getFYOptions()[1],
      total_amount: tax?.total_amount ?? 0,
      due_date: tax ? toInputDate(tax.due_date) : toInputDate(new Date()),
      notes: tax?.notes ?? '',
    },
  });

  const taxType = watch('tax_type');
  const linkedAsset = watch('linked_asset_id');

  // Property / land / water tax link to a property; professional / income / GST /
  // other link to a person.
  const isPersonTax = PERSON_TAX_TYPES.has(taxType);
  const linkOptions = useMemo<{ id: string; name: string }[]>(() => {
    if (isPersonTax) return individuals.map((i) => ({ id: i.id, name: i.full_name }));
    return assets.filter((a) => isPropertyType(a.asset_type)).map((a) => ({ id: a.id, name: a.name }));
  }, [assets, individuals, isPersonTax]);

  const submit = (values: FormValues) => {
    const linked =
      values.linked_asset_id && values.linked_asset_id !== 'none'
        ? values.linked_asset_id
        : null;
    const payload: TaxCreate = {
      name: values.name,
      tax_type: values.tax_type as TaxType,
      tax_number: values.tax_number,
      description: values.description,
      // Route the selected id to the property link or the person link, never both.
      linked_asset_id: isPersonTax ? null : linked,
      individual_id: isPersonTax ? linked : null,
      assessment_year: values.assessment_year,
      total_amount: values.total_amount,
      due_date: values.due_date,
      notes: values.notes,
    };
    return onSubmit(payload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. Neelangari House Property Tax" />
        <p className="text-xs text-slate-600">
          Shown on the calendar, payments &amp; reports. Defaults to the description if left blank.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tax type</Label>
        <Select
          value={addingNew ? NEW_CATEGORY : taxType}
          onValueChange={(v) => {
            if (v === NEW_CATEGORY) {
              setAddingNew(true);
              setNewName('');
              setValue('tax_type', '');
              return;
            }
            setAddingNew(false);
            setValue('tax_type', v);
            // Clear a now-irrelevant link when switching property ↔ person tax.
            setValue('linked_asset_id', 'none');
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {taxCategories.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
            <SelectItem value={NEW_CATEGORY}>+ Add new category…</SelectItem>
          </SelectContent>
        </Select>

        {addingNew && (
          <div className="space-y-1 pt-1">
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <Input
              autoFocus
              value={newName}
              placeholder="e.g. Sewage Tax"
              onChange={(e) => {
                setNewName(e.target.value);
                setValue('tax_type', slugifyCategory(e.target.value));
              }}
              onBlur={() => {
                if (newName.trim()) {
                  setCustomCats(addCustomCategory('tax', newName, TAX_TYPES.map((t) => t.value)));
                }
              }}
            />
            <p className="text-xs text-slate-600">
              Saved as{' '}
              <span className="font-mono text-slate-700">{slugifyCategory(newName) || '…'}</span>
            </p>
          </div>
        )}
        {errors.tax_type && (
          <p className="text-xs text-brand-danger">{errors.tax_type.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} placeholder="e.g. Property Tax H1" />
        {errors.description && (
          <p className="text-xs text-brand-danger">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tax_number">Tax number</Label>
        <Input id="tax_number" {...register('tax_number')} placeholder="e.g. 15 192 003226" />
        <p className="text-xs text-slate-600">
          Assessment / property / consumer number issued by the authority.
        </p>
      </div>

      <div className="space-y-2">
        <Label>{isPersonTax ? 'Linked person (optional)' : 'Linked property (optional)'}</Label>
        <Select value={linkedAsset} onValueChange={(v) => setValue('linked_asset_id', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {isPersonTax ? 'No linked person' : 'No linked property'}
            </SelectItem>
            {linkOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Assessment year</Label>
          <Select
            value={watch('assessment_year')}
            onValueChange={(v) => setValue('assessment_year', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getFYOptions().map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" type="date" {...register('due_date')} />
          {errors.due_date && (
            <p className="text-xs text-brand-danger">{errors.due_date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="total_amount">Total amount (₹)</Label>
        <Input
          id="total_amount"
          type="number"
          className="font-mono tabular-nums"
          {...register('total_amount')}
        />
        {errors.total_amount && (
          <p className="text-xs text-brand-danger">{errors.total_amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>
    </form>
  );
}
