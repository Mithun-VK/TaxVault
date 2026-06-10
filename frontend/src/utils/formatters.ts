import { TaxType, ObligationStatus } from '@/types';

export function formatINR(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFileSize(kb: number): string {
  if (kb === undefined || kb === null || isNaN(kb)) return '0 KB';
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(kb)} KB`;
}

export function formatTaxType(type: TaxType): string {
  const mapping: Record<TaxType, string> = {
    income_tax: 'Income Tax',
    land_tax: 'Property & Land Tax',
    advance_tax: 'Advance Tax',
    gst: 'GST',
    professional_tax: 'Professional Tax',
    vehicle_tax: 'Vehicle Road Tax',
    other: 'Other Tax',
  };
  return mapping[type] || 'Tax Obligation';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getStatusLabel(status: ObligationStatus): string {
  const mapping: Record<ObligationStatus, string> = {
    pending: 'Pending',
    overdue: 'Overdue',
    paid: 'Paid',
    exempt: 'Exempt',
  };
  return mapping[status] || status;
}
