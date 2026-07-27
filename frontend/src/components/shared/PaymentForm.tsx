import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, Check } from 'lucide-react';
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
import { DocumentUploader } from './DocumentUploader';
import { usePayTax } from '@/api/taxes';
import { usePayBill } from '@/api/bills';
import { usePayPremium } from '@/api/insurance';
import { PAYMENT_METHODS } from '@/utils/constants';
import { toInputDate } from '@/utils/dates';
import type { PayableEntityType } from '@/types';

const schema = z.object({
  amount_paid: z.coerce.number().positive('Amount must be greater than zero'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.string().min(1, 'Select a payment method'),
  reference_number: z.string().optional(),
  period: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface PaymentFormProps {
  entityType: PayableEntityType;
  entityId: string;
  entityName: string;
  amount?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({
  entityType,
  entityId,
  entityName,
  amount,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const payTax = usePayTax();
  const payBill = usePayBill();
  const payPremium = usePayPremium();
  const pay = entityType === 'tax' ? payTax : entityType === 'bill' ? payBill : payPremium;
  // The uploaded receipt is tagged with entityType/entityId (so it also shows on
  // the entity's Documents) AND linked to the payment row itself via
  // receipt_document_id, so the Payments ledger's Receipt column resolves it.
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount_paid: amount ?? 0,
      payment_date: toInputDate(new Date()),
      payment_method: 'upi',
      reference_number: '',
      period: '',
      notes: '',
    },
  });

  const method = watch('payment_method');

  const onSubmit = async (values: FormValues) => {
    await pay.mutateAsync({
      id: entityId,
      amount_paid: values.amount_paid,
      payment_date: values.payment_date,
      payment_method: values.payment_method,
      reference_number: values.reference_number,
      period: values.period,
      notes: values.notes,
      receipt_document_id: receiptId,
    });
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-700">Paying</span>{' '}
        <span className="font-medium text-slate-800">{entityName}</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount_paid">Amount paid (₹)</Label>
        <Input
          id="amount_paid"
          type="number"
          step="0.01"
          className="font-mono tabular-nums"
          {...register('amount_paid')}
        />
        {errors.amount_paid && (
          <p className="text-xs text-brand-danger">{errors.amount_paid.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="payment_date">Payment date</Label>
          <Input id="payment_date" type="date" {...register('payment_date')} />
          {errors.payment_date && (
            <p className="text-xs text-brand-danger">{errors.payment_date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setValue('payment_method', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="reference_number">Reference number</Label>
          <Input
            id="reference_number"
            placeholder="UPI / transaction reference"
            {...register('reference_number')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period">Period</Label>
          <Input
            id="period"
            placeholder={entityType === 'bill' ? 'e.g. Mar-May 2026' : 'e.g. 2026-27'}
            {...register('period')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>

      <div className="rounded-lg border border-surface-border p-3">
        {receiptId ? (
          <div className="flex items-center gap-2 text-sm text-brand-teal">
            <Check className="h-4 w-4" /> Receipt attached
          </div>
        ) : showUploader ? (
          <DocumentUploader
            entityType={entityType}
            entityId={entityId}
            defaultCategory="other"
            compact
            autoUpload
            onUploaded={(doc) => {
              setReceiptId(doc.id);
              setShowUploader(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-2 text-sm font-medium text-brand-navy"
          >
            <Paperclip className="h-4 w-4" /> Attach receipt
          </button>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="teal" disabled={pay.isPending}>
          {pay.isPending ? 'Saving…' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
