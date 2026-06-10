import React from 'react';
import { ObligationStatus } from '@/types';
import { getStatusLabel } from '@/utils/formatters';

interface StatusBadgeProps {
  status: ObligationStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const styles: Record<ObligationStatus, string> = {
    pending: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
    overdue: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
    paid: 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]',
    exempt: 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tabular-nums ${styles[status]} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
};
export default StatusBadge;
