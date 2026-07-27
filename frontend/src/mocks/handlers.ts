import { http, HttpResponse, delay } from 'msw';
import {
  mockUser,
  assets,
  insurancePolicies,
  taxes,
  bills,
  payments,
  documents,
  alertConfigs,
  alertLogs,
  activityLog,
} from './data';
import { advanceDueDate, advancePremiumDate, getCurrentFY } from '@/utils/dates';
import type {
  ActivityLogEntry,
  Payable,
  Payment,
  TaxDocument,
} from '@/types';

const API = '*/api/v1';
const LATENCY = 200;

let currentUser = { ...mockUser };

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function matches(value: string | undefined, filter: string | null): boolean {
  if (!filter || filter === 'all') return true;
  return value === filter;
}

function search(haystack: string[], term: string | null): boolean {
  if (!term) return true;
  const q = term.toLowerCase();
  return haystack.some((h) => h.toLowerCase().includes(q));
}

function buildPayables(): Payable[] {
  const list: Payable[] = [];
  taxes.forEach((t) => {
    if (t.status === 'paid' || t.status === 'exempt') return;
    list.push({
      id: `tax-${t.id}`,
      entity_type: 'tax',
      entity_id: t.id,
      name: t.description,
      amount: t.total_amount,
      due_date: t.due_date,
      status: t.status,
    });
  });
  bills.forEach((b) => {
    if (b.status === 'paid') return;
    list.push({
      id: `bill-${b.id}`,
      entity_type: 'bill',
      entity_id: b.id,
      name: b.provider_name,
      amount: b.average_amount,
      due_date: b.next_due_date,
      status: b.status,
    });
  });
  insurancePolicies.forEach((p) => {
    if (p.status !== 'active') return;
    list.push({
      id: `ins-${p.id}`,
      entity_type: 'insurance',
      entity_id: p.id,
      name: `${p.provider} premium`,
      amount: p.premium_amount,
      due_date: p.next_premium_date,
      status: p.status,
    });
  });
  return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function daysFromToday(isoDate: string): number {
  const target = new Date(isoDate + 'T00:00:00').getTime();
  const base = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((target - base) / 86_400_000);
}

function inCurrentFY(isoDate: string): boolean {
  return getCurrentFY(new Date(isoDate + 'T00:00:00')) === getCurrentFY();
}

function pushActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
  activityLog.unshift({
    ...entry,
    id: uid('act'),
    timestamp: new Date().toISOString(),
  });
}

