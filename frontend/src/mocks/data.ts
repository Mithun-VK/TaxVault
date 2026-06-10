import { Obligation, Payment, Document, AlertConfig, AlertLog, User } from '@/types';

// Let's assume today is June 10, 2026
// We construct dates relative to 2026-06-10
export const currentUser: User = {
  id: 'usr-8812-ad99',
  email: 'client@taxvault.in',
  fullName: 'Aditya Birla',
  phoneNumber: '+919876543210',
};

export const initialObligations: Obligation[] = [
  {
    id: 'obl-001',
    tax_type: 'income_tax',
    description: 'Income Tax Self-Assessment (Final Settlement)',
    assessment_year: '2025-26',
    jurisdiction: 'Income Tax Dept - Ward 12(1), Mumbai',
    total_amount: 175000,
    due_date: '2026-06-25T23:59:59.000Z', // 15 days from June 10
    recurrence_rule: 'ANNUAL',
    notes: 'Based on capital gains and salary income details compiled by CA.',
    status: 'pending',
    is_archived: false,
    alert_configured: true,
  },
  {
    id: 'obl-002',
    tax_type: 'gst',
    description: 'GST Quarterly Filing (GSTR-1 & GSTR-3B) - Q1',
    assessment_year: '2026-27',
    jurisdiction: 'GSTIN 27AAAAA1111A1Z1, Maharashtra',
    total_amount: 85000,
    due_date: '2026-05-20T23:59:59.000Z', // Past, fully paid
    recurrence_rule: 'QUARTERLY',
    notes: 'Filing for consulting services business ledger.',
    status: 'paid',
    is_archived: false,
    alert_configured: true,
  },
  {
    id: 'obl-003',
    tax_type: 'land_tax',
    description: 'Annual Municipal Property & Land Tax',
    assessment_year: '2025-26',
    jurisdiction: 'Municipal Corporation of Greater Mumbai (MCGM)',
    total_amount: 45000,
    due_date: '2026-06-03T23:59:59.000Z', // 7 days ago, overdue!
    recurrence_rule: 'ANNUAL',
    notes: 'Alibaug holiday home property tax ledger assessment.',
    status: 'overdue',
    is_archived: false,
    alert_configured: true,
  },
  {
    id: 'obl-004',
    tax_type: 'professional_tax',
    description: 'Professional Tax Annual Return',
    assessment_year: '2025-26',
    jurisdiction: 'Government of Maharashtra',
    total_amount: 2500,
    due_date: '2026-04-30T23:59:59.000Z', // Past, paid
    recurrence_rule: 'ANNUAL',
    notes: 'Standard director professional tax obligation.',
    status: 'paid',
    is_archived: false,
    alert_configured: false,
  },
  {
    id: 'obl-005',
    tax_type: 'advance_tax',
    description: 'Advance Tax Installment - Q1',
    assessment_year: '2026-27',
    jurisdiction: 'Income Tax Department of India',
    total_amount: 200000,
    due_date: '2026-06-15T23:59:59.000Z', // 5 days from June 10 (Critical / warning range!)
    recurrence_rule: 'QUARTERLY',
    notes: 'First installment of advance tax (15% threshold check).',
    status: 'pending',
    is_archived: false,
    alert_configured: true,
  },
  {
    id: 'obl-006',
    tax_type: 'vehicle_tax',
    description: 'Lifetime Road Tax Assessment (Audi Q7)',
    assessment_year: '2025-26',
    jurisdiction: 'RTO Mumbai West (MH-02)',
    total_amount: 112000,
    due_date: '2026-07-10T23:59:59.000Z', // 30 days from June 10
    recurrence_rule: 'NONE',
    notes: 'Registration tax assessment - exempt under corporate EV subversion policy.',
    status: 'exempt',
    is_archived: false,
    alert_configured: false,
  },
];

