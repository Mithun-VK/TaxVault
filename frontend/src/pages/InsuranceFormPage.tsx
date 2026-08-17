import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormPageShell } from '@/components/shared/FormPageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { PolicyForm } from '@/components/insurance/PolicyForm';
import {
  useInsurancePolicy,
  useCreateInsurance,
  useUpdateInsurance,
  toBackendInsurancePayload,
} from '@/api/insurance';
import { usePayableChange } from '@/hooks/usePayableChange';
import type { InsuranceCreate, InsuranceType } from '@/types';

const FORM_ID = 'policy-form-page';

/** Full-page create (`/insurance/new`) and edit (`/insurance/:id/edit`). */
export function InsuranceFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { data: policy, isLoading } = useInsurancePolicy(id);
  const createInsurance = useCreateInsurance();
  const updateInsurance = useUpdateInsurance();
  // Members add policies outright; changing one goes through approval.
  const change = usePayableChange('insurance');
  const viaApproval = editing && change.editMode === 'request';
  const submitting = createInsurance.isPending || updateInsurance.isPending || change.submitting;

  const handleSubmit = async (data: InsuranceCreate) => {
    if (editing && policy) {
      if (viaApproval) {
        await change.requestUpdate(policy.id, toBackendInsurancePayload(data), policy);
      } else {
        await updateInsurance.mutateAsync({ id: policy.id, data });
      }
      navigate(`/insurance/${policy.id}`);
    } else {
      const created = await createInsurance.mutateAsync(data);
      navigate(`/insurance/${created.id}`);
    }
  };

  if (editing && isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  }

  return (
    <FormPageShell
      breadcrumbs={[
        { label: 'Insurance', to: '/insurance' },
        { label: editing ? (policy?.provider ?? 'Edit') : 'Add policy' },
      ]}
      title={editing ? 'Edit policy' : 'Add insurance policy'}
      description={
        viaApproval
          ? 'Your changes go to an admin for approval before they take effect'
          : editing
            ? policy?.provider
            : 'Register an insurance policy'
      }
      formId={FORM_ID}
      submitting={submitting}
      submitLabel={viaApproval ? 'Send for approval' : editing ? 'Save changes' : 'Create policy'}
      onCancel={() => navigate(-1)}
    >
      <PolicyForm
        formId={FORM_ID}
        policy={editing ? policy : undefined}
        defaultType={(params.get('type') as InsuranceType | null) ?? undefined}
        onSubmit={handleSubmit}
      />
    </FormPageShell>
  );
}
