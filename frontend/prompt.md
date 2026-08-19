# TaxVault v3 - Frontend Prompt (Claude Code)

> Paste this entire prompt into Claude Code while inside the `taxvault/frontend/` directory.

---

You are building the complete frontend for TaxVault v3 - a personal asset & liability management system. The project is scaffolded at `./`. Build the entire frontend from scratch: every page, every component, every utility - production-ready, no placeholders, no TODOs.

---

## TECH STACK (non-negotiable)

- React 19 + TypeScript + Vite
- Tailwind CSS v3 for styling
- shadcn/ui for base components (CLI: `npx shadcn@latest add <component>`)
- React Router v6 for routing
- TanStack Query v5 for server state
- Zustand v4 for client state
- Axios for HTTP with interceptors
- date-fns for date formatting
- Lucide React for icons
- React Hook Form + Zod for all forms
- Recharts for dashboard charts
- Sonner for toast notifications
- MSW (Mock Service Worker) for dev mocks

Install:
```bash
npm create vite@latest . -- --template react-ts
npm install react-router-dom @tanstack/react-query zustand axios date-fns lucide-react react-hook-form @hookform/resolvers zod recharts sonner clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer @types/node msw
npx tailwindcss init -p
npx shadcn@latest init
npx shadcn@latest add button input label select card badge dialog drawer sheet tabs accordion toast progress separator skeleton avatar dropdown-menu table switch checkbox
npx msw init public/
```

---

## DESIGN LANGUAGE

This software handles personal financial data. The visual tone must communicate institutional trust and calm authority - think private banking, not a startup app.

### Colors (extend in tailwind.config.ts):
```
brand-navy:    #1A3C6E   - primary actions, headings
brand-teal:    #0F6E56   - success, secondary actions
brand-warning: #92400E   - amber, upcoming deadlines ≤30 days
brand-danger:  #991B1B   - overdue, destructive actions
brand-success: #14532D   - paid/completed status
surface-page:  #F8F9FB   - page background
surface-card:  #FFFFFF   - card surfaces
surface-border:#E2E6ED   - all borders
text-primary:  #0F172A   - headings, key data
text-muted:    #64748B   - descriptions, secondary text
```

### Typography:
- Font: Inter (Google Fonts import)
- Headings: font-semibold, tracking-tight (-0.02em)
- Body: font-normal, leading-relaxed (1.6)
- All rupee amounts: font-mono, tabular-nums
- formatINR: Indian locale (₹1,25,000 not ₹125,000)

