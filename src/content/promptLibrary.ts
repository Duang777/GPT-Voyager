export type PromptSnippet = {
  id: string;
  title: string;
  content: string;
  tags: string[];
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

export async function loadPromptLibrary(): Promise<PromptSnippet[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(PROMPT_LIBRARY_STORAGE_KEY, (result) => {
      resolve(sanitizePromptLibrary(result?.[PROMPT_LIBRARY_STORAGE_KEY]));
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
      tags: normalizePromptTags(item.tags)
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function savePromptLibrary(snippets: PromptSnippet[]): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [PROMPT_LIBRARY_STORAGE_KEY]: snippets }, () => resolve());
  });
}
