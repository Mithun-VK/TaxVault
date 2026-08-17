import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormPageShell } from '@/components/shared/FormPageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { BillForm } from '@/components/bills/BillForm';
import { useBill, useCreateBill, useUpdateBill, toBackendBillPayload } from '@/api/bills';
import { usePayableChange } from '@/hooks/usePayableChange';
import type { BillCreate, BillType } from '@/types';

const FORM_ID = 'bill-form-page';

/** Full-page create (`/bills/new`) and edit (`/bills/:id/edit`) for bills. */
export function BillFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { data: bill, isLoading } = useBill(id);
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  // A member may add a bill outright but not change one — their edit is filed
  // for an admin to approve instead of being applied here.
  const change = usePayableChange('bill');
  const viaApproval = editing && change.editMode === 'request';
  const submitting = createBill.isPending || updateBill.isPending || change.submitting;

  const handleSubmit = async (data: BillCreate) => {
    if (editing && bill) {
      if (viaApproval) {
        await change.requestUpdate(bill.id, toBackendBillPayload(data), bill);
      } else {
        await updateBill.mutateAsync({ id: bill.id, data });
      }
      navigate(`/bills/${bill.id}`);
    } else {
      const created = await createBill.mutateAsync(data);
      navigate(`/bills/${created.id}`);
    }
  };

  if (editing && isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  }

  return (
    <FormPageShell
      breadcrumbs={[
        { label: 'Bills', to: '/bills' },
        { label: editing ? (bill?.provider_name ?? 'Edit') : 'Add bill' },
      ]}
      title={editing ? 'Edit bill' : 'Add bill'}
      description={
        viaApproval
          ? 'Your changes go to an admin for approval before they take effect'
          : editing
            ? bill?.provider_name
            : 'Track a recurring bill'
      }
      formId={FORM_ID}
      submitting={submitting}
      submitLabel={viaApproval ? 'Send for approval' : editing ? 'Save changes' : 'Create bill'}
      onCancel={() => navigate(-1)}
    >
      <BillForm
        formId={FORM_ID}
        bill={editing ? bill : undefined}
        defaultType={(params.get('type') as BillType | null) ?? undefined}
        onSubmit={handleSubmit}
      />
    </FormPageShell>
  );
}
