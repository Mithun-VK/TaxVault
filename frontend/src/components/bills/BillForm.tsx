import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BILLING_CYCLES, allBillCategories, slugifyCategory } from '@/utils/constants';
import { useBills } from '@/api/bills';
import { toInputDate } from '@/utils/dates';
import type { Bill, BillCreate, BillType, BillingCycle } from '@/types';

/** Sentinel option that reveals the "new category" input. */
const NEW_CATEGORY = '__new__';

const schema = z.object({
  name: z.string().optional(),
  // Free-form so users can add their own categories (validated as a slug).
  bill_type: z.string().min(1, 'Select or add a category'),
  provider_name: z.string().min(2, 'Provider name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  average_amount: z.coerce.number().positive('Amount must be greater than zero'),
  billing_cycle: z.enum(['monthly', 'bi_monthly', 'bimonthly', 'quarterly', 'yearly', 'annual']),
  next_due_date: z.string().min(1, 'Next due date is required'),
  auto_pay: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BillFormProps {
  formId: string;
  bill?: Bill;
  /** Pre-selected bill type when adding from within a category. */
  defaultType?: BillType;
  onSubmit: (data: BillCreate) => Promise<void> | void;
}

export function BillForm({ formId, bill, defaultType, onSubmit }: BillFormProps) {
  // Built-in categories plus any custom ones already in use.
  const { data: bills = [] } = useBills();
  const categories = useMemo(() => allBillCategories(bills.map((b) => b.bill_type)), [bills]);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: bill?.name ?? '',
      bill_type: bill?.bill_type ?? defaultType ?? 'electricity',
      provider_name: bill?.provider_name ?? '',
      account_number: bill?.account_number ?? '',
      average_amount: bill?.average_amount ?? 0,
      billing_cycle: bill?.billing_cycle ?? 'monthly',
      next_due_date: bill ? toInputDate(bill.next_due_date) : toInputDate(new Date()),
      auto_pay: bill?.auto_pay ?? false,
      notes: bill?.notes ?? '',
    },
  });

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. EB - Trichy House" />
        <p className="text-xs text-slate-600">Shown on the calendar, payments &amp; reports.</p>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={addingNew ? NEW_CATEGORY : watch('bill_type')}
          onValueChange={(v) => {
            if (v === NEW_CATEGORY) {
              setAddingNew(true);
              setNewName('');
              setValue('bill_type', '');
            } else {
              setAddingNew(false);
              setValue('bill_type', v);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((t) => (
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
              placeholder="e.g. Cable TV"
              onChange={(e) => {
                setNewName(e.target.value);
                setValue('bill_type', slugifyCategory(e.target.value));
              }}
            />
            <p className="text-xs text-slate-600">
              Saved as{' '}
              <span className="font-mono text-slate-700">{slugifyCategory(newName) || '…'}</span>
            </p>
          </div>
        )}
        {errors.bill_type && (
          <p className="text-xs text-brand-danger">{errors.bill_type.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider_name">Provider name</Label>
        <Input id="provider_name" {...register('provider_name')} placeholder="e.g. TNEB" />
        {errors.provider_name && (
          <p className="text-xs text-brand-danger">{errors.provider_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="account_number">Account / consumer number</Label>
        <Input id="account_number" {...register('account_number')} />
        {errors.account_number && (
          <p className="text-xs text-brand-danger">{errors.account_number.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="average_amount">Average amount (₹)</Label>
          <Input
            id="average_amount"
            type="number"
            className="font-mono tabular-nums"
            {...register('average_amount')}
          />
          {errors.average_amount && (
            <p className="text-xs text-brand-danger">{errors.average_amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Billing cycle</Label>
          <Select
            value={watch('billing_cycle')}
            onValueChange={(v) => setValue('billing_cycle', v as BillingCycle)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_CYCLES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="next_due_date">Next due date</Label>
        <Input id="next_due_date" type="date" {...register('next_due_date')} />
        {errors.next_due_date && (
          <p className="text-xs text-brand-danger">{errors.next_due_date.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-surface-border px-3 py-2.5">
        <div>
          <Label className="text-sm">Auto-pay enabled</Label>
          <p className="text-xs text-slate-600">Bill is paid automatically each cycle</p>
        </div>
        <Switch checked={watch('auto_pay')} onCheckedChange={(c) => setValue('auto_pay', c)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>
    </form>
  );
}
