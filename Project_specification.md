# TaxVault v3 - Complete Project Specification

> **CONFIDENTIAL** - Personal Asset & Liability Management System
> Private single-client deployment · June 2026

---

## Product definition

TaxVault is a private web application that gives a single client complete visibility and control over their personal assets, insurance policies, tax obligations, and recurring household bills. It stores all related documents in a secure cloud vault and sends automated reminders via email, SMS, and push notification before every due date.

This is NOT a commercial SaaS product. It is built exclusively for one client's personal use.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Python 3.12 + FastAPI + Pydantic v2 | Async-native, type-safe, fast to build |
| Database | PostgreSQL 16 (Supabase Pro) + SQLAlchemy 2 + Alembic | Row-level security, ACID, managed backups |
| Job queue | Celery + Upstash Redis (free tier) + Celery Beat | Reliable scheduled alert dispatch at zero cost |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v3 | Modern, PWA-ready, fast build cycle |
| UI components | shadcn/ui | Accessible, customisable base components |
| State mgmt | Zustand v4 + TanStack Query v5 | Minimal boilerplate, built-in server cache |
| Forms | React Hook Form + Zod | Type-safe validation, excellent UX |
| Notifications | AWS SES (email) + MSG91 (SMS) + Firebase FCM (push) | Multi-channel via single service abstraction |
| File storage | Cloudflare R2 + presigned URLs | Zero egress fees, S3-compatible API |
| Infrastructure | AWS EC2 t3.micro (ap-south-1) + Nginx | Mumbai region, production-grade |
| CDN/DNS/SSL | Cloudflare (free) | CDN, DNS, TLS - all free |
| Monitoring | Sentry + CloudWatch | Error tracking + infra health |
| CI/CD | GitHub Actions | Auto-deploy on push to main |

---

## Monthly infrastructure cost (optimised)

| Service | Cost |
|---|---|
| Supabase Pro (PostgreSQL + auth + 100 GB storage) | ₹2,125/mo |
| Upstash Redis (free tier, 500K cmds/mo) | ₹0 |
| Cloudflare R2 (10 GB free, zero egress) | ₹0 |
| AWS EC2 t3.micro | ₹650/mo |
| MSG91 SMS (~100 alerts/mo) | ₹50/mo |
| AWS SES email | ₹0 (free tier) |
| Firebase FCM push | ₹0 (free forever) |
| Cloudflare DNS + SSL | ₹0 (free forever) |
| **Total** | **₹2,825/mo** |

AWS Free Tier ($200 credit on new account) covers ~4 months of infra at zero cost.

---

## Data model (11 tables)

```
users
├── assets              (land, vehicle, building, other - JSONB metadata)
├── insurance_policies  (medical, life, vehicle - premium schedule)
├── tax_obligations     (land tax, water tax, property tax - linked to assets)
├── recurring_bills     (phone, electricity, WiFi, gas - billing cycle)
├── payments            (unified ledger - polymorphic: entity_type + entity_id)
├── documents           (polymorphic: linked to any entity or standalone)
├── alert_configs       (per-payable: days_before thresholds + channel selection)
├── alert_logs          (idempotency-keyed dispatch log)
└── audit_logs          (immutable mutation trail)
```

---

## Module breakdown (8 modules, 164 hours)

| # | Module | Hours | Cost | Timeline |
|---|---|---|---|---|
| M1 | Auth, core setup, DB schema | 12 | ₹6,000 | Days 1–2 |
| M2 | Asset register (land, vehicle, building, other) | 20 | ₹10,000 | Days 3–6 |
| M3 | Insurance management (policy + premiums) | 16 | ₹8,000 | Days 5–8 |
| M4 | Tax obligations + recurring bills | 18 | ₹9,000 | Days 7–10 |
| M5 | Document vault (polymorphic) | 14 | ₹7,000 | Days 9–12 |
| M6 | Alert engine + notification service | 22 | ₹11,000 | Days 11–15 |
| M7 | React dashboard (12 pages) + PWA | 50 | ₹25,000 | Days 12–22 |
| M8 | Deployment, CI/CD, hardening | 12 | ₹6,000 | Days 22–25 |
| **Total** | | **164 hrs** | **₹82,000** | **25 days** |

---

## Design system

```
Primary:     #1A3C6E  (deep navy - authority, trust)
Accent:      #0F6E56  (forest teal - calm action states)
Warning:     #92400E  (amber-brown - upcoming deadlines)
Danger:      #991B1B  (deep red - overdue)
Success:     #14532D  (deep green - paid/completed)
Background:  #F8F9FB  (off-white page bg)
Surface:     #FFFFFF  (cards)
Border:      #E2E6ED  (subtle dividers)
Text:        #0F172A  (primary)
Muted:       #64748B  (secondary)

Font: Inter - headings 600 weight, body 400, tabular-nums for all amounts
Cards: white bg, 1px #E2E6ED border, 12px radius, subtle shadow
Buttons: 8px radius, 150ms transition, scale-[0.98] active
Status badges: pill shape (9999px radius)
  pending:  bg #EFF6FF, text #1D4ED8
  overdue:  bg #FEF2F2, text #991B1B
  paid:     bg #F0FDF4, text #14532D
  exempt:   bg #F8FAFC, text #475569
```

---

## Alert engine design

Daily at 08:00 IST, Celery Beat fires a scanner task that runs:

```sql
SELECT 'tax' AS entity_type, id, due_date, total_amount, 'pending' AS status
FROM tax_obligations WHERE status = 'pending'
UNION ALL
SELECT 'insurance', id, next_premium_date, premium_amount, 'pending'
FROM insurance_policies WHERE next_premium_date IS NOT NULL
UNION ALL
SELECT 'bill', id, next_due_date, average_amount, 'pending'
FROM recurring_bills WHERE is_active = true
```

For each match where `due_date - today = ANY(alert_config.days_before)`:
1. Check AlertLog idempotency key (obligation_id + channel + days_before + sent_date)
2. If not already sent → build Notification → route through NotificationService
3. Fan out to email/SMS/push per alert_config.channels
4. Write AlertLog entry atomically

Overdue escalation: if `due_date < today AND balance > 0` → fire ALL channels regardless of preferences.