import React from 'react';
import { TaxType } from '@/types';
import { formatTaxType } from '@/utils/formatters';
import {
  FileText,
  Home,
  TrendingUp,
  Briefcase,
  Award,
  Car,
  HelpCircle,
} from 'lucide-react';

interface TaxTypeBadgeProps {
  taxType: TaxType;
  className?: string;
}

export const TaxTypeBadge: React.FC<TaxTypeBadgeProps> = ({ taxType, className = '' }) => {
  const config: Record<TaxType, { icon: React.ComponentType<any>; color: string; bg: string }> = {
    income_tax: { icon: FileText, color: '#1A3C6E', bg: 'rgba(26, 60, 110, 0.08)' },
    land_tax: { icon: Home, color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)' },
    advance_tax: { icon: TrendingUp, color: '#0369A1', bg: 'rgba(3, 105, 161, 0.08)' },
    gst: { icon: Briefcase, color: '#0F6E56', bg: 'rgba(15, 110, 86, 0.08)' },
    professional_tax: { icon: Award, color: '#92400E', bg: 'rgba(146, 64, 14, 0.08)' },
    vehicle_tax: { icon: Car, color: '#9D174D', bg: 'rgba(157, 23, 77, 0.08)' },
    other: { icon: HelpCircle, color: '#475569', bg: 'rgba(71, 85, 105, 0.08)' },
  };

  const item = config[taxType] || config.other;
  const IconComponent = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
      style={{
        color: item.color,
        backgroundColor: item.bg,
        borderColor: `${item.color}20`,
      }}
    >
      <IconComponent size={12} className="shrink-0" />
      {formatTaxType(taxType)}
    </span>
  );
};
export default TaxTypeBadge;
