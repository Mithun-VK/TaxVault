import * as XLSX from 'xlsx';
import { formatINR, getAssetOwner, getStatusLabel } from './formatters';
import { PROPERTY_FIELDS, resolveAssetField } from './propertyFields';
import { formatDate } from './dates';
import { goldSummary, allGoldCategories, type GoldCategoryDef } from './gold';
import type { Asset, Bill, InsurancePolicy, Payment, Tax } from '@/types';

interface ExportOpts {
  /** When true, immediately download a single-sheet workbook. */
  download?: boolean;
  /** Base filename (no extension) when downloading. */
  filename?: string;
}


/** Size each column to the widest cell (capped) so the sheet is readable. */
function autoWidth(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  const colWidths = data.reduce((widths: number[], row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length;
      widths[i] = Math.max(widths[i] ?? 10, len + 2);
    });
    return widths;
  }, []);
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 50) }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Download a single worksheet as its own workbook. */
function downloadSheet(ws: XLSX.WorkSheet, sheetName: string, filenameBase: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filenameBase}_${today()}.xlsx`);
}

function finalize(
  ws: XLSX.WorkSheet,
  sheetName: string,
  opts: ExportOpts | undefined,
  defaultFile: string,
): XLSX.WorkSheet {
  autoWidth(ws);
  if (opts?.download) downloadSheet(ws, sheetName, opts.filename ?? defaultFile);
  return ws;
}

// ── Generic grid export ──────────────────────────────────────────────────────
// Powers the Reports page: an ordered header row + pre-formatted string cells,
// so the sheet mirrors exactly the columns and rows shown in the on-screen grid.
export function exportGrid(
  headers: string[],
  rows: (string | number)[][],
  sheetName: string,
  filenameBase: string,
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  autoWidth(ws);
  downloadSheet(ws, sheetName, filenameBase);
}

// ── Properties Report ───────────────────────────────────────────────────────
// Columns follow the canonical Property Details order (Owner Name → EB Nos.),
// then Type / Current Value / Status.
export function generatePropertiesReport(assets: Asset[], opts?: ExportOpts): XLSX.WorkSheet {
  const rows = assets.map((a) => {
    const row: Record<string, string> = { 'Property Name': a.name };
    for (const f of PROPERTY_FIELDS) {
      row[f.label] =
        f.key === 'owner_name'
          ? (getAssetOwner(a) ?? resolveAssetField(a, f) ?? '—')
          : (resolveAssetField(a, f) ?? '—');
    }
    row.Type = getStatusLabel(a.asset_type);
    row['Current Value'] = a.current_value ? formatINR(a.current_value) : '—';
    row.Status = getStatusLabel(a.status);
    return row;
  });
  return finalize(XLSX.utils.json_to_sheet(rows), 'Properties', opts, 'Properties');
}

// ── Gold Vault Report (category summary) ─────────────────────────────────────
export function generateGoldReport(
  assets: Asset[],
  custom: GoldCategoryDef[] = [],
  opts?: ExportOpts,
): XLSX.WorkSheet {
  const defs = allGoldCategories(assets, custom);
  const { categories, totals } = goldSummary(assets, defs);
  const rows: Record<string, string>[] = categories.map((c) => ({
    Category: c.label,
    Jewels: String(c.pieces),
    'Weight (g)': c.grams.toFixed(2),
    Sovereign: c.sovereigns.toFixed(3),
    'Est. Value': c.value ? formatINR(c.value) : '—',
  }));
  rows.push({
    Category: 'TOTAL',
    Jewels: String(totals.pieces),
    'Weight (g)': totals.grams.toFixed(2),
    Sovereign: totals.sovereigns.toFixed(3),
    'Est. Value': totals.value ? formatINR(totals.value) : '—',
  });
  return finalize(XLSX.utils.json_to_sheet(rows), 'Gold', opts, 'Gold');
}

// ── Tax Obligations Report ──────────────────────────────────────────────────
export function generateTaxReport(taxes: Tax[], opts?: ExportOpts): XLSX.WorkSheet {
  const rows = taxes.map((t) => ({
    Name: t.name || t.description,
    Description: t.description,
    'Tax Number': t.tax_number ?? '—',
    Type: getStatusLabel(t.tax_type),
    'Assessment Year': t.assessment_year ?? '—',
    Amount: t.total_amount ? formatINR(t.total_amount) : 'TBD',
    'Due Date': t.due_date ? formatDate(t.due_date) : '—',
    Status: getStatusLabel(t.status),
    'Linked Property': t.linked_asset_name ?? '—',
  }));
  return finalize(XLSX.utils.json_to_sheet(rows), 'Tax Obligations', opts, 'Taxes');
}

// ── Insurance Report ─────────────────────────────────────────────────────────
export function generateInsuranceReport(
  policies: InsurancePolicy[],
  opts?: ExportOpts,
): XLSX.WorkSheet {
  const rows = policies.map((p) => ({
    Name: p.name || p.provider,
    'Policy Number': p.policy_number,
    Provider: p.provider,
    Type: getStatusLabel(p.insurance_type),
    'Sum Insured': p.sum_insured ? formatINR(p.sum_insured) : '—',
    'Premium Amount': p.premium_amount ? formatINR(p.premium_amount) : '—',
    Frequency: getStatusLabel(p.premium_frequency),
    'Next Premium Date': p.next_premium_date ? formatDate(p.next_premium_date) : '—',
    Nominee: p.nominee ?? '—',
    Status: getStatusLabel(p.status),
  }));
  return finalize(XLSX.utils.json_to_sheet(rows), 'Insurance', opts, 'Insurance');
}

// ── Bills Report ─────────────────────────────────────────────────────────────
export function generateBillsReport(bills: Bill[], opts?: ExportOpts): XLSX.WorkSheet {
  const rows = bills.map((b) => ({
    Name: b.name || b.provider_name,
    Provider: b.provider_name,
    Type: getStatusLabel(b.bill_type),
    'Account Number': b.account_number ?? '—',
    'Billing Cycle': getStatusLabel(b.billing_cycle),
    'Avg Amount': b.average_amount ? formatINR(b.average_amount) : '—',
    'Next Due Date': b.next_due_date ? formatDate(b.next_due_date) : '—',
    'Auto Pay': b.auto_pay ? 'Yes' : 'No',
  }));
  return finalize(XLSX.utils.json_to_sheet(rows), 'Bills', opts, 'Bills');
}

// ── Payments Report ──────────────────────────────────────────────────────────
export function generatePaymentsReport(payments: Payment[], opts?: ExportOpts): XLSX.WorkSheet {
  const rows = payments.map((p) => ({
    Date: p.payment_date ? formatDate(p.payment_date) : '—',
    Category: getStatusLabel(p.entity_type),
    Entity: p.entity_name ?? '—',
    'Amount Paid': formatINR(Number(p.amount_paid)),
    'Payment Method': p.payment_method ? getStatusLabel(p.payment_method) : '—',
    'Reference Number': p.reference_number ?? '—',
    Remarks: p.notes ?? '—',
  }));
  const total = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const withTotal = [...rows, {}, { Date: 'TOTAL', 'Amount Paid': formatINR(total) }];
  return finalize(XLSX.utils.json_to_sheet(withTotal), 'Payments', opts, 'Payments');
}

// ── Master Report (all sheets in one workbook) ───────────────────────────────
export function generateMasterReport(data: {
  assets: Asset[];
  taxes: Tax[];
  insurance: InsurancePolicy[];
  bills: Bill[];
  payments: Payment[];
  period?: string;
}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, generatePropertiesReport(data.assets), 'Properties');
  XLSX.utils.book_append_sheet(wb, generateTaxReport(data.taxes), 'Tax Obligations');
  XLSX.utils.book_append_sheet(wb, generateInsuranceReport(data.insurance), 'Insurance');
  XLSX.utils.book_append_sheet(wb, generateBillsReport(data.bills), 'Bills');
  XLSX.utils.book_append_sheet(wb, generatePaymentsReport(data.payments), 'Payments');
  XLSX.writeFile(wb, `TaxVault_Report_${data.period ?? today()}.xlsx`);
}