export const handlers = [
  // ---- Auth ----
  http.post(`${API}/auth/login`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      token_type: 'bearer',
    });
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as { full_name: string; email: string; phone_number: string };
    currentUser = {
      ...currentUser,
      full_name: body.full_name,
      email: body.email,
      phone_number: body.phone_number,
    };
    return HttpResponse.json({
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      token_type: 'bearer',
    });
  }),

  http.post(`${API}/auth/refresh`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      token_type: 'bearer',
    });
  }),

  http.get(`${API}/users/me`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(currentUser);
  }),

  http.patch(`${API}/users/me`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Partial<typeof currentUser>;
    currentUser = { ...currentUser, ...body };
    return HttpResponse.json(currentUser);
  }),

  http.patch(`${API}/users/me/password`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ detail: 'Password changed successfully' });
  }),

  http.post(`${API}/auth/forgot-password`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ success: true });
  }),

  // ---- Assets ----
  http.get(`${API}/assets/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const term = url.searchParams.get('search');
    const type = url.searchParams.get('asset_type');
    const status = url.searchParams.get('status');
    const result = assets.filter(
      (a) =>
        search([a.name, a.description], term) &&
        matches(a.asset_type, type) &&
        matches(a.status, status),
    );
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.get(`${API}/assets/:id`, async ({ params }) => {
    await delay(LATENCY);
    const asset = assets.find((a) => a.id === params.id);
    return asset ? HttpResponse.json(asset) : new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API}/assets/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const asset = {
      id: uid('a'),
      description: '',
      notes: '',
      status: 'active',
      metadata: {},
      ...body,
      created_at: now,
      updated_at: now,
    } as (typeof assets)[number];
    assets.unshift(asset);
    pushActivity({
      action: 'asset_created',
      entity_type: 'asset',
      entity_name: asset.name,
      description: `Added asset ${asset.name}`,
    });
    return HttpResponse.json(asset, { status: 201 });
  }),

  http.patch(`${API}/assets/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = assets.findIndex((a) => a.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    assets[idx] = { ...assets[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(assets[idx]);
  }),

  http.delete(`${API}/assets/:id`, async ({ params }) => {
    await delay(LATENCY);
    const idx = assets.findIndex((a) => a.id === params.id);
    if (idx !== -1) assets.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // ---- Insurance ----
  http.get(`${API}/insurance/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const term = url.searchParams.get('search');
    const type = url.searchParams.get('insurance_type');
    const status = url.searchParams.get('status');
    const result = insurancePolicies.filter(
      (p) =>
        search([p.provider, p.policy_number], term) &&
        matches(p.insurance_type, type) &&
        matches(p.status, status),
    );
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.get(`${API}/insurance/:id`, async ({ params }) => {
    await delay(LATENCY);
    const policy = insurancePolicies.find((p) => p.id === params.id);
    return policy ? HttpResponse.json(policy) : new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API}/insurance/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const policy = {
      id: uid('i'),
      status: 'active',
      notes: '',
      schedule: [],
      claims: [],
      ...body,
      created_at: now,
      updated_at: now,
    } as unknown as (typeof insurancePolicies)[number];
    insurancePolicies.unshift(policy);
    pushActivity({
      action: 'policy_created',
      entity_type: 'insurance',
      entity_name: policy.provider,
      description: `Added policy with ${policy.provider}`,
    });
    return HttpResponse.json(policy, { status: 201 });
  }),

  http.patch(`${API}/insurance/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = insurancePolicies.findIndex((p) => p.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    insurancePolicies[idx] = {
      ...insurancePolicies[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(insurancePolicies[idx]);
  }),

  http.delete(`${API}/insurance/:id`, async ({ params }) => {
    await delay(LATENCY);
    const idx = insurancePolicies.findIndex((p) => p.id === params.id);
    if (idx !== -1) insurancePolicies.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // ---- Taxes ----
  http.get(`${API}/taxes/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const term = url.searchParams.get('search');
    const type = url.searchParams.get('tax_type');
    const status = url.searchParams.get('status');
    const ay = url.searchParams.get('assessment_year');
    const result = taxes.filter(
      (t) =>
        search([t.description, t.linked_asset_name ?? ''], term) &&
        matches(t.tax_type, type) &&
        matches(t.status, status) &&
        matches(t.assessment_year, ay),
    );
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.get(`${API}/taxes/:id`, async ({ params }) => {
    await delay(LATENCY);
    const tax = taxes.find((t) => t.id === params.id);
    return tax ? HttpResponse.json(tax) : new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API}/taxes/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const linked = assets.find((a) => a.id === body.linked_asset_id);
    const tax = {
      id: uid('t'),
      status: 'pending',
      paid_date: null,
      receipt_document_id: null,
      notes: '',
      linked_asset_name: linked?.name ?? null,
      ...body,
      created_at: now,
      updated_at: now,
    } as (typeof taxes)[number];
    taxes.unshift(tax);
    pushActivity({
      action: 'tax_created',
      entity_type: 'tax',
      entity_name: tax.description,
      description: `Added tax obligation ${tax.description}`,
    });
    return HttpResponse.json(tax, { status: 201 });
  }),

  http.patch(`${API}/taxes/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = taxes.findIndex((t) => t.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const linked = assets.find((a) => a.id === (body.linked_asset_id ?? taxes[idx].linked_asset_id));
    taxes[idx] = {
      ...taxes[idx],
      ...body,
      linked_asset_name: linked?.name ?? taxes[idx].linked_asset_name,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(taxes[idx]);
  }),

  http.delete(`${API}/taxes/:id`, async ({ params }) => {
    await delay(LATENCY);
    const idx = taxes.findIndex((t) => t.id === params.id);
    if (idx !== -1) taxes.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // ---- Bills ----
  http.get(`${API}/bills/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const term = url.searchParams.get('search');
    const type = url.searchParams.get('bill_type');
    const status = url.searchParams.get('status');
    const result = bills.filter(
      (b) =>
        search([b.provider_name, b.account_number], term) &&
        matches(b.bill_type, type) &&
        matches(b.status, status),
    );
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.get(`${API}/bills/:id`, async ({ params }) => {
    await delay(LATENCY);
    const bill = bills.find((b) => b.id === params.id);
    return bill ? HttpResponse.json(bill) : new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API}/bills/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const bill = {
      id: uid('b'),
      status: 'pending',
      auto_pay: false,
      notes: '',
      ...body,
      created_at: now,
      updated_at: now,
    } as (typeof bills)[number];
    bills.unshift(bill);
    pushActivity({
      action: 'bill_created',
      entity_type: 'bill',
      entity_name: bill.provider_name,
      description: `Added bill ${bill.provider_name}`,
    });
    return HttpResponse.json(bill, { status: 201 });
  }),

  http.patch(`${API}/bills/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = bills.findIndex((b) => b.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    bills[idx] = { ...bills[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(bills[idx]);
  }),

  http.delete(`${API}/bills/:id`, async ({ params }) => {
    await delay(LATENCY);
    const idx = bills.findIndex((b) => b.id === params.id);
    if (idx !== -1) bills.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // ---- Payments ----
  http.get(`${API}/payments/summary`, async () => {
    await delay(LATENCY);
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const total_this_month = payments
      .filter((p) => {
        const d = new Date(p.payment_date + 'T00:00:00');
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, p) => sum + p.amount_paid, 0);
    const total_this_fy = payments
      .filter((p) => inCurrentFY(p.payment_date))
      .reduce((sum, p) => sum + p.amount_paid, 0);
    return HttpResponse.json({ total_this_month, total_this_fy });
  }),

  http.get(`${API}/payments/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const type = url.searchParams.get('entity_type');
    const method = url.searchParams.get('payment_method');
    const entityId = url.searchParams.get('entity_id');
    const from = url.searchParams.get('date_from');
    const to = url.searchParams.get('date_to');
    const result = payments
      .filter(
        (p) =>
          matches(p.entity_type, type) &&
          matches(p.payment_method, method) &&
          (!entityId || p.entity_id === entityId) &&
          (!from || p.payment_date >= from) &&
          (!to || p.payment_date <= to),
      )
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.post(`${API}/payments/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Omit<Payment, 'id' | 'created_at'>;
    const payment: Payment = {
      ...body,
      id: uid('p'),
      notes: body.notes ?? '',
      created_at: new Date().toISOString(),
    };
    payments.unshift(payment);

    // Settle the underlying payable.
    if (payment.entity_type === 'tax') {
      const tax = taxes.find((t) => t.id === payment.entity_id);
      if (tax) {
        tax.status = 'paid';
        tax.paid_date = payment.payment_date;
        tax.receipt_document_id = payment.receipt_document_id ?? tax.receipt_document_id;
      }
    } else if (payment.entity_type === 'bill') {
      const bill = bills.find((b) => b.id === payment.entity_id);
      if (bill) {
        bill.next_due_date = advanceDueDate(bill.next_due_date, bill.billing_cycle);
        bill.status = 'pending';
      }
    } else if (payment.entity_type === 'insurance') {
      const policy = insurancePolicies.find((p) => p.id === payment.entity_id);
      if (policy) {
        const due = policy.schedule.find((s) => s.status !== 'paid');
        if (due) {
          due.status = 'paid';
          due.paid_date = payment.payment_date;
        }
        policy.next_premium_date = advancePremiumDate(
          policy.next_premium_date,
          policy.premium_frequency,
        );
      }
    }

    pushActivity({
      action: 'payment_logged',
      entity_type: payment.entity_type,
      entity_name: payment.entity_name,
      description: `Logged payment of ₹${payment.amount_paid.toLocaleString('en-IN')} for ${payment.entity_name}`,
    });

    return HttpResponse.json(payment, { status: 201 });
  }),

  // ---- Documents ----
  http.get(`${API}/documents/`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const term = url.searchParams.get('search');
    const category = url.searchParams.get('category');
    const fy = url.searchParams.get('financial_year');
    const entityId = url.searchParams.get('entity_id');
    const result = documents
      .filter(
        (d) =>
          search([d.label, ...d.tags], term) &&
          matches(d.category, category) &&
          matches(d.financial_year, fy) &&
          (!entityId || d.entity_id === entityId),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.post(`${API}/documents/upload-url`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as { file_name: string };
    const storage_key = `uploads/${uid('doc')}-${body.file_name}`;
    return HttpResponse.json({
      upload_url: `https://mock-r2.taxvault.local/${storage_key}`,
      storage_key,
    });
  }),

  http.put('https://mock-r2.taxvault.local/*', async () => {
    await delay(LATENCY);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${API}/documents/`, async ({ request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const linked =
      body.entity_id && body.entity_type
        ? findEntityName(String(body.entity_type), String(body.entity_id))
        : null;
    const doc: TaxDocument = {
      id: uid('d'),
      label: String(body.label ?? 'Untitled'),
      category: (body.category as TaxDocument['category']) ?? 'other',
      financial_year: String(body.financial_year ?? getCurrentFY()),
      file_name: String(body.file_name ?? 'document.pdf'),
      file_size: Number(body.file_size ?? 0),
      mime_type: String(body.mime_type ?? 'application/pdf'),
      tags: (body.tags as string[]) ?? [],
      entity_type: (body.entity_type as TaxDocument['entity_type']) ?? null,
      entity_id: (body.entity_id as string) ?? null,
      entity_name: linked,
      created_at: new Date().toISOString(),
    };
    documents.unshift(doc);
    pushActivity({
      action: 'document_uploaded',
      entity_type: 'document',
      entity_name: doc.label,
      description: `Uploaded ${doc.label}`,
    });
    return HttpResponse.json(doc, { status: 201 });
  }),

  http.patch(`${API}/documents/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = documents.findIndex((d) => d.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    documents[idx] = { ...documents[idx], ...body };
    return HttpResponse.json(documents[idx]);
  }),

  http.delete(`${API}/documents/:id`, async ({ params }) => {
    await delay(LATENCY);
    const idx = documents.findIndex((d) => d.id === params.id);
    if (idx !== -1) documents.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  http.get(`${API}/documents/:id/download-url`, async ({ params }) => {
    await delay(LATENCY);
    const doc = documents.find((d) => d.id === params.id);
    const label = doc?.label ?? 'Document';
    const content = `TaxVault mock receipt\n\n${label}\nGenerated ${new Date().toLocaleString('en-IN')}`;
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
    return HttpResponse.json({ url });
  }),

  // ---- Alerts ----
  http.get(`${API}/alerts/configs`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ items: alertConfigs, total: alertConfigs.length });
  }),

  http.patch(`${API}/alerts/configs/:id`, async ({ params, request }) => {
    await delay(LATENCY);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = alertConfigs.findIndex((c) => c.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    alertConfigs[idx] = { ...alertConfigs[idx], ...body };
    return HttpResponse.json(alertConfigs[idx]);
  }),

  http.get(`${API}/alerts/logs`, async ({ request }) => {
    await delay(LATENCY);
    const url = new URL(request.url);
    const entityId = url.searchParams.get('entity_id');
    const result = alertLogs
      .filter((l) => !entityId || l.entity_id === entityId)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    return HttpResponse.json({ items: result, total: result.length });
  }),

  http.post(`${API}/alerts/test`, async () => {
    await delay(LATENCY);
    return HttpResponse.json({ success: true });
  }),

  // ---- Dashboard ----
  http.get(`${API}/dashboard/summary`, async () => {
    await delay(LATENCY);
    const payables = buildPayables();
    const overdue = payables.filter((p) => daysFromToday(p.due_date) < 0);
    const now = new Date();

    const total_assets_value = assets
      .filter((a) => a.status === 'active')
      .reduce((sum, a) => sum + a.current_value, 0);

    const due_this_month = payables.filter((p) => {
      const d = new Date(p.due_date + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const total_paid_this_fy = payments
      .filter((p) => inCurrentFY(p.payment_date))
      .reduce((sum, p) => sum + p.amount_paid, 0);

    return HttpResponse.json({
      total_assets_value,
      due_this_month,
      overdue_count: overdue.length,
      total_paid_this_fy,
    });
  }),

  http.get(`${API}/dashboard/upcoming`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(
      buildPayables().map((p) => ({
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        name: p.name,
        amount: p.amount,
        due_date: p.due_date,
        days_remaining: daysFromToday(p.due_date),
      })),
    );
  }),

  http.get(`${API}/dashboard/recent-activity`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(
      activityLog.slice(0, 10).map((entry) => ({
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.id,
        created_at: entry.timestamp,
        user_id: currentUser.id,
      })),
    );
  }),

  http.get(`${API}/dashboard/calendar`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(
      buildPayables().map((p) => ({
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        name: p.name,
        amount: p.amount,
        due_date: p.due_date,
      })),
    );
  }),

  http.get(`${API}/dashboard/payables`, async () => {
    await delay(LATENCY);
    return HttpResponse.json(buildPayables());
  }),
];

function findEntityName(type: string, id: string): string | null {
  if (type === 'tax') return taxes.find((t) => t.id === id)?.description ?? null;
  if (type === 'bill') return bills.find((b) => b.id === id)?.provider_name ?? null;
  if (type === 'insurance') return insurancePolicies.find((p) => p.id === id)?.provider ?? null;
  if (type === 'asset') return assets.find((a) => a.id === id)?.name ?? null;
  return null;
}
