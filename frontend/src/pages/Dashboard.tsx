import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  CalendarDays,
  FileUp,
  Activity,
} from 'lucide-react';

import { useObligations, useCreateObligation } from '@/api/obligations';
import { usePayments, useCreatePayment } from '@/api/payments';
import { useAlertLogs } from '@/api/alerts';
import { useDocumentUploadUrl, useCreateDocument } from '@/api/documents';

import { SummaryStatCard } from '@/components/SummaryStatCard';
import { DeadlineCalendar } from '@/components/DeadlineCalendar';
import { ObligationCard } from '@/components/ObligationCard';
import { SlideOverDrawer } from '@/components/SlideOverDrawer';
import { DocumentUploader } from '@/components/DocumentUploader';

import { formatINR, formatTaxType } from '@/utils/formatters';
import { daysUntil } from '@/utils/dates';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { isSameDay, parseISO } from 'date-fns';

// Form validation schemas
const obligationFormSchema = z.object({
  tax_type: z.enum(['income_tax', 'land_tax', 'advance_tax', 'gst', 'professional_tax', 'vehicle_tax', 'other']),
  description: z.string().min(3, 'Description must be at least 3 characters.').max(200),
  assessment_year: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in format YYYY-YY (e.g. 2024-25)'),
  jurisdiction: z.string().optional(),
  total_amount: z.preprocess((val) => Number(val), z.number().positive('Amount must be positive.')),
  due_date: z.string().min(1, 'Due date is required.'),
  recurrence_rule: z.enum(['NONE', 'ANNUAL', 'QUARTERLY', 'MONTHLY']).default('NONE'),
  notes: z.string().max(500).optional(),
});