### Components:
- Cards: bg-white, border border-surface-border, rounded-xl, shadow-sm
- Buttons primary: bg-brand-navy text-white hover:bg-[#153264] active:scale-[0.98] rounded-lg
- Buttons secondary: bg-white border-brand-navy text-brand-navy hover:bg-[#F0F4FA]
- Status badges (rounded-full px-3 py-1 text-xs font-medium):
  - pending: bg-blue-50 text-blue-700 border border-blue-200
  - overdue: bg-red-50 text-red-700 border border-red-200
  - paid: bg-green-50 text-green-800 border border-green-200
  - active: bg-emerald-50 text-emerald-700 border border-emerald-200
  - exempt/lapsed: bg-slate-50 text-slate-600 border border-slate-200
- Asset type left-border colors: land #7C3AED, vehicle #9D174D, building #0369A1, other #475569
- Bill type colors: phone #7C3AED, electricity #D97706, wifi #0369A1, gas #DC2626, water #0891B2

---

## LAYOUT

Shell: fixed sidebar (260px wide) + main content area with top header.

### Sidebar:
- TaxVault logo top-left: navy SVG shield with "TV" monogram + "TaxVault" wordmark
- Nav items (Lucide icons): Dashboard (LayoutDashboard), Assets (Building2), Insurance (Shield), Taxes (Receipt), Bills (CreditCard), Payments (Wallet), Documents (FolderOpen), Alerts (Bell), Profile (User)
- Active: bg-brand-navy/10 text-brand-navy, left 3px navy border
- Hover: bg-slate-50
- Bottom: user initials avatar circle + name + logout
- Mobile <768px: collapse to bottom tab bar (Dashboard, Assets, Bills, Docs, More)

### Top header:
- Page title (dynamic per route)
- Right: notification bell with red badge count (overdue + due-today), user avatar

### Main: max-w-7xl mx-auto px-6 py-6 (px-4 mobile)

---

## PAGES (12 pages, all fully functional)

### 1. LOGIN (/login)
Full-page split layout. Left: large navy panel - TaxVault logo, tagline "Your assets. Your finances. Always on time.", three trust signals (bank-grade encryption, deadline alerts, document vault). Right: login form. Toggle to register. Forgot password flow. React Hook Form + Zod validation. Loading spinner on submit. On success: store tokens in localStorage, redirect to /.

### 2. DASHBOARD (/)
- 4 stat cards: Total asset value (₹, formatted), Due this month, Overdue (red if >0), Paid this FY
- Upcoming deadlines panel: next 8 payables sorted by due_date across ALL types (tax, insurance, bill). Each row: entity type badge + name + amount + countdown chip
- Deadline mini-calendar: build from scratch with date-fns. Show current month, dots on due dates, click to filter. Today = navy circle. Selected = navy ring.
- Recent activity feed: last 10 audit log entries with icons + relative timestamps
- Quick actions: "+ Add Asset", "+ Log Payment", "+ Upload Document"

### 3. ASSETS (/assets)
- Filter bar: search, type filter (All/Land/Vehicle/Building/Other), status filter
- Card grid (3 col → 2 → 1): each card has left-colored border (asset type color), type badge, name, current value (₹ large font-mono), acquisition date, status badge, kebab menu (View, Edit, Archive)
- Empty state: SVG illustration + "No assets registered yet" + CTA
- Slide-over drawer for Create/Edit. Form has dynamic fields per type:
  - Common: name, description, asset_type (select), acquisition_date, acquisition_cost, current_value, notes
  - When land selected: show survey_number, patta_number, extent_sqft, taluk, district, land_type
  - When vehicle selected: show registration_number, make, model, year, chassis_number, fuel_type
  - When building selected: show address, building_type, built_up_area_sqft, num_floors, property_tax_id

### 4. ASSET DETAIL (/assets/:id)
- Hero card: asset name, type badge, value, status, all metadata fields displayed in a grid
- Tabs below: Linked Documents | Linked Taxes | Linked Insurance | Payment History
- Each tab shows relevant linked items with add/remove actions

### 5. INSURANCE (/insurance)
- Card list: policy number, provider, type badge, sum insured, premium amount + frequency, next premium date with countdown, status badge
- Click card → /insurance/:id detail page
- Create/edit drawer: all policy fields + premium fields

### 6. INSURANCE DETAIL (/insurance/:id)
- Policy info card + premium schedule timeline (vertical timeline showing paid/upcoming/overdue premiums)
- Linked documents tab
- "Pay Premium" button → logs payment + advances next_premium_date

### 7. TAXES (/taxes)
- Filter: type, status, assessment year
- Card list: tax type badge, description, linked asset name if any, amount, due date + countdown, status
- Slide-over for create/edit. "Pay Tax" button per card.

### 8. BILLS (/bills)
- Card list: bill type badge + icon, provider name, account number, average amount, next due date + countdown, billing cycle badge
- "Quick Pay" button per card: opens payment form pre-filled
- Create/edit drawer

### 9. PAYMENTS (/payments)
- Unified ledger: DataTable with columns [Date, Type badge, Entity name, Amount, Method, Reference, Receipt]
- Filters: entity type, date range, payment method
- Click receipt icon → download from R2 via presigned URL
- Summary bar: total paid this month, total paid this FY

### 10. DOCUMENTS (/documents)
- Two tabs: Library (standalone docs) | Attachments (linked to entities)
- Library tab: category sidebar (Income Tax, Property, GST, Vehicle, Insurance, Bills, Other) with file counts. Main area: grid/list toggle. Each card: file icon, label, category badge, FY chip, size, date, download button, kebab (rename, move, delete)
- Drag-and-drop upload zone: dashed border, activates on drag-enter. Upload modal: label, category, financial_year, tags (multi-input)
- Search bar: live filter across label + tags

### 11. ALERT SETTINGS (/alerts)
- List of all payables grouped by type (taxes, insurance premiums, bills) with their alert config
- Each row: entity name, type badge, due date, channel toggles (email/SMS/push - colored chips), days-before pills (30/15/7/3/1 - toggle each)
- Alert history accordion per entity: last 10 sent alerts with timestamp, channel icon, status

### 12. PROFILE (/profile)
- Two columns: left = personal info card (name, email, phone - editable), right = settings
- Change password section with strength meter
- Notification preferences: global toggles per channel + test button
- Push device list with remove button
- Danger zone: export data, delete account (type-to-confirm modal)

---

## COMPONENTS

Build every component listed in the project structure. Key specifications:

**DeadlineCalendar**: Build from scratch with date-fns. 7 columns, 5-6 rows. Each cell 40px. Days with due items get colored dots. Use getMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isSameDay, isToday, addMonths, subMonths.

**DocumentUploader**: Accept prop for allowed MIME types + max size. Drag zone with useCallback + onDragEnter/Leave/Over/Drop. On drop: call /documents/upload-url → get presigned URL → upload via XMLHttpRequest (for progress events, fetch doesn't support upload progress) → on complete call POST /documents with metadata. Show linear progress bar.

**CountdownChip**: Calculate daysUntil(dueDate). Colors: ≤0 "Overdue" red, 1-3 red "X days", 4-30 amber, >30 green. Pill shape.

**SlideOverDrawer**: 480px right panel, slides in with transition-transform duration-300. Backdrop bg-black/30. Scrollable body, sticky footer with action buttons.

**PaymentForm**: Reusable across taxes, insurance, bills. Props: entityType, entityId, entityName, amount. Fields: amount_paid, payment_date, payment_method (select), reference_number, notes, attach receipt (triggers DocumentUploader).

---

## API LAYER

All in `src/api/`. Use TanStack Query for all server state.

`client.ts`: Axios instance. Request interceptor attaches Bearer token. Response interceptor: on 401 → try refresh → retry original → else redirect /login.

Every hook follows the pattern:
```typescript
// Query
export const useAssets = (filters?: AssetFilters) =>
  useQuery({ queryKey: ['assets', filters], queryFn: () => api.get('/assets', { params: filters }).then(r => r.data) });

// Mutation
export const useCreateAsset = () =>
  useMutation({
    mutationFn: (data: AssetCreate) => api.post('/assets', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset created'); }
  });
```

Build hooks for EVERY endpoint listed in the backend spec.

---

## STATE

`authStore.ts`: user object + tokens. Persist with zustand/middleware. setUser, setTokens, logout (clear localStorage + store).

`uiStore.ts`: sidebarOpen (mobile), activeFilters, selectedEntityId. setSidebarOpen, setFilter, clearFilters.

---

## ROUTING

Protected route: check localStorage for access_token → redirect /login if missing.

```
/login              → LoginPage (no shell)
/                   → Shell > Dashboard
/assets             → Shell > Assets
/assets/:id         → Shell > AssetDetail
/insurance          → Shell > Insurance
/insurance/:id      → Shell > InsuranceDetail
/taxes              → Shell > Taxes
/bills              → Shell > Bills
/payments           → Shell > Payments
/documents          → Shell > Documents
/alerts             → Shell > AlertSettings
/profile            → Shell > Profile
*                   → redirect /
```

---

## FORMS - Zod schemas for everything

AssetForm: tax_type enum, name min 2, current_value positive number, metadata fields conditional on type
InsuranceForm: policy_number required, premium_amount positive, premium_frequency enum, dates validated
TaxForm: tax_type enum, total_amount positive, due_date required
BillForm: bill_type enum, provider_name required, billing_cycle enum
PaymentForm: amount_paid positive, payment_date required
DocumentMetaForm: label min 1, category enum, tags max 5

---

## UTILITIES

`dates.ts`: daysUntil, formatDate ("12 Jun 2025"), formatDateShort ("12 Jun"), urgencyLevel → "overdue"|"critical"|"warning"|"safe", getCurrentFY → "2025-26" (Apr-Mar), getFYOptions (last 5 + next 1), advanceDueDate(date, cycle) → next date

`formatters.ts`: formatINR (Indian locale ₹1,25,000), formatFileSize (KB/MB), getEntityTypeLabel, getStatusLabel, getAssetTypeColor, getBillTypeColor, getBillTypeIcon

`upload.ts`: uploadToR2(presignedUrl, file, onProgress) using XMLHttpRequest for progress

`constants.ts`: ASSET_TYPES, BILL_TYPES, TAX_TYPES, INSURANCE_TYPES, PAYMENT_METHODS, DOCUMENT_CATEGORIES - each with label, value, color, icon

---

## MOCK DATA (critical - build this first)

`mocks/data.ts`: Realistic Indian data:
- 6 assets: 2 land plots (Chennai), 1 Honda City, 1 Maruti Swift, 1 apartment, 1 gold holding
- 4 insurance policies: 1 LIC life, 1 Star Health medical, 2 vehicle insurance
- 5 tax obligations: property tax for apartment, land tax for both plots, water tax, professional tax
- 6 recurring bills: Airtel phone, TNEB electricity, ACT WiFi, Indane gas, metro water, Netflix
- 12 payments spread across entities
- 10 documents across categories
- Alert configs for all payables with logs

`mocks/handlers.ts`: MSW handlers intercepting every API call with 200ms delay. Wire in main.tsx behind `import.meta.env.DEV` check.

---

## PWA

manifest.json: name "TaxVault", theme_color "#1A3C6E", display "standalone", icons 192+512
sw.js: push event → showNotification, notificationclick → openWindow
main.tsx: register service worker on load

---

## QUALITY

- Zero TypeScript errors (strict mode, no `any`)
- Every component has typed props via interfaces
- All loading states: skeleton loaders (not spinners)
- All error states: inline messages with retry buttons
- All empty states: illustrations + CTAs
- Mobile responsive: works at 375px width
- All amounts: Indian locale (tabular-nums, font-mono)
- All dates: "12 Jun 2025" format consistently
- Accessible: aria-labels on interactive elements, visible focus rings
- No hardcoded colors: only tailwind.config values

---

## BUILD ORDER

1. Package install → tailwind config → shadcn init
2. Types (all interfaces)
3. Constants + utilities
4. Auth store → API client
5. Mock data + MSW handlers
6. Login page
7. Shell (sidebar + header + layout)
8. Dashboard
9. Assets + AssetDetail
10. Insurance + InsuranceDetail
11. Taxes → Bills → Payments
12. Documents
13. Alerts → Profile
14. PWA manifest + service worker

Do not stop until every file exists and works. `npm run dev` should show a fully working app with mock data on every page.

---

## CONTINUATION PROMPT (if context limit hit)

```
Continue building TaxVault v3 frontend. Design system: navy #1A3C6E, teal #0F6E56, Inter font, 12px border-radius cards, tabular-nums amounts. You were building [page name]. Resume exactly where you left off.
```