import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { AssetRegisterReport, PayableEntityType, PayablesReport } from '@/types';

// Month-by-month spend per payable, for the Bills / Taxes / Insurance report
// tabs. type is one of the payable entity types.
export const usePayablesReport = (type: PayableEntityType, year: number) =>
  useQuery({
    queryKey: ['reports', 'payables', type, year],
    queryFn: () =>
      api
        .get<PayablesReport>('/reports/payables', { params: { type, year } })
        .then((r) => r.data),
    staleTime: 60_000,
  });

// Asset register with rolled-up tax/premium spend. vehicleOnly narrows to
// asset_type = vehicle for the Vehicles tab.
export const useAssetRegister = (vehicleOnly: boolean) =>
  useQuery({
    queryKey: ['reports', 'assets', vehicleOnly],
    queryFn: () =>
      api
        .get<AssetRegisterReport>('/reports/assets', { params: { vehicle_only: vehicleOnly } })
        .then((r) => r.data),
    staleTime: 60_000,
  });
