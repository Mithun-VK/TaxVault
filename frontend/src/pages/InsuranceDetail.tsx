import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, FileText, Download } from 'lucide-react';
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
import { PremiumTimeline } from '@/components/insurance/PremiumTimeline';
import { ClaimHistory } from '@/components/insurance/ClaimHistory';
import { AssetLinkedItems } from '@/components/assets/AssetLinkedItems';
import { useInsurancePolicy } from '@/api/insurance';
import { useAssets } from '@/api/assets';
import { PayableActions } from '@/components/shared/PayableActions';
import { useDeleteInsurance } from '@/api/insurance';
import { useEntityDocuments, useDownloadUrl, triggerDownload } from '@/api/documents';
import { INSURANCE_TYPES } from '@/utils/constants';
import { formatINR, getInsuranceTypeColor, getStatusLabel } from '@/utils/formatters';
import { formatDate } from '@/utils/dates';


export function InsuranceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const deletePolicy = useDeleteInsurance();
  const { data: policy, isLoading } = useInsurancePolicy(id);
  const { data: docs = [] } = useEntityDocuments(id);
  const { data: assets = [] } = useAssets();
  const downloadUrl = useDownloadUrl();
  const [payOpen, setPayOpen] = useState(false);

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

  if (!policy) {
    return (
      <EmptyState
        title="Policy not found"
        action={
          <Button onClick={() => navigate('/insurance')}>
            <ArrowLeft className="h-4 w-4" /> Back to insurance
          </Button>
        }
      />
    );
  }

  const color = getInsuranceTypeColor(policy.insurance_type);
  const typeMeta = INSURANCE_TYPES.find((t) => t.value === policy.insurance_type);

  // The policy's asset link is a real FK (insurance_policies.asset_id).
  const linkedAsset = policy.linked_asset_id
    ? assets.find((a) => a.id === policy.linked_asset_id)
    : undefined;

  const facts: [string, React.ReactNode][] = [
    ['Policy number', policy.policy_number],
    ['Provider', policy.provider],
    ['Sum insured', policy.sum_insured != null ? formatINR(policy.sum_insured) : '—'],
    ['Premium', `${formatINR(policy.premium_amount)} / ${getStatusLabel(policy.premium_frequency)}`],
    ['Start date', formatDate(policy.start_date)],
    ['End date', formatDate(policy.end_date)],
    ['Nominee', policy.nominee || '—'],
    ['Next premium', formatDate(policy.next_premium_date)],
    [
      'Linked property',
      linkedAsset ? (
        <Link to={`/assets/${linkedAsset.id}`} className="text-brand-navy hover:underline">
          {linkedAsset.name}
        </Link>
      ) : (
        '—'
      ),
    ],
  ];

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Insurance', to: '/insurance' },
          ...(typeMeta
            ? [{ label: typeMeta.label, to: `/insurance?type=${policy.insurance_type}` }]
            : []),
          { label: policy.name || policy.provider },
        ]}
      />

      <Card className="border-l-4 p-6" style={{ borderLeftColor: color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" style={{ color }}>
                {typeMeta?.label}
              </Badge>
              <StatusBadge status={policy.status} />
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {policy.name || policy.provider}
            </h2>
            {policy.name && <p className="text-sm text-slate-600">{policy.provider}</p>}
            <p className="mt-0.5 text-sm text-slate-700">{policy.notes}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {policy.status === 'active' && <CountdownChip date={policy.next_premium_date} />}
            <div className="flex items-center gap-2">
              <PayableActions
                entityType="insurance"
                entityId={policy.id}
                entityName={policy.provider}
                editPath={`/insurance/${policy.id}/edit`}
                onDelete={() =>
                  deletePolicy.mutate(policy.id, { onSuccess: () => navigate('/insurance') })
                }
                deleting={deletePolicy.isPending}
              />
              <Button
                variant="teal"
                onClick={() => setPayOpen(true)}
                disabled={policy.status !== 'active'}
              >
                <Wallet className="h-4 w-4" /> Record payment
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

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Premium schedule</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card className="p-5">
            <PremiumTimeline schedule={policy.schedule} />
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <ClaimHistory claims={policy.claims} />
        </TabsContent>

        <TabsContent value="documents">
          <AssetLinkedItems
            items={docs}
            getKey={(d) => d.id}
            emptyText="No documents linked to this policy."
            renderItem={(doc) => (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-brand-danger" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{doc.label}</p>
                    <p className="text-xs text-slate-600">{doc.financial_year}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleReceipt(doc.id)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          />
        </TabsContent>
      </Tabs>

      <SlideOverDrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Record payment"
        description={`${policy.provider} · ${policy.policy_number}`}
      >
        <PaymentForm
          entityType="insurance"
          entityId={policy.id}
          entityName={`${policy.provider} premium`}
          amount={policy.premium_amount}
          onSuccess={() => setPayOpen(false)}
          onCancel={() => setPayOpen(false)}
        />
      </SlideOverDrawer>

    </div>
  );
}
