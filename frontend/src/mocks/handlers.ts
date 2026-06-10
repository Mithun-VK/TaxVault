import { http, HttpResponse, delay } from 'msw';
import {
  initialObligations,
  initialPayments,
  initialDocuments,
  initialAlertConfigs,
  initialAlertLogs,
  currentUser,
} from './data';
import { Obligation, Payment, Document, AlertConfig, AlertLog } from '@/types';

// In-memory data store for local session persistence
let obligations: Obligation[] = [...initialObligations];
let payments: Payment[] = [...initialPayments];
let documents: Document[] = [...initialDocuments];
let alertConfigs: AlertConfig[] = [...initialAlertConfigs];
let alertLogs: AlertLog[] = [...initialAlertLogs];
let user = { ...currentUser };
let isLoggedIn = true; // Default to logged in for easy dev preview

const API_PREFIX = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `${window.location.origin}/api/v1`
  : 'http://localhost:8000/api/v1';

export const handlers = [
  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  http.post(`${API_PREFIX}/auth/login`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as any;
    if (body.email && body.password.length >= 8) {
      isLoggedIn = true;
      return HttpResponse.json({
        access_token: 'mock-access-token-12345',
        refresh_token: 'mock-refresh-token-67890',
        user,
      });
    }
    return new HttpResponse(JSON.stringify({ message: 'Invalid credentials' }), { status: 400 });
  }),

  http.post(`${API_PREFIX}/auth/register`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as any;
    if (body.email && body.fullName && body.password) {
      user = {
        id: 'usr-' + Math.random().toString(36).substr(2, 9),
        email: body.email,
        fullName: body.fullName,
        phoneNumber: body.phoneNumber || '+919876543210',
      };
      isLoggedIn = true;
      return HttpResponse.json({
        access_token: 'mock-access-token-12345',
        refresh_token: 'mock-refresh-token-67890',
        user,
      });
    }
    return new HttpResponse(JSON.stringify({ message: 'Registration failed' }), { status: 400 });
  }),

  http.post(`${API_PREFIX}/auth/logout`, async () => {
    isLoggedIn = false;
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API_PREFIX}/auth/forgot-password`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    if (body.email) {
      return HttpResponse.json({ message: 'Reset link dispatched to registered email.' });
    }
    return new HttpResponse(JSON.stringify({ message: 'Invalid email' }), { status: 400 });
  }),

  http.post(`${API_PREFIX}/auth/reset-password`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    if (body.password) {
      return HttpResponse.json({ message: 'Password reset successful.' });
    }
    return new HttpResponse(JSON.stringify({ message: 'Reset failed' }), { status: 400 });
  }),

  // ── OBLIGATIONS ───────────────────────────────────────────────────────────
  http.get(`${API_PREFIX}/obligations`, async ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const status = url.searchParams.get('status') || '';
    const taxType = url.searchParams.get('tax_type') || '';
    const fy = url.searchParams.get('fy') || '';

    let list = obligations.filter(o => !o.is_archived);

    if (search) {
      list = list.filter(
        o =>
          o.description.toLowerCase().includes(search) ||
          o.jurisdiction?.toLowerCase().includes(search)
      );
    }
    if (status && status !== 'All') {
      list = list.filter(o => o.status === status.toLowerCase());
    }
    if (taxType) {
      list = list.filter(o => o.tax_type === taxType);
    }
    if (fy) {
      list = list.filter(o => o.assessment_year === fy);
    }

    return HttpResponse.json(list);
  }),

  http.get(`${API_PREFIX}/obligations/:id`, async ({ params }) => {
    const { id } = params;
    const item = obligations.find(o => o.id === id);
    if (item) {
      return HttpResponse.json(item);
    }
    return new HttpResponse(JSON.stringify({ message: 'Obligation not found' }), { status: 404 });
  }),

  http.post(`${API_PREFIX}/obligations`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as any;
    const newItem: Obligation = {
      id: 'obl-' + Math.random().toString(36).substr(2, 9),
      tax_type: body.tax_type,
      description: body.description,
      assessment_year: body.assessment_year,
      jurisdiction: body.jurisdiction || 'General',
      total_amount: Number(body.total_amount),
      due_date: body.due_date,
      recurrence_rule: body.recurrence_rule || 'NONE',
      notes: body.notes || '',
      status: 'pending',
      is_archived: false,
      alert_configured: false,
    };
    obligations.unshift(newItem);

    // Create an empty alert config for this obligation
    alertConfigs.push({
      id: 'alc-' + Math.random().toString(36).substr(2, 9),
      obligation_id: newItem.id,
      channels: ['email'],
      thresholds: [15, 7, 3, 1],
      is_active: false
    });

    // Add recent activity log
    alertLogs.unshift({
      id: 'alg-' + Math.random().toString(36).substr(2, 9),
      obligation_id: newItem.id,
      channel: 'email',
      timestamp: new Date().toISOString(),
      status: 'sent',
      message: `Obligation created: ${newItem.description} due on ${newItem.due_date.slice(0,10)}`,
    });

    return HttpResponse.json(newItem);
  }),

  http.patch(`${API_PREFIX}/obligations/:id`, async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as any;
    const idx = obligations.findIndex(o => o.id === id);

    if (idx !== -1) {
      const updated = { ...obligations[idx], ...body };
      
      // If payment totals updated, verify status
      if (body.total_amount !== undefined) {
        updated.total_amount = Number(body.total_amount);
      }
      
      obligations[idx] = updated;
      return HttpResponse.json(updated);
    }
    return new HttpResponse(JSON.stringify({ message: 'Obligation not found' }), { status: 404 });
  }),

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  http.get(`${API_PREFIX}/payments`, async ({ request }) => {
    const url = new URL(request.url);
    const obligationId = url.searchParams.get('obligation_id');
    
    let list = payments;
    if (obligationId) {
      list = list.filter(p => p.obligation_id === obligationId);
    }
    return HttpResponse.json(list);
  }),

  http.post(`${API_PREFIX}/payments`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    
    const newPayment: Payment = {
      id: 'pay-' + Math.random().toString(36).substr(2, 9),
      obligation_id: body.obligation_id,
      amount_paid: Number(body.amount_paid),
      payment_date: body.payment_date || new Date().toISOString(),
      reference_number: body.reference_number || '',
      notes: body.notes || '',
      receipt_url: body.receipt_url || '',
      receipt_filename: body.receipt_filename || '',
    };
    payments.unshift(newPayment);

    // Update corresponding obligation status
    const oblIdx = obligations.findIndex(o => o.id === body.obligation_id);
    if (oblIdx !== -1) {
      const obl = obligations[oblIdx];
      const allOblPayments = payments.filter(p => p.obligation_id === obl.id);
      const totalPaid = allOblPayments.reduce((acc, p) => acc + p.amount_paid, 0);

      if (totalPaid >= obl.total_amount) {
        obl.status = 'paid';
      } else if (totalPaid > 0) {
        // If partial but not fully paid, keep status
      }
    }

    // Attach receipt document if exists
    if (body.receipt_filename) {
      documents.unshift({
        id: 'doc-' + Math.random().toString(36).substr(2, 9),
        label: body.receipt_filename.split('.')[0] || 'Payment Receipt',
        category: 'other',
        financial_year: '2025-26',
        tags: ['Receipt', 'Payment'],
        file_size_kb: Math.floor(Math.random() * 2000) + 100,
        upload_date: new Date().toISOString(),
        file_type: 'pdf',
        download_url: body.receipt_url || '/documents/mock-receipt.pdf',
        is_attachment: true,
        attached_to_id: newPayment.id,
        attached_to_name: obligations.find(o => o.id === body.obligation_id)?.description || 'Tax Obligation',
      });
    }

    return HttpResponse.json(newPayment);
  }),

  http.patch(`${API_PREFIX}/payments/:id`, async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as any;
    const idx = payments.findIndex(p => p.id === id);

    if (idx !== -1) {
      payments[idx] = { ...payments[idx], ...body };
      return HttpResponse.json(payments[idx]);
    }
    return new HttpResponse(JSON.stringify({ message: 'Payment not found' }), { status: 404 });
  }),

  // ── DOCUMENTS ─────────────────────────────────────────────────────────────
  http.get(`${API_PREFIX}/documents`, async ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search')?.toLowerCase() || '';

    let list = documents;

    if (category) {
      list = list.filter(d => d.category === category);
    }
    if (search) {
      list = list.filter(
        d =>
          d.label.toLowerCase().includes(search) ||
          d.tags.some(t => t.toLowerCase().includes(search))
      );
    }

    return HttpResponse.json(list);
  }),

  http.post(`${API_PREFIX}/documents/upload-url`, async () => {
    await delay(200);
    const mockId = Math.random().toString(36).substr(2, 9);
    return HttpResponse.json({
      upload_url: `http://localhost:8000/api/v1/mock-r2-upload/${mockId}`,
      file_url: `/documents/r2-${mockId}.pdf`,
    });
  }),

  http.post(`${API_PREFIX}/documents`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as any;
    const newDoc: Document = {
      id: 'doc-' + Math.random().toString(36).substr(2, 9),
      label: body.label,
      category: body.category,
      financial_year: body.financial_year || '2025-26',
      tags: body.tags || [],
      file_size_kb: body.file_size_kb || 450,
      upload_date: new Date().toISOString(),
      file_type: body.file_type || 'pdf',
      download_url: body.download_url || '/documents/mock.pdf',
      is_attachment: false,
    };
    documents.unshift(newDoc);
    return HttpResponse.json(newDoc);
  }),

  http.get(`${API_PREFIX}/documents/:id/download`, async ({ params }) => {
    const { id } = params;
    const doc = documents.find(d => d.id === id);
    if (doc) {
      return HttpResponse.json({ download_url: doc.download_url });
    }
    return new HttpResponse(JSON.stringify({ message: 'Document not found' }), { status: 404 });
  }),

  http.patch(`${API_PREFIX}/documents/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const idx = documents.findIndex(d => d.id === id);

    if (idx !== -1) {
      documents[idx] = { ...documents[idx], ...body };
      return HttpResponse.json(documents[idx]);
    }
    return new HttpResponse(JSON.stringify({ message: 'Document not found' }), { status: 404 });
  }),

  http.delete(`${API_PREFIX}/documents/:id`, async ({ params }) => {
    const { id } = params;
    const idx = documents.findIndex(d => d.id === id);

    if (idx !== -1) {
      documents.splice(idx, 1);
      return HttpResponse.json({ success: true });
    }
    return new HttpResponse(JSON.stringify({ message: 'Document not found' }), { status: 404 });
  }),

  // ── ALERT CONFIGURATIONS ──────────────────────────────────────────────────
  http.get(`${API_PREFIX}/alerts/config`, async () => {
    return HttpResponse.json(alertConfigs);
  }),

  http.patch(`${API_PREFIX}/alerts/config/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const idx = alertConfigs.findIndex(a => a.id === id);

    if (idx !== -1) {
      alertConfigs[idx] = { ...alertConfigs[idx], ...body };

      // Sync obligation record config field
      const oblIdx = obligations.findIndex(o => o.id === alertConfigs[idx].obligation_id);
      if (oblIdx !== -1) {
        obligations[oblIdx].alert_configured = alertConfigs[idx].is_active;
      }

      return HttpResponse.json(alertConfigs[idx]);
    }
    return new HttpResponse(JSON.stringify({ message: 'Config not found' }), { status: 404 });
  }),

  http.get(`${API_PREFIX}/alerts/logs`, async ({ request }) => {
    const url = new URL(request.url);
    const obligationId = url.searchParams.get('obligation_id');
    
    let list = alertLogs;
    if (obligationId) {
      list = list.filter(l => l.obligation_id === obligationId);
    }
    return HttpResponse.json(list);
  }),

  // ── USERS / PROFILE ───────────────────────────────────────────────────────
  http.patch(`${API_PREFIX}/users/profile`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as any;
    user = {
      ...user,
      fullName: body.fullName || user.fullName,
      phoneNumber: body.phoneNumber || user.phoneNumber,
    };
    return HttpResponse.json(user);
  }),

  // ── MOCK S3/R2 DIRECT UPLOADER ───────────────────────────────────────────
  http.put(`${API_PREFIX}/mock-r2-upload/:id`, async () => {
    // Return empty success responses to satisfy XMLHttpRequest upload progress cycles
    await delay(600);
    return HttpResponse.json({ success: true });
  }),
];
