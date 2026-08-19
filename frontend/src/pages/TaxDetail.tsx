import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, FileText, Download, Link2, Receipt } from 'lucide-react';
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
import { useTax } from '@/api/taxes';
import { useEntityPayments } from '@/api/payments';
import { useEntityDocuments, useDownloadUrl, triggerDownload } from '@/api/documents';
import { PayableActions } from '@/components/shared/PayableActions';
import { useDeleteTax } from '@/api/taxes';
import { TAX_TYPES } from '@/utils/constants';
import { formatINR, getStatusLabel, getTaxTypeColor } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';

export function TaxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const deleteTax = useDeleteTax();
  const { data: tax, isLoading } = useTax(id);
  const { data: payments = [] } = useEntityPayments(id);
  const { data: docs = [] } = useEntityDocuments(id);
  const downloadUrl = useDownloadUrl();

  const [payOpen, setPayOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

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

  if (!tax) {
    return (
      <EmptyState
        title="Tax not found"
        description="This tax obligation may have been removed."
        action={
          <Button onClick={() => navigate('/taxes')}>
            <ArrowLeft className="h-4 w-4" /> Back to taxes
          </Button>
        }
      />
    );
  }

  const color = getTaxTypeColor(tax.tax_type);
  const typeMeta = TAX_TYPES.find((t) => t.value === tax.tax_type);
  const Icon = typeMeta?.icon ?? Receipt;
  const settled = tax.status === 'paid' || tax.status === 'exempt';

  const facts: [string, string][] = [
    ['Tax type', typeMeta?.label ?? getStatusLabel(tax.tax_type)],
    ...(tax.tax_number ? ([['Tax number', tax.tax_number]] as [string, string][]) : []),
    ['Assessment year', tax.assessment_year || '-'],
    ['Amount', formatINR(tax.total_amount)],
    ['Due date', formatDate(tax.due_date)],
    ['Status', getStatusLabel(tax.status)],
    ...(tax.paid_date ? ([['Paid date', formatDate(tax.paid_date)]] as [string, string][]) : []),
    ...(tax.linked_asset_name
      ? ([['Linked property', tax.linked_asset_name]] as [string, string][])
      : []),
  ];

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Taxes', to: '/taxes' },
          ...(typeMeta ? [{ label: typeMeta.label, to: `/taxes?type=${tax.tax_type}` }] : []),
          { label: tax.name || tax.description },
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
                  {typeMeta?.label ?? getStatusLabel(tax.tax_type)}
                </Badge>
                <StatusBadge status={tax.status} />
                {tax.linked_asset_name && (
                  <Badge variant="outline" className="gap-1 text-slate-700">
                    <Link2 className="h-3 w-3" /> {tax.linked_asset_name}
                  </Badge>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {tax.name || tax.description}
              </h2>
              {tax.notes && <p className="mt-0.5 text-sm text-slate-700">{tax.notes}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {!settled && <CountdownChip date={tax.due_date} />}
            <div className="flex items-center gap-2">
              <PayableActions
                entityType="tax"
                entityId={tax.id}
                entityName={tax.name || tax.description}
                editPath={`/taxes/${tax.id}/edit`}
                onDelete={() =>
                  deleteTax.mutate(tax.id, { onSuccess: () => navigate('/taxes') })
                }
                deleting={deleteTax.isPending}
              />
              {!settled && (
                <Button variant="teal" onClick={() => setPayOpen(true)}>
                  <Zap className="h-4 w-4" /> Record payment
                </Button>
              )}
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

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payment history</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

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
              <p className="py-2 text-sm text-slate-600">No documents for this tax.</p>
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
        description={tax.description}
      >
        <PaymentForm
          entityType="tax"
          entityId={tax.id}
          entityName={tax.description}
          amount={tax.total_amount}
          onSuccess={() => setPayOpen(false)}
          onCancel={() => setPayOpen(false)}
        />
      </SlideOverDrawer>

      <SlideOverDrawer
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Upload document"
        description={`Attach a document to ${tax.description}`}
      >
        <DocumentUploader
          entityType="tax"
          entityId={tax.id}
          defaultCategory="tax_receipt"
          onUploaded={() => setUploadOpen(false)}
        />
      </SlideOverDrawer>
    </div>
  );
}