export const initialPayments: Payment[] = [
  {
    id: 'pay-001',
    obligation_id: 'obl-002', // GST
    amount_paid: 85000,
    payment_date: '2026-05-18T11:30:00.000Z',
    reference_number: 'GST-PAY-108272619',
    notes: 'Paid in full via net banking corporate account.',
    receipt_url: '/mock-receipt-gst.pdf',
    receipt_filename: 'GST_Receipt_Q1_2026.pdf',
  },
  {
    id: 'pay-002',
    obligation_id: 'obl-004', // Professional tax
    amount_paid: 2500,
    payment_date: '2026-04-28T09:15:00.000Z',
    reference_number: 'MH-PTAX-2026A',
    notes: 'Paid via CA portal.',
    receipt_url: '/mock-receipt-pt.pdf',
    receipt_filename: 'PTax_2025_26_Challan.pdf',
  },
  // Property Land tax is overdue, let's say a partial payment was made which leaves 35,000 outstanding (45,000 total)
  {
    id: 'pay-003',
    obligation_id: 'obl-003',
    amount_paid: 10000,
    payment_date: '2026-06-01T15:45:00.000Z',
    reference_number: 'MCGM-LAND-28827',
    notes: 'Partial payment made before due date. Pending remaining balance approval.',
    receipt_url: '/mock-receipt-land-partial.pdf',
    receipt_filename: 'MCGM_LandTax_Partial_Jun01.pdf',
  },
];

export const initialDocuments: Document[] = [
  {
    id: 'doc-001',
    label: 'ITR-V Assessment Confirmation FY 2024-25',
    category: 'income_tax',
    financial_year: '2024-25',
    tags: ['ITR', 'Assessment', 'Income Tax'],
    file_size_kb: 1450,
    upload_date: '2025-08-15T14:20:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/itr-v-24-25.pdf',
    is_attachment: false,
  },
  {
    id: 'doc-002',
    label: 'Capital Gains Statement - Zerodha H1 FY25',
    category: 'income_tax',
    financial_year: '2025-26',
    tags: ['Capital Gains', 'Zerodha', 'Stocks'],
    file_size_kb: 3200,
    upload_date: '2026-04-10T10:00:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/zerodha-capgains.pdf',
    is_attachment: false,
  },
  {
    id: 'doc-003',
    label: 'GST Filing Receipt Q1 GSTR-1',
    category: 'gst',
    financial_year: '2026-27',
    tags: ['GSTR-1', 'GST', 'Filing Receipt'],
    file_size_kb: 450,
    upload_date: '2026-05-18T11:32:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/GST_Receipt_Q1_2026.pdf',
    is_attachment: true,
    attached_to_id: 'pay-001',
    attached_to_name: 'GST Quarterly Filing (GSTR-1 & GSTR-3B) - Q1',
  },
  {
    id: 'doc-004',
    label: 'Alibaug Villa Tax Bill MCGM 2025-26',
    category: 'property',
    financial_year: '2025-26',
    tags: ['Property Tax', 'MCGM', 'Land Bill'],
    file_size_kb: 1250,
    upload_date: '2026-05-02T16:45:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/alibaug-bill.pdf',
    is_attachment: false,
  },
  {
    id: 'doc-005',
    label: 'Professional Tax Challan Receipt MH',
    category: 'other',
    financial_year: '2025-26',
    tags: ['Challan', 'Professional Tax'],
    file_size_kb: 512,
    upload_date: '2026-04-28T09:17:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/PTax_2025_26_Challan.pdf',
    is_attachment: true,
    attached_to_id: 'pay-002',
    attached_to_name: 'Professional Tax Annual Return',
  },
  {
    id: 'doc-006',
    label: 'Audi Q7 Road Tax Exemption Certificate RTO',
    category: 'vehicle',
    financial_year: '2025-26',
    tags: ['RTO', 'Exemption', 'Vehicle Tax'],
    file_size_kb: 2100,
    upload_date: '2026-05-25T11:00:00.000Z',
    file_type: 'image',
    download_url: '/documents/road-tax-exemption.png',
    is_attachment: false,
  },
  {
    id: 'doc-007',
    label: 'Land Tax Partial Payment Challan MCGM',
    category: 'property',
    financial_year: '2025-26',
    tags: ['Challan', 'Property Tax', 'Receipt'],
    file_size_kb: 890,
    upload_date: '2026-06-01T15:46:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/MCGM_LandTax_Partial_Jun01.pdf',
    is_attachment: true,
    attached_to_id: 'pay-003',
    attached_to_name: 'Annual Municipal Property & Land Tax',
  },
  {
    id: 'doc-008',
    label: 'Rental Income Agreement - Bandra Apartment',
    category: 'property',
    financial_year: '2025-26',
    tags: ['Lease', 'Rental Income', 'Bandra'],
    file_size_kb: 4800,
    upload_date: '2025-10-01T09:00:00.000Z',
    file_type: 'doc',
    download_url: '/documents/lease-bandra.docx',
    is_attachment: false,
  },
  {
    id: 'doc-009',
    label: 'Form 16 - Consulting Salary Summary 2024-25',
    category: 'income_tax',
    financial_year: '2024-25',
    tags: ['Form 16', 'TDS', 'Income Tax'],
    file_size_kb: 1850,
    upload_date: '2025-06-15T12:00:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/form16-tds.pdf',
    is_attachment: false,
  },
  {
    id: 'doc-010',
    label: 'Fixed Deposit Interest Certificates - HDFC Bank',
    category: 'income_tax',
    financial_year: '2025-26',
    tags: ['Interest', 'HDFC Bank', 'TDS'],
    file_size_kb: 950,
    upload_date: '2026-04-15T10:30:00.000Z',
    file_type: 'pdf',
    download_url: '/documents/hdfc-interest-cert.pdf',
    is_attachment: false,
  },
];

