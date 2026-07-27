/**
 * Case-insensitive client-side search filter, shared across the api/*.ts
 * list hooks (the backend has no full-text search param). Returns `items`
 * unchanged when `term` is empty.
 */
export function applySearch<T>(items: T[], term: string | undefined, getFields: (item: T) => Array<string | null | undefined>): T[] {
  if (!term) return items;
  const needle = term.toLowerCase();
  return items.filter((item) =>
    getFields(item).some((field) => field?.toLowerCase().includes(needle)),
  );
}
