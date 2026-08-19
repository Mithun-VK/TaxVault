import {
  ASSET_TYPES,
  ASSET_OWNERS,
  BILL_TYPES,
  TAX_TYPES,
  INSURANCE_TYPES,
  PAYMENT_METHODS,
  DOCUMENT_CATEGORIES,
} from './constants';
import type {
  Asset,
  AssetType,
  BillType,
  PaymentEntityType,
  PaymentMethod,
} from '@/types';
import { Receipt, type LucideIcon } from 'lucide-react';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrFormatterPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,25,000 - Indian digit grouping. */
export function formatINR(amount: number, withPaise = false): string {
  if (Number.isNaN(amount)) return '₹0';
  return withPaise ? inrFormatterPaise.format(amount) : inrFormatter.format(amount);
}

/** Compact form for stat cards: ₹1.25 Cr, ₹4.5 L, ₹12.5 K. */
export function formatINRCompact(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  if (amount >= 1e3) return `₹${(amount / 1e3).toFixed(1)} K`;
  return formatINR(amount);
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ENTITY_LABELS: Record<PaymentEntityType, string> = {
  tax: 'Tax',
  insurance: 'Insurance',
  bill: 'Bill',
  asset: 'Asset',
};

export function getEntityTypeLabel(type: PaymentEntityType): string {
  return ENTITY_LABELS[type] ?? type;
}

/** Humanise a snake_case enum value: "net_banking" -> "Net Banking". */
export function getStatusLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getAssetTypeColor(type: AssetType): string {
  return ASSET_TYPES.find((t) => t.value === type)?.color ?? '#475569';
}

export function getBillTypeColor(type: BillType): string {
  return BILL_TYPES.find((t) => t.value === type)?.color ?? '#475569';
}

export function getBillTypeIcon(type: BillType): LucideIcon {
  return BILL_TYPES.find((t) => t.value === type)?.icon ?? Receipt;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? getStatusLabel(method);
}

export function getTaxTypeColor(type: string): string {
  return TAX_TYPES.find((t) => t.value === type)?.color ?? '#475569';
}

export function getInsuranceTypeColor(type: string): string {
  return INSURANCE_TYPES.find((t) => t.value === type)?.color ?? '#475569';
}

export function getCategoryColor(category: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.color ?? '#475569';
}

/** Human label for a document category, falling back to a humanised value. */
export function getCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? getStatusLabel(category);
}

/**
 * Map a stored owner value to its canonical full name. Older assets were saved
 * with first-name-only owners (e.g. "Inigo"); this resolves those to the full
 * name ("Inigo Irudayaraj") so they bucket under the right owner. Unknown names
 * are returned unchanged.
 */
export function canonicalOwner(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  const s = stored.trim().toLowerCase();
  if (!s) return undefined;
  const match = ASSET_OWNERS.find(
    (o) => o.toLowerCase() === s || o.toLowerCase().split(' ')[0] === s.split(' ')[0],
  );
  return match ?? stored;
}

/** The family member this asset belongs to (canonical full name), or undefined.
 * The `owner_name` column is authoritative; older records fall back to
 * metadata `owner_name` / `owner`. */
export function getAssetOwner(asset: Asset): string | undefined {
  const md = asset.metadata as { owner?: unknown; owner_name?: unknown } | null;
  const raw = asset.owner_name ?? md?.owner_name ?? md?.owner;
  return canonicalOwner(typeof raw === 'string' ? raw : undefined);
}

/** Best-known worth of an asset: current valuation, falling back to its cost. */
export function getAssetValue(asset: Asset): number {
  return Number(asset.current_value) || Number(asset.acquisition_cost) || 0;
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