export const initialAlertConfigs: AlertConfig[] = [
  {
    id: 'alc-001',
    obligation_id: 'obl-001', // Income tax
    channels: ['email', 'sms', 'push'],
    thresholds: [30, 15, 7, 3, 1],
    is_active: true,
  },
  {
    id: 'alc-002',
    obligation_id: 'obl-002', // GST
    channels: ['email', 'push'],
    thresholds: [15, 7, 1],
    is_active: true,
  },
  {
    id: 'alc-003',
    obligation_id: 'obl-003', // Land tax
    channels: ['email', 'sms'],
    thresholds: [30, 15, 7],
    is_active: true,
  },
  {
    id: 'alc-005',
    obligation_id: 'obl-005', // Advance tax
    channels: ['email', 'sms', 'push'],
    thresholds: [30, 15, 7, 3, 1],
    is_active: true,
  },
];

export const initialAlertLogs: AlertLog[] = [
  {
    id: 'alg-001',
    obligation_id: 'obl-003', // Land Tax
    channel: 'email',
    timestamp: '2026-06-02T08:00:00.000Z',
    status: 'sent',
    message: 'Email notification triggered: Property tax due in 24 hours (₹45,000).',
  },
  {
    id: 'alg-002',
    obligation_id: 'obl-003', // Land Tax
    channel: 'sms',
    timestamp: '2026-06-02T08:05:00.000Z',
    status: 'sent',
    message: 'SMS warning sent to +919876543210. Property tax overdue in 24 hours.',
  },
  {
    id: 'alg-003',
    obligation_id: 'obl-005', // Advance Tax
    channel: 'email',
    timestamp: '2026-06-05T09:00:00.000Z',
    status: 'sent',
    message: 'Advance tax installment alert sent for June 15 due date.',
  },
  {
    id: 'alg-004',
    obligation_id: 'obl-005', // Advance Tax
    channel: 'push',
    timestamp: '2026-06-05T09:02:00.000Z',
    status: 'failed',
    message: 'Push service handshake timeout — APNS endpoint down.',
  },
  {
    id: 'alg-005',
    obligation_id: 'obl-001', // Income Tax
    channel: 'email',
    timestamp: '2026-05-26T08:00:00.000Z',
    status: 'sent',
    message: 'Email alert dispatched: Income tax assessment due in 30 days.',
  },
];
