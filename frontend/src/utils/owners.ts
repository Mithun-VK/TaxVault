import { ASSET_OWNERS } from './constants';

/**
 * Asset owners = the built-in ASSET_OWNERS plus any owners the user adds on the
 * fly, persisted per-browser (mirrors the custom gold-category pattern). Kept in
 * localStorage because owners are a small, client-managed lookup.
 */
const CUSTOM_KEY = 'taxvault:custom-owners';

export function loadCustomOwners(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((o) => typeof o === 'string' && o.trim()) : [];
  } catch {
    return [];
  }
}

function saveCustomOwners(list: string[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Add a custom owner; returns the updated custom list. Ignores blanks/duplicates. */
export function addCustomOwner(name: string): string[] {
  const label = name.trim();
  const custom = loadCustomOwners();
  const taken = new Set<string>([...ASSET_OWNERS, ...custom].map((o) => o.toLowerCase()));
  if (!label || taken.has(label.toLowerCase())) return custom;
  const next = [...custom, label];
  saveCustomOwners(next);
  return next;
}

/** Every selectable owner: built-ins + custom (+ the current value if unlisted). */
export function allOwners(custom: string[], current?: string): string[] {
  const list: string[] = [...ASSET_OWNERS, ...custom];
  if (current && current.trim() && !list.some((o) => o.toLowerCase() === current.toLowerCase())) {
    list.push(current);
  }
  return list;
}
