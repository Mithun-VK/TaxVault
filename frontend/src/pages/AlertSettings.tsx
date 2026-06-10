import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  Edit2,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { useObligations } from '@/api/obligations';
import { useAlertConfigs, useUpdateAlertConfig, useAlertLogs } from '@/api/alerts';
import { formatTaxType, formatDate } from '@/utils/formatters';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SlideOverDrawer } from '@/components/SlideOverDrawer';
import { TaxTypeBadge } from '@/components/TaxTypeBadge';

const availableThresholds = [30, 15, 7, 3, 1];

export const AlertSettingsPage: React.FC = () => {
  // Queries
  const { data: obligations = [] } = useObligations();
  const { data: configs = [] } = useAlertConfigs();
  const { data: logs = [] } = useAlertLogs();
  const updateConfigMutation = useUpdateAlertConfig();

  // Selected config for slide-over drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [activeHistoryObligationId, setActiveHistoryObligationId] = useState<string | null>(null);

  // Form states inside slide-over
  const [channelEmail, setChannelEmail] = useState(false);
  const [channelSMS, setChannelSMS] = useState(false);
  const [channelPush, setChannelPush] = useState(false);
  const [thresholds, setThresholds] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Calculate top summary parameters
  const totals = useMemo(() => {
    const sentCount = logs.filter((l) => l.status === 'sent').length;
    const failedCount = logs.filter((l) => l.status === 'failed').length;
    return { sentCount, failedCount };
  }, [logs]);

  // Handle Edit Config Click
  const handleOpenEdit = (config: any) => {
    setEditingConfigId(config.id);
    setChannelEmail(config.channels.includes('email'));
    setChannelSMS(config.channels.includes('sms'));
    setChannelPush(config.channels.includes('push'));
    setThresholds(config.thresholds);
    setIsActive(config.is_active);
    setDrawerOpen(true);
  };

  const handleToggleThreshold = (val: number) => {
    setThresholds((prev) =>
      prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val].sort((a, b) => b - a)
    );
  };

  const handleSaveConfig = () => {
    if (!editingConfigId) return;

    const channels: string[] = [];
    if (channelEmail) channels.push('email');
    if (channelSMS) channels.push('sms');
    if (channelPush) channels.push('push');

    updateConfigMutation.mutate(
      {
        id: editingConfigId,
        updates: {
          channels: channels as any[],
          thresholds,
          is_active: isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Alert configuration updated.');
          setDrawerOpen(false);
          setEditingConfigId(null);
        },
        onError: () => {
          toast.error('Failed to save configuration.');
        },
      }
    );
  };

  // Maps obligations to configurations
  const mappedConfigs = useMemo(() => {
    return obligations
      .filter((o) => !o.is_archived)
      .map((o) => {
        const config = configs.find((c) => c.obligation_id === o.id) || {
          id: '',
          obligation_id: o.id,
          channels: [],
          thresholds: [],
          is_active: false,
        };

        const oblLogs = logs.filter((l) => l.obligation_id === o.id).slice(0, 10);

        return {
          ...o,
          config,
          logs: oblLogs,
        };
      });
  }, [obligations, configs, logs]);

  return (
    <div className="space-y-6">
      {/* â”€â”€ ALERTS STATUS SUMMARY â”€â”€ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5 shadow-premium flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#14532D] uppercase tracking-wider block">Alerts Dispatched (This Month)</span>
            <span className="text-2xl font-bold font-mono text-[#14532D] tracking-tight tabular-nums">
              {totals.sentCount}
            </span>
          </div>
          <div className="p-3 bg-white border border-[#BBF7D0] rounded-lg text-[#14532D]">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className={`border rounded-xl p-5 shadow-premium flex items-center justify-between ${
          totals.failedCount > 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#F8FAFC] border-surface-border'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider block">Alert Failures</span>
            <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
              totals.failedCount > 0 ? 'text-[#991B1B]' : 'text-text-primary'
            }`}>
              {totals.failedCount}
            </span>
          </div>
          <div className={`p-3 rounded-lg ${
            totals.failedCount > 0 ? 'bg-white border border-[#FECACA] text-[#991B1B]' : 'bg-white border text-text-muted'
          }`}>
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* â”€â”€ ALERTS TABLE LISTING â”€â”€ */}
      <div className="bg-white border border-surface-border rounded-xl shadow-premium overflow-hidden">
        <div className="bg-slate-50 border-b border-surface-border px-5 py-4">
          <h3 className="text-sm font-semibold text-brand-navy">Active Alert Profiles</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Configure how and when TaxVault informs you about upcoming filing dates.
          </p>
        </div>

        <div className="divide-y divide-surface-border">
          {mappedConfigs.map((item) => {
            const hasHistory = item.logs.length > 0;
            const isHistoryOpen = activeHistoryObligationId === item.id;

            return (
              <div key={item.id} className="p-5 space-y-4 hover:bg-slate-50/10 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Name and tax badge */}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-semibold text-text-primary">{item.description}</h4>
                      <TaxTypeBadge taxType={item.tax_type} />
                      {!item.config.is_active && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-50 text-text-muted border border-surface-border text-[9px] font-medium uppercase tracking-wider">
                          <BellOff size={10} />
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      <Calendar size={12} />
                      <span>Due: {formatDate(item.due_date)}</span>
                    </div>
                  </div>

                  {/* Channel icons */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className={`p-1.5 rounded-full border ${
                        item.config.is_active && item.config.channels.includes('email')
                          ? 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]'
                          : 'bg-slate-50 text-slate-300 border-[#E2E6ED]'
                      }`} aria-label="Email alert active">
                        <Mail size={14} />
                      </span>
                      <span className={`p-1.5 rounded-full border ${
                        item.config.is_active && item.config.channels.includes('sms')
                          ? 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]'
                          : 'bg-slate-50 text-slate-300 border-[#E2E6ED]'
                      }`} aria-label="SMS alert active">
                        <MessageSquare size={14} />
                      </span>
                      <span className={`p-1.5 rounded-full border ${
                        item.config.is_active && item.config.channels.includes('push')
                          ? 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]'
                          : 'bg-slate-50 text-slate-300 border-[#E2E6ED]'
                      }`} aria-label="Push alerts active">
                        <Smartphone size={14} />
                      </span>
                    </div>

                    {/* Threshold pills */}
                    {item.config.is_active && item.config.thresholds.length > 0 && (
                      <div className="flex gap-1">
                        {item.config.thresholds.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] font-mono text-[9px] font-semibold tabular-nums"
                          >
                            {t}d
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit action */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenEdit(item.config)}
                      className="text-xs font-semibold h-8 border-[#E2E6ED] px-3 flex items-center gap-1.5 hover:bg-[#F0F4FA]"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </Button>

                    {hasHistory && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setActiveHistoryObligationId(isHistoryOpen ? null : item.id)
                        }
                        className="p-1 h-8 w-8 text-text-muted hover:text-text-primary"
                        aria-label="Toggle Alert History Logs"
                      >
                        {isHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* History Accordion content */}
                {hasHistory && isHistoryOpen && (
                  <div className="bg-slate-50 p-4 border border-[#E2E6ED] rounded-xl space-y-3">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
                      Dispatched Audit Trail
                    </span>
                    <div className="space-y-2.5">
                      {item.logs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {log.channel === 'email' ? (
                              <Mail size={12} className="text-text-muted" />
                            ) : log.channel === 'sms' ? (
                              <MessageSquare size={12} className="text-text-muted" />
                            ) : (
                              <Smartphone size={12} className="text-text-muted" />
                            )}
                            <span className="text-text-primary">{log.message}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
                            <span className="tabular-nums">
                              {new Date(log.timestamp).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {log.status === 'sent' ? (
                              <span className="text-[#14532D] font-bold">âœ“</span>
                            ) : (
                              <span className="text-[#991B1B] font-bold">âœ—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* â”€â”€ EDIT CHANNELS SLIDEOVER â”€â”€ */}
      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Configure Alert Settings"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDrawerOpen(false)}
              className="text-xs h-9 border-[#E2E6ED] hover:bg-[#F0F4FA]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              className="bg-brand-navy text-white text-xs h-9 hover:bg-[#153264]"
            >
              Save Profile
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Master Enable switch */}
          <div className="flex items-center justify-between bg-slate-50 border p-4 rounded-xl">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-brand-navy">Enable Alerts</Label>
              <p className="text-[10px] text-text-muted">Turn warning profiles on/off for this obligation.</p>
            </div>
            <Checkbox checked={isActive} onCheckedChange={(val: boolean | "indeterminate") => setIsActive(!!val)} className="w-5 h-5 border-[#E2E6ED] data-[state=checked]:bg-brand-navy" />
          </div>

          {/* Channel selections */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
              Channels
            </Label>
            
            <div className="space-y-2">
              {/* Email */}
              <div className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-xs text-text-primary">
                  <Mail size={16} className="text-brand-navy" />
                  <span>Email Notifications</span>
                </div>
                <Checkbox
                  disabled={!isActive}
                  checked={channelEmail}
                  onCheckedChange={(val: boolean | "indeterminate") => setChannelEmail(!!val)}
                  className="w-4 h-4 border-[#E2E6ED]"
                />
              </div>

              {/* SMS */}
              <div className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-xs text-text-primary">
                  <MessageSquare size={16} className="text-brand-navy" />
                  <span>SMS Mobile Alerts</span>
                </div>
                <Checkbox
                  disabled={!isActive}
                  checked={channelSMS}
                  onCheckedChange={(val: boolean | "indeterminate") => setChannelSMS(!!val)}
                  className="w-4 h-4 border-[#E2E6ED]"
                />
              </div>

              {/* Push */}
              <div className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-xs text-text-primary">
                  <Smartphone size={16} className="text-brand-navy" />
                  <span>Browser Push Alerts</span>
                </div>
                <Checkbox
                  disabled={!isActive}
                  checked={channelPush}
                  onCheckedChange={(val: boolean | "indeterminate") => setChannelPush(!!val)}
                  className="w-4 h-4 border-[#E2E6ED]"
                />
              </div>
            </div>
          </div>

          {/* Days before threshold selections */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
              Warning Thresholds (Days Before)
            </Label>
            
            <div className="grid grid-cols-2 gap-2">
              {availableThresholds.map((t) => (
                <div
                  key={t}
                  className="flex items-center justify-between border p-3 rounded-lg hover:bg-slate-50/50 text-xs text-text-primary"
                >
                  <span className="font-mono tabular-nums">{t} days before</span>
                  <Checkbox
                    disabled={!isActive}
                    checked={thresholds.includes(t)}
                    onCheckedChange={() => handleToggleThreshold(t)}
                    className="w-4 h-4 border-[#E2E6ED]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SlideOverDrawer>
    </div>
  );
};
export default AlertSettingsPage;

