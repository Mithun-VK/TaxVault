import React from 'react';
import { Obligation } from '@/types';
import { formatINR, formatDate } from '@/utils/formatters';
import { TaxTypeBadge } from './TaxTypeBadge';
import { StatusBadge } from './StatusBadge';
import { CountdownChip } from './CountdownChip';
import {
  MoreVertical,
  Edit,
  CreditCard,
  Archive,
  Bell,
  BellOff,
  Calendar,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ObligationCardProps {
  obligation: Obligation;
  onEdit: (o: Obligation) => void;
  onLogPayment: (o: Obligation) => void;
  onArchive: (o: Obligation) => void;
  className?: string;
}

const borderColors: Record<string, string> = {
  income_tax: '#1A3C6E',
  land_tax: '#7C3AED',
  advance_tax: '#0369A1',
  gst: '#0F6E56',
  professional_tax: '#92400E',
  vehicle_tax: '#9D174D',
  other: '#475569',
};

export const ObligationCard: React.FC<ObligationCardProps> = ({
  obligation,
  onEdit,
  onLogPayment,
  onArchive,
  className = '',
}) => {
  const accentColor = borderColors[obligation.tax_type] || borderColors.other;

  return (
    <div
      className={`bg-surface-card rounded-xl border border-surface-border shadow-premium overflow-hidden flex flex-col justify-between transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] ${className}`}
      style={{ borderLeftWidth: '4px', borderLeftColor: accentColor }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between pb-2">
        <TaxTypeBadge taxType={obligation.tax_type} />
        <div className="flex items-center gap-1.5">
          <StatusBadge status={obligation.status} />
          
          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded-md text-text-muted hover:bg-slate-50 hover:text-text-primary transition-all focus-visible:outline-none"
                aria-label="Actions"
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border border-surface-border rounded-lg shadow-md z-30">
              <DropdownMenuItem
                onClick={() => onEdit(obligation)}
                className="flex items-center gap-2 text-xs font-medium cursor-pointer py-2 px-3 text-text-primary hover:bg-[#F0F4FA]"
              >
                <Edit size={14} />
                <span>Edit Obligation</span>
              </DropdownMenuItem>
              {obligation.status !== 'paid' && (
                <DropdownMenuItem
                  onClick={() => onLogPayment(obligation)}
                  className="flex items-center gap-2 text-xs font-medium cursor-pointer py-2 px-3 text-[#0F6E56] hover:bg-[#F0FDF4]"
                >
                  <CreditCard size={14} />
                  <span>Log Payment</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onArchive(obligation)}
                className="flex items-center gap-2 text-xs font-medium cursor-pointer py-2 px-3 text-[#991B1B] hover:bg-[#FEF2F2]"
              >
                <Archive size={14} />
                <span>Archive</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-medium text-text-primary line-clamp-2 leading-relaxed mb-1">
            {obligation.description}
          </h4>
          {obligation.jurisdiction && (
            <p className="text-[11px] text-text-muted mb-3 truncate">
              {obligation.jurisdiction}
            </p>
          )}
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider block mb-0.5">
            Total Due (FY {obligation.assessment_year})
          </span>
          <span className="text-2xl font-semibold font-mono tracking-tight text-[#0F172A] tabular-nums">
            {formatINR(obligation.total_amount)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50/50 border-t border-[#E2E6ED]/60 flex items-center justify-between text-xs mt-auto">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Calendar size={13} />
          <span className="font-medium tabular-nums">{formatDate(obligation.due_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {obligation.alert_configured ? (
            <Bell size={13} className="text-[#0F6E56]" aria-label="Alerts active" />
          ) : (
            <BellOff size={13} className="text-slate-300" aria-label="Alerts inactive" />
          )}
          {obligation.status !== 'paid' && obligation.status !== 'exempt' && (
            <CountdownChip dueDate={obligation.due_date} />
          )}
        </div>
      </div>
    </div>
  );
};
export default ObligationCard;
