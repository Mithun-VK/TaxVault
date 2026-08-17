import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, queryClient } from './client';
import { useEntityInfoMap } from './entityInfo';
import { getEntityTypeLabel } from '@/utils/formatters';
import type {
  AlertBulkUpdate,
  AlertConfig,
  AlertConfigUpdate,
  AlertLog,
  WhatsAppStatus,
  WhatsAppTestResult,
} from '@/types';

interface BackendConfig {
  id: string;
  entity_type: string;
  entity_id: string;
  days_before: number[];
  channels: string[];
  is_active: boolean;
  created_at: string;
}

interface BackendLog {
  id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  days_before: number | null;
  sent_date: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

function toConfig(c: BackendConfig | AlertConfig, infoMap: Map<string, { name: string; amount: number; due_date: string }>): AlertConfig {
  // MSW mock mode already returns AlertConfig-shaped objects — pass through.
  if ('enabled' in c) return c;
  const match = infoMap.get(c.entity_id);
  return {
    id: c.id,
    entity_type: c.entity_type as AlertConfig['entity_type'],
    entity_id: c.entity_id,
    entity_name: match?.name ?? getEntityTypeLabel(c.entity_type as AlertConfig['entity_type']),
    due_date: match?.due_date ?? c.created_at.slice(0, 10),
    amount: match?.amount ?? 0,
    enabled: c.is_active,
    channels: c.channels as AlertConfig['channels'],
    days_before: c.days_before as AlertConfig['days_before'],
  };
}

function toLog(l: BackendLog | AlertLog): AlertLog {
  // MSW mock mode already returns AlertLog-shaped objects — pass through.
  if ('message' in l) return l;
  return {
    id: l.id,
    entity_type: l.entity_type as AlertLog['entity_type'],
    entity_id: l.entity_id,
    entity_name: getEntityTypeLabel(l.entity_type as AlertLog['entity_type']),
    channel: l.channel as AlertLog['channel'],
    status: l.status as AlertLog['status'],
    days_before: l.days_before ?? 0,
    message: l.error_message ?? `${l.channel} reminder sent`,
    sent_at: l.sent_at,
  };
}

export const useAlertConfigs = () => {
  // Shared, cached entity-info lookup (see entityInfo.ts) — AlertConfigOut has
  // no entity_name/amount/due_date, and this resolver is deduped across every
  // caller (payments, dashboard, alerts) via a single query key.
  const infoMap = useEntityInfoMap();

  const listQuery = useQuery({
    queryKey: ['alerts', 'configs'],
    queryFn: async () => {
      const { data } = await api.get<{ items: (BackendConfig | AlertConfig)[]; total: number }>(
        '/alerts/configs',
        { params: { limit: 100 } },
      );
      return data.items;
    },
  });

  const data = useMemo(() => {
    if (!listQuery.data) return listQuery.data;
    return listQuery.data.map((c) => toConfig(c, infoMap.data ?? new Map()));
  }, [listQuery.data, infoMap.data]);

  return { ...listQuery, data, isLoading: listQuery.isLoading || infoMap.isLoading };
};

export const useAlertLogs = (entityId?: string) =>
  useQuery({
    queryKey: ['alerts', 'logs', entityId ?? 'all'],
    queryFn: () =>
      api
        .get<{ items: (BackendLog | AlertLog)[]; total: number }>('/alerts/logs', { params: { limit: 100 } })
        .then((r) => r.data.items.map(toLog).filter((l) => !entityId || l.entity_id === entityId)),
  });

export const useUpdateAlertConfig = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: AlertConfigUpdate }) => {
      const { enabled, ...rest } = data;
      return api
        .patch<BackendConfig>(`/alerts/configs/${id}`, {
          ...rest,
          is_active: enabled,
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'configs'] });
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update alert settings'),
  });

/**
 * Apply one setting to every rule at once. The reminder schedule and channels
 * are a household-wide preference, so the settings page edits them here rather
 * than looping a request per payable.
 */
export const useBulkUpdateAlertConfigs = () =>
  useMutation({
    mutationFn: ({ enabled, ...rest }: AlertBulkUpdate) =>
      api
        .patch<{ updated: number }>('/alerts/configs', {
          ...rest,
          ...(enabled === undefined ? {} : { is_active: enabled }),
        })
        .then((r) => r.data),
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'configs'] });
      toast.success(updated === 0 ? 'Nothing to update' : `Updated ${updated} reminder rules`);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not update alert settings'),
  });

/** Whether Twilio can send, and to which (masked) number. */
export const useWhatsAppStatus = () =>
  useQuery({
    queryKey: ['alerts', 'whatsapp'],
    queryFn: () => api.get<WhatsAppStatus>('/alerts/whatsapp').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

/**
 * Send a real WhatsApp message down the same path an alert takes. The backend
 * reports a misconfiguration as `sent: false` with a reason rather than an
 * error status, so the toast can say what to fix.
 */
export const useSendWhatsAppTest = () =>
  useMutation({
    mutationFn: () =>
      api.post<WhatsAppTestResult>('/alerts/whatsapp/test').then((r) => r.data),
    onSuccess: (result) => {
      if (result.sent) toast.success(result.detail);
      else toast.error(result.detail);
    },
    onError: (error) => toast.error(getErrorMessage(error) || 'Could not send the test message'),
  });
