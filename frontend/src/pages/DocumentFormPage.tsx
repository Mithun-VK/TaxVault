import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { EmptyState } from '@/components/shared/EmptyState';
import { FolderOpen } from 'lucide-react';
import { useAssets } from '@/api/assets';
import { useBills } from '@/api/bills';
import { useTaxes } from '@/api/taxes';
import { useInsurancePolicies } from '@/api/insurance';
import { getAssetOwner } from '@/utils/formatters';
import type { DocumentCategory, PaymentEntityType } from '@/types';

interface EntityOption {
  id: string;
  name: string;
}

const ENTITY_TYPES: { value: PaymentEntityType; label: string; category: DocumentCategory }[] = [
  { value: 'asset', label: 'Properties', category: 'deed' },
  { value: 'bill', label: 'Bills', category: 'bill_receipt' },
  { value: 'tax', label: 'Taxes', category: 'tax_receipt' },
  { value: 'insurance', label: 'Insurance', category: 'policy_doc' },
];

/** Full-page upload (`/documents/new`): pick the entity, then attach the file. */
export function DocumentFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { data: assets = [] } = useAssets();
  const { data: bills = [] } = useBills();
  const { data: taxes = [] } = useTaxes();
  const { data: policies = [] } = useInsurancePolicies();

  const [uploadType, setUploadType] = useState<PaymentEntityType>(
    (params.get('type') as PaymentEntityType) || 'asset',
  );
  const [entityId, setEntityId] = useState(params.get('entity_id') ?? '');

  const optionsByType = useMemo<Record<string, EntityOption[]>>(
    () => ({
      asset: assets.map((a) => {
        const owner = getAssetOwner(a);
        return { id: a.id, name: owner ? `${a.name} · ${owner}` : a.name };
      }),
      bill: bills.map((b) => ({ id: b.id, name: b.provider_name || b.bill_type })),
      tax: taxes.map((t) => ({ id: t.id, name: t.description || t.tax_type })),
      insurance: policies.map((p) => ({ id: p.id, name: `${p.provider} · ${p.policy_number}` })),
    }),
    [assets, bills, taxes, policies],
  );

  const options = optionsByType[uploadType] ?? [];
  const category = ENTITY_TYPES.find((t) => t.value === uploadType)?.category ?? 'other';
  const hasAnyEntity = assets.length + bills.length + taxes.length + policies.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Breadcrumbs items={[{ label: 'Documents', to: '/documents' }, { label: 'Upload document' }]} />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Upload document</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Choose what this document belongs to, then add the file.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        {!hasAnyEntity ? (
          <EmptyState
            icon={FolderOpen}
            title="Nothing to attach to yet"
            description="Add a property, bill, tax or policy first, then upload its documents."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={uploadType}
                  onValueChange={(v) => {
                    setUploadType(v as PaymentEntityType);
                    setEntityId('');
                  }}
                >
                  <SelectTrigger aria-label="Document type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        disabled={(optionsByType[t.value] ?? []).length === 0}
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Belongs to</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger aria-label="Entity for this document">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {entityId ? (
              <DocumentUploader
                key={entityId}
                entityType={uploadType}
                entityId={entityId}
                defaultCategory={category}
                onUploaded={() => navigate('/documents')}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-surface-border py-6 text-center text-sm text-slate-600">
                Select what this document belongs to, above.
              </p>
            )}
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
