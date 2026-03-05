export const GLOBAL_STORAGE_SCOPE = "global";

function normalizeScopeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function normalizeStorageScope(raw: unknown): string {
  if (typeof raw !== "string") {
    return GLOBAL_STORAGE_SCOPE;
  }
  const normalized = normalizeScopeSegment(raw.trim());
  return normalized || GLOBAL_STORAGE_SCOPE;
}

export function buildScopedStorageKey(baseKey: string, scope?: string): string {
  const normalizedScope = normalizeStorageScope(scope);
  if (normalizedScope === GLOBAL_STORAGE_SCOPE) {
    return baseKey;
  }
  return `${baseKey}__${normalizedScope}`;
}

