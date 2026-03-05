import { buildScopedStorageKey, normalizeStorageScope } from "./storageScope";

export type MermaidFavorite = {
  id: string;
  alias: string;
  code: string;
  preview: string;
  sourceConversationId: string;
  sourceConversationTitle: string;
  sourceMessageIndex: number;
  createdAt: number;
  updatedAt: number;
};

export const MERMAID_FAVORITES_STORAGE_KEY = "gpt_voyager_mermaid_favorites_v1";

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function normalizeAlias(value: unknown): string {
  return normalizeText(value).slice(0, 60);
}

function normalizePreview(value: unknown): string {
  return normalizeText(value).slice(0, 100);
}

function parseMessageIndex(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return 0;
}

function buildPreview(code: string): string {
  const firstLine = code.split("\n")[0]?.trim() ?? "";
  if (!firstLine) {
    return "(空图表)";
  }
  return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine;
}

function buildAlias(alias: string, preview: string): string {
  if (alias) {
    return alias;
  }
  const compact = preview.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "未命名图表";
  }
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}

export function normalizeMermaidCodeForMatch(code: string): string {
  return code.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function sanitizeMermaidFavorites(raw: unknown): MermaidFavorite[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const dedup = new Set<string>();
  const list: MermaidFavorite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const typed = item as Partial<MermaidFavorite>;
    const id = normalizeText(typed.id);
    const code = normalizeCode(typed.code);
    const sourceConversationId = normalizeText(typed.sourceConversationId);
    if (!id || !code || !sourceConversationId || dedup.has(id)) {
      continue;
    }

    const preview = normalizePreview(typed.preview) || buildPreview(code);
    const alias = buildAlias(normalizeAlias(typed.alias), preview);
    const sourceConversationTitle = normalizeText(typed.sourceConversationTitle) || "未命名会话";
    const sourceMessageIndex = parseMessageIndex(typed.sourceMessageIndex);
    const createdAt = typeof typed.createdAt === "number" ? typed.createdAt : Date.now();
    const updatedAt = typeof typed.updatedAt === "number" ? typed.updatedAt : createdAt;

    list.push({
      id,
      alias,
      code,
      preview,
      sourceConversationId,
      sourceConversationTitle,
      sourceMessageIndex,
      createdAt,
      updatedAt
    });
    dedup.add(id);
  }

  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadMermaidFavorites(): Promise<MermaidFavorite[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const storageKey = buildScopedStorageKey(MERMAID_FAVORITES_STORAGE_KEY);
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      resolve(sanitizeMermaidFavorites(result?.[storageKey]));
    });
  });
}

export async function loadMermaidFavoritesByScope(scope?: string): Promise<MermaidFavorite[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const normalizedScope = normalizeStorageScope(scope);
  const scopedStorageKey = buildScopedStorageKey(MERMAID_FAVORITES_STORAGE_KEY, normalizedScope);
  if (scopedStorageKey === MERMAID_FAVORITES_STORAGE_KEY) {
    return loadMermaidFavorites();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([scopedStorageKey, MERMAID_FAVORITES_STORAGE_KEY], (result) => {
      const scopedValue = result?.[scopedStorageKey];
      if (scopedValue !== undefined) {
        resolve(sanitizeMermaidFavorites(scopedValue));
        return;
      }
      resolve(sanitizeMermaidFavorites(result?.[MERMAID_FAVORITES_STORAGE_KEY]));
    });
  });
}

export async function saveMermaidFavorites(items: MermaidFavorite[], scope?: string): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  const storageKey = buildScopedStorageKey(MERMAID_FAVORITES_STORAGE_KEY, scope);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [storageKey]: sanitizeMermaidFavorites(items) }, () => resolve());
  });
}

export function createMermaidFavoriteId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `mermaid_fav_${Date.now().toString(36)}_${random}`;
}
