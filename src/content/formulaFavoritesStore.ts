import type { FormulaDisplayMode, FormulaSource } from "./conversationFormula";

export type FormulaFavorite = {
  id: string;
  tex: string;
  mathml?: string;
  alias: string;
  source: FormulaSource;
  displayMode: FormulaDisplayMode;
  sourceConversationId: string;
  sourceConversationTitle: string;
  createdAt: number;
  updatedAt: number;
};

export const FORMULA_FAVORITES_STORAGE_KEY = "gpt_voyager_formula_favorites_v1";

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAlias(value: unknown): string {
  const normalized = normalizeText(value);
  return normalized.slice(0, 60);
}

function normalizeTex(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function normalizeMathml(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function parseSource(value: unknown): FormulaSource {
  return value === "mathjax" ? "mathjax" : "katex";
}

function parseDisplayMode(value: unknown): FormulaDisplayMode {
  return value === "display" ? "display" : "inline";
}

function buildAlias(tex: string, alias: string): string {
  if (alias) {
    return alias;
  }
  const compact = tex.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "未命名公式";
  }
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}

export function sanitizeFormulaFavorites(raw: unknown): FormulaFavorite[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const dedup = new Set<string>();
  const list: FormulaFavorite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const typed = item as Partial<FormulaFavorite>;
    const id = normalizeText(typed.id);
    const tex = normalizeTex(typed.tex);
    const sourceConversationId = normalizeText(typed.sourceConversationId);
    if (!id || !tex || !sourceConversationId || dedup.has(id)) {
      continue;
    }
    const mathml = normalizeMathml(typed.mathml);
    const createdAt = typeof typed.createdAt === "number" ? typed.createdAt : Date.now();
    const updatedAt = typeof typed.updatedAt === "number" ? typed.updatedAt : createdAt;
    const alias = buildAlias(tex, normalizeAlias(typed.alias));
    list.push({
      id,
      tex,
      mathml: mathml || undefined,
      alias,
      source: parseSource(typed.source),
      displayMode: parseDisplayMode(typed.displayMode),
      sourceConversationId,
      sourceConversationTitle: normalizeText(typed.sourceConversationTitle) || "未命名会话",
      createdAt,
      updatedAt
    });
    dedup.add(id);
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadFormulaFavorites(): Promise<FormulaFavorite[]> {
  if (!chrome?.storage?.local) {
    return [];
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(FORMULA_FAVORITES_STORAGE_KEY, (result) => {
      resolve(sanitizeFormulaFavorites(result?.[FORMULA_FAVORITES_STORAGE_KEY]));
    });
  });
}

export async function saveFormulaFavorites(items: FormulaFavorite[]): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [FORMULA_FAVORITES_STORAGE_KEY]: sanitizeFormulaFavorites(items) }, () => resolve());
  });
}

export function createFormulaFavoriteId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `formula_fav_${Date.now().toString(36)}_${random}`;
}
