import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormPageShell } from '@/components/shared/FormPageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { TaxForm } from '@/components/taxes/TaxForm';
import { useTax, useCreateTax, useUpdateTax, toBackendTaxPayload } from '@/api/taxes';
import { usePayableChange } from '@/hooks/usePayableChange';
import type { TaxCreate, TaxType } from '@/types';

const FORM_ID = 'tax-form-page';

/** Full-page create (`/taxes/new`) and edit (`/taxes/:id/edit`) for taxes. */
export function TaxFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { data: tax, isLoading } = useTax(id);
  const createTax = useCreateTax();
  const updateTax = useUpdateTax();
  // Members add taxes outright; changing one goes through approval.
  const change = usePayableChange('tax');
  const viaApproval = editing && change.editMode === 'request';
  const submitting = createTax.isPending || updateTax.isPending || change.submitting;

  const handleSubmit = async (data: TaxCreate) => {
    if (editing && tax) {
      if (viaApproval) {
        await change.requestUpdate(tax.id, toBackendTaxPayload(data), tax);
      } else {
        await updateTax.mutateAsync({ id: tax.id, data });
      }
    } else {
      await createTax.mutateAsync(data);
    }
    navigate('/taxes');
  };

  if (editing && isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  }

  return (
    <FormPageShell
      breadcrumbs={[
        { label: 'Taxes', to: '/taxes' },
        { label: editing ? (tax?.description ?? 'Edit') : 'Add tax' },
      ]}
      title={editing ? 'Edit tax' : 'Add tax'}
      description={
        viaApproval
          ? 'Your changes go to an admin for approval before they take effect'
          : editing
            ? tax?.description
            : 'Register a tax obligation'
      }
      formId={FORM_ID}
      submitting={submitting}
      submitLabel={viaApproval ? 'Send for approval' : editing ? 'Save changes' : 'Create tax'}
      onCancel={() => navigate(-1)}
    >
      <TaxForm
        formId={FORM_ID}
        tax={editing ? tax : undefined}
        defaultType={(params.get('type') as TaxType | null) ?? undefined}
        defaultAssetId={params.get('asset_id') ?? undefined}
        onSubmit={handleSubmit}
      />
    </FormPageShell>
  );
}
