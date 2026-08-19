import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { useEntityInfoMap } from './entityInfo';
import { getEntityTypeLabel } from '@/utils/formatters';
import type { CalendarYearItem, DashboardData, PayableEntityType, UpcomingDeadline } from '@/types';

interface BackendSummary {
  total_assets_value: number;
  due_this_month: number;
  overdue_count: number;
  total_paid_this_fy: number;
}

interface BackendUpcoming {
  entity_type: string;
  entity_id: string;
  name: string;
  amount: number | null;
  due_date: string;
  days_remaining: number;
}

function toUpcoming(item: BackendUpcoming): UpcomingDeadline {
  return {
    id: `${item.entity_type}-${item.entity_id}`,
    entity_type: item.entity_type as UpcomingDeadline['entity_type'],
    entity_id: item.entity_id,
    name: item.name,
    amount: item.amount ?? 0,
    due_date: item.due_date,
    status: item.days_remaining <= 0 ? 'overdue' : 'pending',
  };
}

interface BackendActivity {
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  user_id: string;
}

export const useDashboard = () => {
  // The backend's recent-activity rows carry no entity name - resolve it
  // from the same shared, cached entity-info map used by payments/alerts.
  const infoMap = useEntityInfoMap();

  const baseQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [summary, upcoming, activity] = await Promise.all([
        api.get<BackendSummary>('/dashboard/summary').then((r) => r.data),
        api.get<BackendUpcoming[]>('/dashboard/upcoming').then((r) => r.data),
        api.get<BackendActivity[]>('/dashboard/recent-activity').then((r) => r.data),
      ]);
      return { summary, upcoming, activity };
    },
    staleTime: 30_000,
  });

  const data = useMemo<DashboardData | undefined>(() => {
    if (!baseQuery.data) return undefined;
    const { summary, upcoming, activity } = baseQuery.data;

    const overdueAmount = upcoming
      .filter((u) => u.days_remaining <= 0)
      .reduce((sum, u) => sum + (u.amount ?? 0), 0);

    return {
      stats: {
        total_asset_value: summary.total_assets_value,
        due_this_month: summary.due_this_month,
        overdue_amount: overdueAmount,
        overdue_count: summary.overdue_count,
        paid_this_fy: summary.total_paid_this_fy,
      },
      upcoming: upcoming.map(toUpcoming),
      activity: activity.map((a) => {
        const info = infoMap.data?.get(a.entity_id);
        const entityName = info?.name ?? getEntityTypeLabel(a.entity_type as PayableEntityType);
        return {
          id: `${a.entity_type}-${a.entity_id}-${a.created_at}`,
          action: a.action as DashboardData['activity'][number]['action'],
          entity_type: a.entity_type,
          entity_name: entityName,
          description: `${a.action.replace(/_/g, ' ')} - ${entityName}`,
          timestamp: a.created_at,
        };
      }),
    };
  }, [baseQuery.data, infoMap.data]);

  return { ...baseQuery, data, isLoading: baseQuery.isLoading || infoMap.isLoading };
};

// Every payable occurrence across a calendar year (recurring bills/taxes/premiums
// projected onto each month), powering the dashboard day × month grid.
export const useCalendarYear = (year: number) =>
  useQuery({
    queryKey: ['dashboard', 'calendar-year', year],
    queryFn: () =>
      api
        .get<CalendarYearItem[]>('/dashboard/calendar-year', { params: { year } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
