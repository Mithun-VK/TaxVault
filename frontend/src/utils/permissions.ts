import type { UserRole } from '@/types';

/**
 * Frontend mirror of `backend/app/core/permissions.py`.
 *
 * The backend is the enforcement point - every gated endpoint refuses a caller
 * whose role lacks the permission. This table exists so the UI can hide
 * controls that would only produce a 403, and so route guards can bounce a
 * member out of a page they cannot load. Keep the two files in sync.
 *
 *   super_admin  full CRUD everywhere, plus user management
 *   admin        sees everything and may add records - never edit or delete,
 *                but is one of the two roles that approves a member's changes
 *   user         payables desk: calendar, bills, taxes, insurance, payments;
 *                may add bills, taxes and insurance and log payments. Edits and
 *                deletes are filed as change requests (`*.request_change`) for
 *                an admin or super admin to approve.
 */
export type Permission =
  | 'properties.view'
  | 'properties.create'
  | 'properties.edit'
  | 'properties.delete'
  | 'individuals.view'
  | 'individuals.create'
  | 'individuals.edit'
  | 'individuals.delete'
  | 'bills.view'
  | 'bills.create'
  | 'bills.edit'
  | 'bills.delete'
  | 'bills.request_change'
  | 'taxes.view'
  | 'taxes.create'
  | 'taxes.edit'
  | 'taxes.delete'
  | 'taxes.request_change'
  | 'insurance.view'
  | 'insurance.create'
  | 'insurance.edit'
  | 'insurance.delete'
  | 'insurance.request_change'
  | 'change_requests.view'
  | 'change_requests.review'
  | 'payments.view'
  | 'payments.create'
  | 'payments.edit'
  | 'payments.delete'
  | 'documents.view'
  | 'documents.browse'
  | 'documents.create'
  | 'documents.edit'
  | 'documents.delete'
  | 'gold_categories.view'
  | 'gold_categories.create'
  | 'gold_categories.edit'
  | 'gold_categories.delete'
  | 'calendar.view'
  | 'analytics.view'
  | 'reports.view'
  | 'company.view'
  | 'company.create'
  | 'company.edit'
  | 'company.delete'
  | 'alerts.view'
  | 'alerts.edit'
  | 'users.manage';

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  'properties.view', 'properties.create', 'properties.edit', 'properties.delete',
  'individuals.view', 'individuals.create', 'individuals.edit', 'individuals.delete',
  'bills.view', 'bills.create', 'bills.edit', 'bills.delete', 'bills.request_change',
  'taxes.view', 'taxes.create', 'taxes.edit', 'taxes.delete', 'taxes.request_change',
  'insurance.view', 'insurance.create', 'insurance.edit', 'insurance.delete',
  'insurance.request_change',
  'payments.view', 'payments.create', 'payments.edit', 'payments.delete',
  'documents.view', 'documents.browse', 'documents.create',
  'documents.edit', 'documents.delete',
  'gold_categories.view', 'gold_categories.create',
  'gold_categories.edit', 'gold_categories.delete',
  'company.view', 'company.create', 'company.edit', 'company.delete',
  'calendar.view', 'analytics.view', 'reports.view',
  'alerts.view', 'alerts.edit',
  'change_requests.view', 'change_requests.review',
  'users.manage',
];

const ADMIN_PERMISSIONS: Permission[] = [
  'properties.view', 'properties.create',
  'individuals.view', 'individuals.create',
  'bills.view', 'bills.create',
  'taxes.view', 'taxes.create',
  'insurance.view', 'insurance.create',
  'payments.view', 'payments.create',
  'documents.view', 'documents.browse', 'documents.create',
  'gold_categories.view', 'gold_categories.create',
  'company.view', 'company.create',
  'calendar.view', 'analytics.view', 'reports.view',
  'alerts.view',
  // The admin is the checker, never the maker: it reviews members' requests but
  // holds no `*.request_change` of its own, so it cannot file one and then
  // approve it.
  'change_requests.view', 'change_requests.review',
];

const USER_PERMISSIONS: Permission[] = [
  'calendar.view',
  'bills.view', 'bills.create', 'bills.request_change',
  'taxes.view', 'taxes.create', 'taxes.request_change',
  'insurance.view', 'insurance.create', 'insurance.request_change',
  'payments.view', 'payments.create',
  // View + create only, so receipts upload and the payments ledger can resolve
  // them. `documents.browse` - the Documents library page and its full-text
  // search - is withheld.
  'documents.view', 'documents.create',
  'change_requests.view',
];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  super_admin: new Set(SUPER_ADMIN_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
  user: new Set(USER_PERMISSIONS),
};

/** Every permission granted to `role`. An unknown/absent role gets none. */
export function permissionsFor(role: UserRole | null | undefined): ReadonlySet<Permission> {
  return (role && ROLE_PERMISSIONS[role]) || new Set<Permission>();
}

export function roleHasPermission(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  return permissionsFor(role).has(permission);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'Member',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Full access - can add, edit and delete everything, and manage users.',
  admin:
    'Sees everything and can add records. Cannot edit or delete, but approves members’ change requests.',
  user:
    'Payables desk - bills, taxes, insurance, payments and the calendar. Can add and log payments; edits and deletions need approval.',
};

/**
 * Entity types a member can raise a change request against, and the permission
 * that lets them. Mirrors `REQUEST_CHANGE_PERMISSION` in the backend.
 */
export type ChangeEntityType = 'bill' | 'tax' | 'insurance';

export const REQUEST_CHANGE_PERMISSION: Record<ChangeEntityType, Permission> = {
  bill: 'bills.request_change',
  tax: 'taxes.request_change',
  insurance: 'insurance.request_change',
};
