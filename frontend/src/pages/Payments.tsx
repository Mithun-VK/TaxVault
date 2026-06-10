import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  CreditCard,
  Plus,
  Calendar,
  Download,
  Info,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  Search,
} from 'lucide-react';

import { useObligations } from '@/api/obligations';
import { usePayments, useCreatePayment } from '@/api/payments';
import { useDocumentUploadUrl } from '@/api/documents';

import { formatINR, formatTaxType } from '@/utils/formatters';
import { daysUntil } from '@/utils/dates';
import { SlideOverDrawer } from '@/components/SlideOverDrawer';
import { DocumentUploader } from '@/components/DocumentUploader';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { TaxTypeBadge } from '@/components/TaxTypeBadge';

// Form schema
const paymentFormSchema = z.object({
  obligation_id: z.string().min(1, 'Please select an obligation.'),
  amount_paid: z.preprocess((val) => Number(val), z.number().positive('Amount must be positive.')),
  payment_date: z.string().min(1, 'Payment date is required.'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormInputs = z.infer<typeof paymentFormSchema>;

export const PaymentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Queries
  const { data: obligations = [] } = useObligations();
  const { data: payments = [] } = usePayments();
  const createPaymentMutation = useCreatePayment();
  const getUploadUrlMutation = useDocumentUploadUrl();

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [targetObligationId, setTargetObligationId] = useState<string | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<{ filename: string; url: string } | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All'); // All, Unpaid, Partially Paid, Paid

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<PaymentFormInputs>({
    resolver: zodResolver(paymentFormSchema),
  });

  const selectedOblId = watch('obligation_id');

  // Load log obligation context from URL query param
  useEffect(() => {
    const logOblId = searchParams.get('log');
    if (logOblId) {
      const item = obligations.find((o) => o.id === logOblId);
      if (item) {
        handleOpenLogPayment(item.id);
      }
    }
  }, [searchParams, obligations]);

  const handleOpenLogPayment = (obligationId: string) => {
    setTargetObligationId(obligationId);
    setValue('obligation_id', obligationId);
    setValue('payment_date', new Date().toISOString().slice(0, 10)); // Default to today
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTargetObligationId(null);
    setUploadedReceipt(null);
    reset();

    // Clear URL parameters
    const params = new URLSearchParams(searchParams);
    params.delete('log');
    setSearchParams(params);
  };

  const onLogPaymentSubmit = (data: PaymentFormInputs) => {
    const payload = {
      ...data,
      receipt_filename: uploadedReceipt?.filename || '',
      receipt_url: uploadedReceipt?.url || '',
    };
    createPaymentMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Payment logged successfully.');
        handleCloseDrawer();
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to log payment.');
      },
    });
  };

  const handleReceiptUpload = async (file: File) => {
    try {
      const res = await getUploadUrlMutation.mutateAsync();
      setUploadedReceipt({
        filename: file.name,
        url: res.file_url,
      });
      toast.success('Receipt file uploaded.');
    } catch (e) {
      toast.error('File upload failed.');
    }
  };

  // Computations for calculations
  const parsedObligations = useMemo(() => {
    return obligations
      .filter((o) => !o.is_archived)
      .map((o) => {
        const oblPayments = payments.filter((p) => p.obligation_id === o.id);
        const amountPaid = oblPayments.reduce((acc, p) => acc + p.amount_paid, 0);
        const outstandingBalance = o.status === 'exempt' ? 0 : Math.max(0, o.total_amount - amountPaid);
        
        let paymentStatus: 'unpaid' | 'partial' | 'paid' | 'exempt' = 'unpaid';
        if (o.status === 'exempt') {
          paymentStatus = 'exempt';
        } else if (amountPaid >= o.total_amount) {
          paymentStatus = 'paid';
        } else if (amountPaid > 0) {
          paymentStatus = 'partial';
        }

        return {
          ...o,
          amountPaid,
          outstandingBalance,
          paymentStatus,
          paymentHistory: oblPayments,
        };
      });
  }, [obligations, payments]);

  // Aggregate sums for top banner
  const aggregates = useMemo(() => {
    let totalOutstanding = 0;
    let totalPaidThisFY = 0;

    parsedObligations.forEach((o) => {
      totalOutstanding += o.outstandingBalance;
    });

    payments.forEach((p) => {
      const pDate = new Date(p.payment_date);
      // FY 2026-27 or FY 2025-26 - check payments from April 2026 onwards
      if (pDate >= new Date(2026, 3, 1) && pDate <= new Date(2027, 2, 31)) {
        totalPaidThisFY += p.amount_paid;
      }
    });

    return { totalOutstanding, totalPaidThisFY };
  }, [parsedObligations, payments]);

  // Filter lists based on inputs
  const filteredObligations = useMemo(() => {
    return parsedObligations.filter((o) => {
      const matchesSearch =
        o.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.assessment_year.includes(searchQuery);

      const matchesStatus =
        paymentStatusFilter === 'All' ||
        (paymentStatusFilter === 'Unpaid' && o.paymentStatus === 'unpaid') ||
        (paymentStatusFilter === 'Partially Paid' && o.paymentStatus === 'partial') ||
        (paymentStatusFilter === 'Fully Paid' && o.paymentStatus === 'paid') ||
        (paymentStatusFilter === 'Exempt' && o.paymentStatus === 'exempt');

      return matchesSearch && matchesStatus;
    });
  }, [parsedObligations, searchQuery, paymentStatusFilter]);

  const selectedObligationDetails = obligations.find((o) => o.id === selectedOblId);

  return (
    <div className="space-y-6">
      {/* ── TOP SUMMARY BAR ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-5 shadow-premium flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#1A3C6E] uppercase tracking-wider block">Total Outstanding Balance</span>
            <span className="text-2xl font-bold font-mono text-brand-navy tracking-tight tabular-nums">
              {formatINR(aggregates.totalOutstanding)}
            </span>
          </div>
          <div className="p-3 bg-white border border-[#BFDBFE] rounded-lg text-brand-navy">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5 shadow-premium flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#14532D] uppercase tracking-wider block">Total Paid (Current FY)</span>
            <span className="text-2xl font-bold font-mono text-[#14532D] tracking-tight tabular-nums">
              {formatINR(aggregates.totalPaidThisFY)}
            </span>
          </div>
          <div className="p-3 bg-white border border-[#BBF7D0] rounded-lg text-[#14532D]">
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* ── FILTER HEADER ── */}
      <div className="bg-white p-4 rounded-xl border border-surface-border shadow-premium flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-3 text-text-muted" />
            <Input
              placeholder="Search by tax description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm border-[#E2E6ED]"
            />
          </div>

          <div>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="text-xs border-[#E2E6ED]">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs">
                <SelectItem value="All">All Payments Statuses</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Fully Paid">Fully Paid</SelectItem>
                <SelectItem value="Exempt">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end items-center">
            <Button
              onClick={() => {
                setValue('obligation_id', '');
                setDrawerOpen(true);
              }}
              className="bg-brand-navy hover:bg-[#153264] text-white flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg w-full sm:w-auto"
            >
              <Plus size={16} />
              <span>Log Payment</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── ACCORDION GROUPINGS ── */}
      {filteredObligations.length === 0 ? (
        <div className="bg-white border rounded-xl shadow-premium p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto">
          <div className="w-20 h-20 bg-[#F8FAFC] border rounded-full flex items-center justify-center text-slate-300">
            <CreditCard size={32} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-brand-navy">No records found</h3>
            <p className="text-xs text-text-muted max-w-sm leading-relaxed">
              No matching obligations or tax payments have been logged for this selection.
            </p>
          </div>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-3">
          {filteredObligations.map((o) => (
            <AccordionItem
              key={o.id}
              value={o.id}
              className="bg-white border border-surface-border rounded-xl shadow-premium px-5 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4 flex items-center justify-between text-left group">
                <div className="flex flex-wrap items-center gap-4 flex-1 pr-4">
                  <TaxTypeBadge taxType={o.tax_type} className="shrink-0" />
                  <div className="min-w-[180px] max-w-[280px]">
                    <h4 className="text-xs font-semibold text-text-primary group-hover:text-brand-navy truncate">
                      {o.description}
                    </h4>
                    <span className="text-[10px] text-text-muted block mt-0.5">FY {o.assessment_year}</span>
                  </div>

                  {/* Financials details inside header */}
                  <div className="flex gap-4 ml-auto text-xs pr-4">
                    <div className="hidden sm:block">
                      <span className="text-[10px] text-text-muted block">Total Due</span>
                      <span className="font-mono font-medium tabular-nums">{formatINR(o.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">Paid</span>
                      <span className="font-mono font-medium text-[#14532D] tabular-nums">{formatINR(o.amountPaid)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block">Outstanding</span>
                      <span className={`font-mono font-semibold tabular-nums ${o.outstandingBalance > 0 ? 'text-[#991B1B]' : 'text-[#14532D]'}`}>
                        {formatINR(o.outstandingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t border-[#E2E6ED]/60 pt-4 pb-5 space-y-4">
                {/* Ledger actions */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-brand-navy uppercase tracking-wider text-[10px]">
                    Payment History Ledger
                  </span>
                  {o.outstandingBalance > 0 && (
                    <button
                      onClick={() => handleOpenLogPayment(o.id)}
                      className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1 focus-visible:outline-none"
                    >
                      <span>Log new payment</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>

                {/* History table */}
                {o.paymentHistory.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-text-muted">
                    No payment transactions logged against this obligation.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-surface-border rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 border-b border-surface-border font-semibold text-brand-navy">
                        <tr>
                          <th className="p-3">Payment Date</th>
                          <th className="p-3">Reference No</th>
                          <th className="p-3">Amount Paid</th>
                          <th className="p-3">Notes</th>
                          <th className="p-3 text-right">Attachment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {o.paymentHistory.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium tabular-nums">
                              {new Date(p.payment_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="p-3 font-mono text-text-muted">{p.reference_number || 'N/A'}</td>
                            <td className="p-3 font-mono font-medium text-[#14532D] tabular-nums">
                              {formatINR(p.amount_paid)}
                            </td>
                            <td className="p-3 text-text-muted max-w-[200px] truncate">{p.notes || '-'}</td>
                            <td className="p-3 text-right">
                              {p.receipt_filename ? (
                                <a
                                  href={p.receipt_url}
                                  download={p.receipt_filename}
                                  className="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                                >
                                  <Download size={13} />
                                  <span className="max-w-[120px] truncate">{p.receipt_filename}</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-300">No Receipt</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* ── LOG PAYMENT DRAWER ── */}
      <SlideOverDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title="Log Tax Payment"
        footer={
          <>
            <Button
              variant="outline"
              onClick={handleCloseDrawer}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onLogPaymentSubmit)}
              disabled={createPaymentMutation.isPending}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264]"
            >
              Log Payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tax Obligation</Label>
            <Select
              defaultValue={targetObligationId || undefined}
              value={watch('obligation_id')}
              onValueChange={(val) => setValue('obligation_id', val)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select obligation" />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50 text-xs">
                {obligations
                  .filter((o) => !o.is_archived && o.status !== 'paid')
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {formatTaxType(o.tax_type)} - {o.description} ({formatINR(o.total_amount)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.obligation_id && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.obligation_id.message}</span>
            )}
          </div>

          {selectedObligationDetails && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3 rounded-lg text-xs leading-relaxed text-brand-navy">
              <p className="font-semibold">Remaining Total: {formatINR(selectedObligationDetails.total_amount)}</p>
              <p className="mt-0.5">Due Date: {new Date(selectedObligationDetails.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Amount Paid (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 25000"
              className="text-sm font-mono border-surface-border"
              {...register('amount_paid')}
            />
            {errors.amount_paid && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.amount_paid.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Payment Date</Label>
            <Input
              type="date"
              className="text-sm border-surface-border"
              {...register('payment_date')}
            />
            {errors.payment_date && (
              <span className="text-[10px] text-brand-danger font-medium">{errors.payment_date.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reference / Challan Number</Label>
            <Input
              placeholder="e.g. UPI-288102919"
              className="text-sm font-mono border-surface-border"
              {...register('reference_number')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Attach Receipt</Label>
            <DocumentUploader
              onUpload={handleReceiptUpload}
              acceptTypes=".pdf,.png,.jpg,.jpeg"
              maxSizeMB={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <textarea
              rows={3}
              placeholder="E.g. Paid via HDFC Corporate bank transfer. Verified."
              className="w-full text-sm border border-surface-border p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-navy"
              {...register('notes')}
            />
          </div>
        </div>
      </SlideOverDrawer>
    </div>
  );
};
export default PaymentsPage;
