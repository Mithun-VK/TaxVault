import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROPERTY_FIELDS, fieldAppliesToType } from '@/utils/propertyFields';
import { LandAreaField } from './LandAreaField';
import type { AssetFormValues } from './AssetForm';

export function PropertyFields({
  register,
  watch,
  setValue,
  assetType,
}: {
  register: UseFormRegister<AssetFormValues>;
  watch: UseFormWatch<AssetFormValues>;
  setValue: UseFormSetValue<AssetFormValues>;
  assetType: string;
}) {
  // Owner Name is captured by the shared owner select above; render the rest of
  // the canonical fields that apply to this asset type (e.g. land-tax number for
  // land, property/water-tax numbers + buildup area for buildings).
  const formFields = PROPERTY_FIELDS.filter(
    (f) => f.key !== 'owner_name' && fieldAppliesToType(f, assetType),
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {formFields.map((f) =>
        // Land Area gets a magnitude + unit control with automatic conversion.
        f.key === 'land_area' ? (
          <LandAreaField key={f.key} watch={watch} setValue={setValue} />
        ) : (
          <div key={f.key} className={f.wide ? 'col-span-2 space-y-2' : 'space-y-2'}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type={f.input === 'date' ? 'date' : 'text'}
              placeholder={f.placeholder}
              {...register(f.key as keyof AssetFormValues)}
            />
          </div>
        ),
      )}
    </div>
  );
}