const paymentFormSchema = z.object({
  obligation_id: z.string().min(1, 'Obligation selection is required.'),
  amount_paid: z.preprocess((val) => Number(val), z.number().positive('Amount must be positive.')),
  payment_date: z.string().min(1, 'Payment date is required.'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  receipt_filename: z.string().optional(),
  receipt_url: z.string().optional(),
});

type ObligationFormInputs = z.infer<typeof obligationFormSchema>;
type PaymentFormInputs = z.infer<typeof paymentFormSchema>;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  // Queries
  const { data: obligations = [] } = useObligations();
  const { data: payments = [] } = usePayments();
  const { data: alertLogs = [] } = useAlertLogs();

  // Mutations
  const createObligationMutation = useCreateObligation();
  const createPaymentMutation = useCreatePayment();
  const getUploadUrlMutation = useDocumentUploadUrl();
  const createDocumentMutation = useCreateDocument();

  // Quick Action Drawers states
  const [obligationDrawerOpen, setObligationDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  
  // Track uploaded receipt temporary state
  const [uploadedReceipt, setUploadedReceipt] = useState<{ filename: string; url: string } | null>(null);

  // Forms hooks
  const {
    register: regObl,
    handleSubmit: handleOblSubmit,
    setValue: setOblValue,
    formState: { errors: oblErrors },
    reset: resetOblForm,
  } = useForm<ObligationFormInputs>({
    resolver: zodResolver(obligationFormSchema),
    defaultValues: { recurrence_rule: 'NONE' },
  });

  const {
    register: regPay,
    handleSubmit: handlePaySubmit,
    setValue: setPayValue,
    watch: watchPay,
    formState: { errors: payErrors },
    reset: resetPayForm,
  } = useForm<PaymentFormInputs>({
    resolver: zodResolver(paymentFormSchema),
  });

  // Calculate summary statistics
  const stats = useMemo(() => {
    const active = obligations.filter((o) => !o.is_archived);
    const totalCount = active.length;
    
    // Due this month (June 2026 in our mock calendar frame)
    const dueThisMonth = active.filter((o) => {
      if (o.status === 'paid' || o.status === 'exempt') return false;
      const dueMonth = new Date(o.due_date).getMonth();
      const dueYear = new Date(o.due_date).getFullYear();
      return dueMonth === 5 && dueYear === 2026; // June 2026
    }).length;

    // Overdue count
    const overdueCount = active.filter((o) => o.status === 'overdue').length;

    // Total paid this FY (FY 2026-27 or FY 2025-26 - let's check payments from April 2026 onwards)
    const paidThisFY = payments
      .filter((p) => {
        const pDate = new Date(p.payment_date);
        return pDate >= new Date(2026, 3, 1) && pDate <= new Date(2027, 2, 31);
      })
      .reduce((acc, p) => acc + p.amount_paid, 0);

    return { totalCount, dueThisMonth, overdueCount, paidThisFY };
  }, [obligations, payments]);

  // Filters upcoming deadlines (show next 5 active or filter by selected date)
  const filteredObligations = useMemo(() => {
    let list = obligations.filter((o) => !o.is_archived && o.status !== 'paid' && o.status !== 'exempt');
    
    if (selectedCalendarDate) {
      list = list.filter((o) => isSameDay(parseISO(o.due_date), selectedCalendarDate));
    } else {
      // Default: sort by due date ascending
      list = [...list].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }

    return list.slice(0, 5);
  }, [obligations, selectedCalendarDate]);

  // Mutations handlers
  const onAddObligationSubmit = (data: ObligationFormInputs) => {
    createObligationMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Tax obligation created successfully.');
        resetOblForm();
        setObligationDrawerOpen(false);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to create obligation.');
      },
    });
  };

  const onLogPaymentSubmit = (data: PaymentFormInputs) => {
    const payload = {
      ...data,
      receipt_filename: uploadedReceipt?.filename || '',
      receipt_url: uploadedReceipt?.url || '',
    };
    createPaymentMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Payment transaction logged successfully.');
        resetPayForm();
        setUploadedReceipt(null);
        setPaymentDrawerOpen(false);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to log payment.');
      },
    });
  };

  // Mock receipt uploader for Payment Drawer
  const handleReceiptUpload = async (file: File) => {
    try {
      const res = await getUploadUrlMutation.mutateAsync();
      // Simulate calling direct R2 PUT, MSW captures it
      setUploadedReceipt({
        filename: file.name,
        url: res.file_url,
      });
      toast.success(`Receipt "${file.name}" uploaded successfully.`);
    } catch (e) {
      toast.error('Receipt upload failed.');
      throw e;
    }
  };

  // General Document Vault quick uploader
  const handleGeneralDocUpload = async (file: File) => {
    try {
      const res = await getUploadUrlMutation.mutateAsync();
      await createDocumentMutation.mutateAsync({
        label: file.name.split('.')[0] || 'General Document',
        category: 'other',
        financial_year: '2025-26',
        tags: ['QuickUpload', 'General'],
        file_size_kb: Math.floor(file.size / 1024),
        file_type: file.name.endsWith('.pdf') ? 'pdf' : file.name.match(/\.(docx|doc)$/) ? 'doc' : 'image',
        download_url: res.file_url,
      });
      toast.success(`Document "${file.name}" added to Vault library.`);
      setDocumentDrawerOpen(false);
    } catch (e) {
      toast.error('Document upload failed.');
    }
  };

  const selectedOblId = watchPay('obligation_id');
  const selectedObligation = obligations.find((o) => o.id === selectedOblId);

  return (
    <div className="space-y-6">
      {/* ── SUMMARY STAT ROW ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStatCard
          label="Active Obligations"
          value={stats.totalCount}
          icon={FileText}
        />
        <SummaryStatCard
          label="Due in June"
          value={stats.dueThisMonth}
          icon={Clock}
          colorVariant="warning"
        />
        <SummaryStatCard
          label="Overdue Obligations"
          value={stats.overdueCount}
          icon={AlertTriangle}
          colorVariant={stats.overdueCount > 0 ? 'danger' : 'default'}
        />
        <SummaryStatCard
          label="Total Paid (FY 26-27)"
          value={formatINR(stats.paidThisFY)}
          icon={TrendingUp}
          colorVariant="success"
        />
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setObligationDrawerOpen(true)}
          className="bg-brand-navy hover:bg-[#153264] text-white flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg"
        >
          <Plus size={16} />
          <span>Add Obligation</span>
        </Button>
        <Button
          onClick={() => setPaymentDrawerOpen(true)}
          className="bg-white border border-brand-navy text-brand-navy hover:bg-[#F0F4FA] flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg"
        >
          <Plus size={16} />
          <span>Log Payment</span>
        </Button>
        <Button
          onClick={() => setDocumentDrawerOpen(true)}
          className="bg-white border border-[#E2E6ED] text-text-primary hover:bg-slate-50 flex items-center gap-2 text-xs font-semibold px-4 py-2 h-9 rounded-lg"
        >
          <FileUp size={16} />
          <span>Upload Document</span>
        </Button>
      </div>

      {/* ── DASHBOARD GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns (Upcoming list) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-surface-border p-5 shadow-premium flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#E2E6ED] pb-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-brand-navy">
                  {selectedCalendarDate
                    ? `Obligations due on ${selectedCalendarDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Upcoming Deadlines'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Priority schedules requiring client settlement action.
                </p>
              </div>
              {selectedCalendarDate && (
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="text-xs font-semibold text-brand-navy hover:underline focus-visible:outline-none"
                >
                  Show All
                </button>
              )}
            </div>

            {filteredObligations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <div className="p-3 bg-[#F8FAFC] border rounded-full text-slate-300">
                  <CheckCircle size={28} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-primary">No deadlines found</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedCalendarDate
                      ? 'No active tax payments due on this specific date.'
                      : 'All tax obligations are currently completed.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredObligations.map((o) => (
                  <ObligationCard
                    key={o.id}
                    obligation={o}
                    onEdit={(item) => navigate(`/obligations?edit=${item.id}`)}
                    onLogPayment={(item) => navigate(`/payments?log=${item.id}`)}
                    onArchive={(item) => navigate(`/obligations?archive=${item.id}`)}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4 pt-3 border-t border-[#E2E6ED]/60">
              <button
                onClick={() => navigate('/obligations')}
                className="text-xs font-semibold text-brand-navy flex items-center gap-1 hover:underline"
              >
                <span>View all obligations</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-xl border border-surface-border p-5 shadow-premium">
            <div className="flex items-center gap-2 border-b border-[#E2E6ED] pb-3 mb-4">
              <Activity size={16} className="text-brand-navy" />
              <h2 className="text-sm font-semibold text-brand-navy">Recent activity log</h2>
            </div>
            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
              {alertLogs.slice(0, 10).map((log) => {
                const timeStr = new Date(log.timestamp).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const dateStr = new Date(log.timestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                });
                return (
                  <div key={log.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <span className="text-[10px] font-semibold text-text-muted shrink-0 w-20 text-right">
                      {dateStr}, {timeStr}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 shrink-0" />
                    <span className="text-text-primary flex-1">{log.message}</span>
                  </div>
                );
              })}
              {alertLogs.length === 0 && (
                <p className="text-center text-xs text-text-muted py-6">No recent logs recorded.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Calendar Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-surface-border p-4 shadow-premium">
            <div className="flex items-center gap-2 mb-3.5 px-1">
              <CalendarDays size={16} className="text-brand-navy" />
              <h2 className="text-sm font-semibold text-brand-navy">Deadline calendar</h2>
            </div>
            <DeadlineCalendar
              obligations={obligations}
              selectedDate={selectedCalendarDate}
              onDateSelect={setSelectedCalendarDate}
              className="border-none shadow-none p-0"
            />
            <div className="mt-4 pt-3 border-t border-[#E2E6ED] text-[10px] text-text-muted leading-relaxed">
              <div className="flex flex-wrap gap-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-navy" />
                  <span>Income Tax</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-teal" />
                  <span>GST</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  <span>Property Tax</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ADD OBLIGATION SLIDEOVER ── */}
      <SlideOverDrawer
        open={obligationDrawerOpen}
        onClose={() => {
          setObligationDrawerOpen(false);
          resetOblForm();
        }}
        title="Create Tax Obligation"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setObligationDrawerOpen(false);
                resetOblForm();
              }}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOblSubmit(onAddObligationSubmit)}
              disabled={createObligationMutation.isPending}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264]"
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tax Type</Label>
            <Select onValueChange={(val) => setOblValue('tax_type', val as any)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50">
                <SelectItem value="income_tax">Income Tax</SelectItem>
                <SelectItem value="land_tax">Property & Land Tax</SelectItem>
                <SelectItem value="advance_tax">Advance Tax</SelectItem>
                <SelectItem value="gst">GST</SelectItem>
                <SelectItem value="professional_tax">Professional Tax</SelectItem>
                <SelectItem value="vehicle_tax">Vehicle Road Tax</SelectItem>
                <SelectItem value="other">Other Tax</SelectItem>
              </SelectContent>
            </Select>
            {oblErrors.tax_type && (
              <span className="text-[10px] text-brand-danger font-medium">{oblErrors.tax_type.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description</Label>
            <Input
              placeholder="e.g. GST Quarterly Filing Q1"
              className="text-sm"
              {...regObl('description')}
            />
            {oblErrors.description && (
              <span className="text-[10px] text-brand-danger font-medium">{oblErrors.description.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assessment Year</Label>
            <Input
              placeholder="e.g. 2026-27"
              className="text-sm"
              {...regObl('assessment_year')}
            />
            {oblErrors.assessment_year && (
              <span className="text-[10px] text-brand-danger font-medium">{oblErrors.assessment_year.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Jurisdiction</Label>
            <Input
              placeholder="e.g. ward 12(1) Mumbai"
              className="text-sm"
              {...regObl('jurisdiction')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Total Amount (₹)</Label>
            <Input
              type="number"
              placeholder="15000"
              className="text-sm font-mono"
              {...regObl('total_amount')}
            />
            {oblErrors.total_amount && (
              <span className="text-[10px] text-brand-danger font-medium">{oblErrors.total_amount.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Due Date</Label>
            <Input
              type="date"
              className="text-sm"
              {...regObl('due_date')}
            />
            {oblErrors.due_date && (
              <span className="text-[10px] text-brand-danger font-medium">{oblErrors.due_date.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Recurrence Rule</Label>
            <Select
              defaultValue="NONE"
              onValueChange={(val) => setOblValue('recurrence_rule', val as any)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50">
                <SelectItem value="NONE">None</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <textarea
              rows={3}
              placeholder="Additional comments..."
              className="w-full text-sm border border-surface-border p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-navy"
              {...regObl('notes')}
            />
          </div>
        </div>
      </SlideOverDrawer>

      {/* ── LOG PAYMENT SLIDEOVER ── */}
      <SlideOverDrawer
        open={paymentDrawerOpen}
        onClose={() => {
          setPaymentDrawerOpen(false);
          resetPayForm();
          setUploadedReceipt(null);
        }}
        title="Log Tax Payment"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDrawerOpen(false);
                resetPayForm();
                setUploadedReceipt(null);
              }}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePaySubmit(onLogPaymentSubmit)}
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
            <Select onValueChange={(val) => setPayValue('obligation_id', val)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select obligation" />
              </SelectTrigger>
              <SelectContent className="bg-white border z-50">
                {obligations
                  .filter((o) => !o.is_archived && o.status !== 'paid')
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {formatTaxType(o.tax_type)} - {o.description} ({formatINR(o.total_amount)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {payErrors.obligation_id && (
              <span className="text-[10px] text-brand-danger font-medium">{payErrors.obligation_id.message}</span>
            )}
          </div>

          {selectedObligation && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3 rounded-lg text-xs leading-relaxed text-brand-navy">
              <p className="font-semibold">Remaining Total: {formatINR(selectedObligation.total_amount)}</p>
              <p className="mt-0.5">Due Date: {new Date(selectedObligation.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Amount Paid (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 50000"
              className="text-sm font-mono"
              {...regPay('amount_paid')}
            />
            {payErrors.amount_paid && (
              <span className="text-[10px] text-brand-danger font-medium">{payErrors.amount_paid.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Payment Date</Label>
            <Input
              type="date"
              className="text-sm"
              {...regPay('payment_date')}
            />
            {payErrors.payment_date && (
              <span className="text-[10px] text-brand-danger font-medium">{payErrors.payment_date.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reference / Challan Number</Label>
            <Input
              placeholder="e.g. CHN-29910"
              className="text-sm font-mono"
              {...regPay('reference_number')}
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
              placeholder="Additional references..."
              className="w-full text-sm border border-surface-border p-2 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-navy"
              {...regPay('notes')}
            />
          </div>
        </div>
      </SlideOverDrawer>

      {/* ── GENERAL DOCUMENT QUICK UPLOAD SLIDEOVER ── */}
      <SlideOverDrawer
        open={documentDrawerOpen}
        onClose={() => setDocumentDrawerOpen(false)}
        title="Upload Document"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Drag files directly to store them in your confidential library vault. Categories and fiscal years will be defaulted automatically, which can be modified under the "Documents" library section.
          </p>
          <DocumentUploader
            onUpload={handleGeneralDocUpload}
            acceptTypes=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            maxSizeMB={10}
          />
        </div>
      </SlideOverDrawer>
    </div>
  );
};
export default DashboardPage;
