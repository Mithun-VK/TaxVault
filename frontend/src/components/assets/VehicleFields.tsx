import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AssetFormValues } from './AssetForm';

export function VehicleFields({ register }: { register: UseFormRegister<AssetFormValues> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="vehicle_type">Vehicle type</Label>
        <select
          id="vehicle_type"
          {...register('vehicle_type')}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="car">Car</option>
          <option value="two_wheeler">Two Wheeler</option>
          <option value="truck">Truck / Commercial</option>
          <option value="tractor">Tractor</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="registration_number">Registration number</Label>
        <Input
          id="registration_number"
          placeholder="TN09AB1234"
          {...register('registration_number')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="make">Make</Label>
        <Input id="make" placeholder="Toyota" {...register('make')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Input id="model" placeholder="Fortuner" {...register('model')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="year">Year</Label>
        <Input id="year" type="number" {...register('year')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fuel_type">Fuel type</Label>
        <select
          id="fuel_type"
          {...register('fuel_type')}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Electric</option>
          <option value="cng">CNG</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="used_by">Used by</Label>
        <Input id="used_by" placeholder="Who uses this vehicle" {...register('used_by')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="purchase_price">Purchase price (₹)</Label>
        <Input id="purchase_price" type="number" {...register('purchase_price')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key_status">Key status</Label>
        <Input id="key_status" placeholder="Where the key is kept" {...register('key_status')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transfer_form">Transfer form</Label>
        <select
          id="transfer_form"
          {...register('transfer_form')}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="">Select</option>
          <option value="Available">Available</option>
          <option value="Not Available">Not Available</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hypothecation">Hypothecation</Label>
        <select
          id="hypothecation"
          {...register('hypothecation')}
          className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
    </div>
  );
}
