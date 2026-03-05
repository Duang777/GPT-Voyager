import { buildScopedStorageKey, normalizeStorageScope } from "./storageScope";

export type PromptVariablePreset = {
  id: string;
  name: string;
  values: Record<string, string>;
  createdAt: number;
  updatedAt: number;
};

export type PromptSnippet = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  variablePresets: PromptVariablePreset[];
  createdAt: number;
  updatedAt: number;
};

export const PROMPT_LIBRARY_STORAGE_KEY = "gpt_voyager_prompt_library_v1";

export function normalizePromptTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePromptContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

const PROMPT_VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function normalizePromptTag(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function normalizePromptPresetName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 32);
}

export function normalizePromptPresetValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(source)) {
    const variable = key.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!variable || typeof raw !== "string") {
      continue;
    }
    const content = raw.replace(/\r\n/g, "\n").trim();
    if (!content) {
      continue;
    }
    normalized[variable] = content.slice(0, 600);
    if (Object.keys(normalized).length >= 30) {
      break;
    }
  }
  return normalized;
}

export function sanitizePromptVariablePresets(raw: unknown): PromptVariablePreset[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const deduplicated = new Map<string, PromptVariablePreset>();
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const typed = item as Partial<PromptVariablePreset>;
    const name = normalizePromptPresetName(typeof typed.name === "string" ? typed.name : "");
    const values = normalizePromptPresetValues(typed.values);
    if (!name || Object.keys(values).length === 0) {
      continue;
    }

    const now = Date.now();
    const createdAt = typeof typed.createdAt === "number" ? typed.createdAt : now;
    const updatedAt = typeof typed.updatedAt === "number" ? typed.updatedAt : createdAt;
    const id =
      typeof typed.id === "string" && typed.id.trim()
        ? typed.id.trim()
        : `preset_${updatedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const next: PromptVariablePreset = {
      id,
      name,
      values,
      createdAt,
      updatedAt
    };
    const dedupeKey = name.toLocaleLowerCase();
    const existing = deduplicated.get(dedupeKey);
    if (!existing || existing.updatedAt < next.updatedAt) {
      deduplicated.set(dedupeKey, next);
    }
    if (deduplicated.size >= 12) {
      break;
    }
  }

  return Array.from(deduplicated.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function normalizePromptTags(value: unknown): string[] {
  const source =
    typeof value === "string"
      ? value.split(/[,，;\n]+/g)
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];

  const deduplicated = new Map<string, string>();
  for (const rawTag of source) {
    const tag = normalizePromptTag(rawTag);
    if (!tag) {
      continue;
    }
    const key = tag.toLocaleLowerCase();
    if (!deduplicated.has(key)) {
      deduplicated.set(key, tag);
    }
    if (deduplicated.size >= 12) {
      break;
    }
  }
  return Array.from(deduplicated.values());
}

export function extractPromptVariables(content: string): string[] {
  const normalized = normalizePromptContent(content);
  if (!normalized) {
    return [];
  }

  const found = new Map<string, string>();
  let matched = PROMPT_VARIABLE_REGEX.exec(normalized);
  while (matched) {
    const variable = matched[1]?.trim();
    if (variable && !found.has(variable)) {
      found.set(variable, variable);
    }
    matched = PROMPT_VARIABLE_REGEX.exec(normalized);
  }
  PROMPT_VARIABLE_REGEX.lastIndex = 0;
  return Array.from(found.values());
}

export function fillPromptVariables(
  content: string,
  values: Record<string, string>
): string {
  const normalized = normalizePromptContent(content);
  return normalized.replace(PROMPT_VARIABLE_REGEX, (_all, variableName: string) => {
    const key = variableName.trim();
    const value = values[key];
    if (value === undefined) {
      return `{{${key}}}`;
    }
    return value;
  });
}

export function createPromptId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `prompt_${Date.now().toString(36)}_${random}`;
}

export function createPromptPresetId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `preset_${Date.now().toString(36)}_${random}`;
}

export async function loadPromptLibrary(): Promise<PromptSnippet[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const storageKey = buildScopedStorageKey(PROMPT_LIBRARY_STORAGE_KEY);
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      resolve(sanitizePromptLibrary(result?.[storageKey]));
    });
  });
}

export function sanitizePromptLibrary(raw: unknown): PromptSnippet[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is PromptSnippet => {
      return (
        typeof item?.id === "string" &&
        typeof item?.title === "string" &&
        typeof item?.content === "string" &&
        typeof item?.createdAt === "number" &&
        typeof item?.updatedAt === "number"
      );
    })
    .map((item) => ({
      ...item,
      tags: normalizePromptTags(item.tags),
      variablePresets: sanitizePromptVariablePresets((item as { variablePresets?: unknown }).variablePresets)
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadPromptLibraryByScope(scope?: string): Promise<PromptSnippet[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const normalizedScope = normalizeStorageScope(scope);
  const scopedStorageKey = buildScopedStorageKey(PROMPT_LIBRARY_STORAGE_KEY, normalizedScope);
  if (scopedStorageKey === PROMPT_LIBRARY_STORAGE_KEY) {
    return loadPromptLibrary();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([scopedStorageKey, PROMPT_LIBRARY_STORAGE_KEY], (result) => {
      const scopedValue = result?.[scopedStorageKey];
      if (scopedValue !== undefined) {
        resolve(sanitizePromptLibrary(scopedValue));
        return;
      }
      resolve(sanitizePromptLibrary(result?.[PROMPT_LIBRARY_STORAGE_KEY]));
    });
  });
}

export async function savePromptLibrary(snippets: PromptSnippet[], scope?: string): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  const storageKey = buildScopedStorageKey(PROMPT_LIBRARY_STORAGE_KEY, scope);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [storageKey]: snippets }, () => resolve());
  });
}
