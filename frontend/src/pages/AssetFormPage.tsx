import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FormPageShell } from '@/components/shared/FormPageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetForm } from '@/components/assets/AssetForm';
import { useAsset, useCreateAsset, useUpdateAsset } from '@/api/assets';
import type { AssetCreate, AssetType } from '@/types';

const FORM_ID = 'asset-form-page';

/** Full-page create (`/assets/new`) and edit (`/assets/:id/edit`) for assets. */
export function AssetFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { data: asset, isLoading } = useAsset(id);
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const submitting = createAsset.isPending || updateAsset.isPending;

  // Create-intent seed params: /assets/new?type=gold&gold_category=chain, or a
  // ?category=immovable|movable coming from the Properties category filter.
  const typeParam = params.get('type') as AssetType | null;
  const categoryParam = params.get('category');
  const defaultType =
    typeParam ??
    (categoryParam === 'movable'
      ? 'vehicle'
      : categoryParam === 'immovable'
        ? 'residential_building'
        : undefined);

  const handleSubmit = async (data: AssetCreate) => {
    if (editing && asset) {
      await updateAsset.mutateAsync({ id: asset.id, data });
      navigate(`/assets/${asset.id}`);
    } else {
      const created = await createAsset.mutateAsync(data);
      navigate(`/assets/${created.id}`);
    }
  };

  if (editing && isLoading) {
    return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  }

  return (
    <FormPageShell
      breadcrumbs={[
        { label: 'Properties', to: '/assets' },
        { label: editing ? (asset?.name ?? 'Edit') : 'Add property' },
      ]}
      title={editing ? 'Edit property' : 'Add property'}
      description={editing ? asset?.name : 'Register a new property in your vault'}
      formId={FORM_ID}
      submitting={submitting}
      submitLabel={editing ? 'Save changes' : 'Create property'}
      onCancel={() => navigate(-1)}
    >
      <AssetForm
        formId={FORM_ID}
        asset={editing ? asset : undefined}
        defaultType={editing ? undefined : (defaultType ?? undefined)}
        defaultOwner={params.get('owner') ?? undefined}
        defaultGoldCategory={params.get('gold_category') ?? undefined}
        lockType={!editing && !!typeParam}
        onSubmit={handleSubmit}
      />
    </FormPageShell>
  );
}
