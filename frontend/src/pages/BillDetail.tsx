import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, FileText, Download, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CountdownChip } from '@/components/shared/CountdownChip';
import { EmptyState } from '@/components/shared/EmptyState';
import { SlideOverDrawer } from '@/components/shared/SlideOverDrawer';
import { PaymentForm } from '@/components/shared/PaymentForm';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { PaymentRow } from '@/components/payments/PaymentRow';
import { useBill, useBillTrend } from '@/api/bills';
import { useEntityPayments } from '@/api/payments';
import { useEntityDocuments, useDownloadUrl, triggerDownload } from '@/api/documents';
import { PayableActions } from '@/components/shared/PayableActions';
import { useDeleteBill } from '@/api/bills';
import { BILL_TYPES, billPriority } from '@/utils/constants';
import { formatINR, getBillTypeColor, getBillTypeIcon, getStatusLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';


export function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const deleteBill = useDeleteBill();
  const { data: bill, isLoading } = useBill(id);
  const { data: payments = [] } = useEntityPayments(id);
  const { data: docs = [] } = useEntityDocuments(id);
  const downloadUrl = useDownloadUrl();

  const [payOpen, setPayOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const isVariable = bill ? billPriority(bill.bill_type) === 'variable' : false;
  const { data: trend } = useBillTrend(isVariable ? id : undefined);

  // BillTrend gives the last 6 payment amounts (no month labels), so points are
  // labelled by sequence.
  const chartData = useMemo(
    () => (trend?.amounts ?? []).map((amount, i) => ({ point: `#${i + 1}`, amount })),
    [trend],
  );

  const handleReceipt = async (docId: string) => {
    const url = await downloadUrl.mutateAsync(docId);
    triggerDownload(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!bill) {
    return (
      <EmptyState
        title="Bill not found"
        description="This bill may have been removed."
        action={
          <Button onClick={() => navigate('/bills')}>
            <ArrowLeft className="h-4 w-4" /> Back to bills
          </Button>
        }
      />
    );
  }

  const color = getBillTypeColor(bill.bill_type);
  const Icon = getBillTypeIcon(bill.bill_type);
  const typeMeta = BILL_TYPES.find((t) => t.value === bill.bill_type);

  const facts: [string, string][] = [
    ['Account number', bill.account_number || '—'],
    ['Bill type', typeMeta?.label ?? getStatusLabel(bill.bill_type)],
    ['Billing cycle', getStatusLabel(bill.billing_cycle)],
    [isVariable ? 'Average amount' : 'Amount', formatINR(bill.average_amount)],
    ['Next due', formatDate(bill.next_due_date)],
    ['Auto-pay', bill.auto_pay ? 'On' : 'Off'],
    ['Amount type', isVariable ? 'Variable — changes each cycle' : 'Fixed'],
  ];

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Bills', to: '/bills' },
          ...(typeMeta ? [{ label: typeMeta.label, to: `/bills?type=${bill.bill_type}` }] : []),
          { label: bill.name || bill.provider_name },
        ]}
      />

      <Card className="border-l-4 p-6" style={{ borderLeftColor: color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" style={{ color }}>
                  {typeMeta?.label}
                </Badge>
                <StatusBadge status={bill.status} />
                {bill.auto_pay && (
                  <Badge variant="active" className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Auto-pay
                  </Badge>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {bill.name || bill.provider_name}
              </h2>
              {bill.name && (
                <p className="text-sm text-slate-600">{bill.provider_name}</p>
              )}
              <p className="mt-0.5 text-sm text-slate-700">{bill.notes}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <CountdownChip date={bill.next_due_date} />
            <div className="flex items-center gap-2">
              <PayableActions
                entityType="bill"
                entityId={bill.id}
                entityName={bill.name || bill.provider_name}
                editPath={`/bills/${bill.id}/edit`}
                onDelete={() =>
                  deleteBill.mutate(bill.id, { onSuccess: () => navigate('/bills') })
                }
                deleting={deleteBill.isPending}
              />
              <Button variant="teal" onClick={() => setPayOpen(true)}>
                <Zap className="h-4 w-4" /> Record payment
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-600">{label}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue={isVariable ? 'trend' : 'payments'}>
        <TabsList>
          {isVariable && <TabsTrigger value="trend">Month-on-month</TabsTrigger>}
          <TabsTrigger value="payments">Payment history</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {isVariable && (
          <TabsContent value="trend">
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">Amount over time</p>
              <p className="mb-3 text-xs text-slate-700">
                How this bill has changed, derived from its payment history.
              </p>
              {chartData.length < 2 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  Not enough payment history yet to chart a trend.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="point" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </TabsContent>
        )}

        <TabsContent value="payments">
          <Card className="p-4">
            <p className="mb-1 text-sm font-semibold text-slate-900">Payment history</p>
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600">No payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {payments.map((p) => (
                  <PaymentRow key={p.id} payment={p} onReceipt={handleReceipt} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Documents</p>
              <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                <FileText className="h-4 w-4" /> Upload
              </Button>
            </div>
            {docs.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">No documents for this bill.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-brand-danger" />
                      <span className="truncate text-sm text-slate-700">{doc.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReceipt(doc.id)}
                      aria-label={`Download ${doc.label}`}
                      className="shrink-0 rounded-md p-1.5 text-brand-navy hover:bg-slate-100"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <SlideOverDrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Record payment"
        description={bill.provider_name}
      >
        <PaymentForm
          entityType="bill"
          entityId={bill.id}
          entityName={bill.provider_name}
          amount={bill.average_amount}
          onSuccess={() => setPayOpen(false)}
          onCancel={() => setPayOpen(false)}
        />
      </SlideOverDrawer>

      <SlideOverDrawer
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Upload document"
        description={`Attach a document to ${bill.provider_name}`}
      >
        <DocumentUploader
          entityType="bill"
          entityId={bill.id}
          defaultCategory="bill_copy"
          onUploaded={() => setUploadOpen(false)}
        />
      </SlideOverDrawer>
    </div>
  );
}
