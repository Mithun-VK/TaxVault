import { slugifyCategory } from './constants';

/**
 * Per-browser custom categories for the user-extensible pickers (tax types,
 * insurance types, company document types). Mirrors the custom gold-category /
 * owner pattern - persisted in localStorage so a category the user adds sticks
 * around across sessions even before a record uses it. Bills derive their
 * categories from data instead.
 *
 * `company_document` is a special case: the API validates `category` against a
 * fixed enum, so a custom company document type is stored as category "other"
 * with the type name as its label. The entry here only keeps that name in the
 * picker so it can be reused.
 */
export type CategoryDomain = 'tax' | 'insurance' | 'company_document';

export interface CustomCategory {
  value: string;
  label: string;
}

const storageKey = (domain: CategoryDomain) => `taxvault:custom-categories:${domain}`;

export function loadCustomCategories(domain: CategoryDomain): CustomCategory[] {
  try {
    const raw = localStorage.getItem(storageKey(domain));
    const parsed = raw ? (JSON.parse(raw) as CustomCategory[]) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => c && c.value && c.label) : [];
  } catch {
    return [];
  }
}

/**
 * Add a custom category. `taken` is the set of built-in values to avoid
 * duplicating. Returns the updated custom list.
 */
export function addCustomCategory(
  domain: CategoryDomain,
  name: string,
  taken: string[],
): CustomCategory[] {
  const value = slugifyCategory(name);
  const label = name.trim();
  const custom = loadCustomCategories(domain);
  const takenSet = new Set([...taken, ...custom.map((c) => c.value)]);
  if (!value || takenSet.has(value)) return custom;
  const next = [...custom, { value, label }];
  try {
    localStorage.setItem(storageKey(domain), JSON.stringify(next));
  } catch {
    /* ignore quota / disabled storage */
  }
  return next;
}
