import React from 'react';
import { daysUntil } from '@/utils/dates';

interface CountdownChipProps {
  dueDate: string;
  className?: string;
}

export const CountdownChip: React.FC<CountdownChipProps> = ({ dueDate, className = '' }) => {
  const days = daysUntil(dueDate);

  let label = '';
  let colorClass = '';

  if (days < 0) {
    label = 'Overdue';
    colorClass = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
  } else if (days === 0) {
    label = 'Due today';
    colorClass = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] font-semibold animate-pulse';
  } else if (days === 1) {
    label = '1 day remaining';
    colorClass = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
  } else if (days <= 7) {
    label = `${days} days remaining`;
    colorClass = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
  } else if (days <= 30) {
    label = `${days} days remaining`;
    colorClass = 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]';
  } else {
    label = `${days} days remaining`;
    colorClass = 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
};
export default CountdownChip;
