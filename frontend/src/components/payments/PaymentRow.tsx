import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatINR, getEntityTypeLabel, getPaymentMethodLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';
import type { Payment } from '@/types';

interface PaymentRowProps {
  payment: Payment;
  onReceipt?: (documentId: string) => void;
}

export function PaymentRow({ payment, onReceipt }: PaymentRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-800">{payment.entity_name}</p>
          <Badge variant="outline" className="shrink-0 text-slate-700">
            {getEntityTypeLabel(payment.entity_type)}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-600">
          {formatDate(payment.payment_date)} · {getPaymentMethodLabel(payment.payment_method)}
          {payment.reference_number ? ` · ${payment.reference_number}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
          {formatINR(payment.amount_paid)}
        </span>
        {payment.receipt_document_id && onReceipt && (
          <button
            type="button"
            onClick={() => onReceipt(payment.receipt_document_id as string)}
            aria-label="View receipt"
            className="rounded-md p-1.5 text-brand-navy hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
