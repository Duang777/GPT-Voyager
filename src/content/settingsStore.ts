export type ExportFormat = "markdown" | "html";
export type PromptInsertMode = "append" | "replace";
export type ConversationCardDensity = "compact" | "minimal" | "standard";
export type ConversationSortMode = "recent_desc" | "title_asc";

export type UserSettings = {
  version: 1;
  autoScanEnabled: boolean;
  scanIntervalSec: number;
  promptInsertMode: PromptInsertMode;
  defaultExportFormat: ExportFormat;
  enableShortcuts: boolean;
  formulaClickCopyEnabled: boolean;
  chatContentWidthPercent: number;
  conversationCardDensity: ConversationCardDensity;
  conversationSortMode: ConversationSortMode;
  accountIsolationEnabled: boolean;
  accountIsolationManualScope: string;
  quoteReplyEnabled: boolean;
};

export const SETTINGS_STORAGE_KEY = "gpt_voyager_settings_v1";

export function createDefaultSettings(): UserSettings {
  return {
    version: 1,
    autoScanEnabled: true,
    scanIntervalSec: 5,
    promptInsertMode: "append",
    defaultExportFormat: "markdown",
    enableShortcuts: true,
    formulaClickCopyEnabled: true,
    chatContentWidthPercent: 78,
    conversationCardDensity: "standard",
    conversationSortMode: "recent_desc",
    accountIsolationEnabled: false,
    accountIsolationManualScope: "",
    quoteReplyEnabled: true
  };
}

function clampScanInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(60, Math.max(2, Math.round(value)));
}

function parseInsertMode(value: unknown): PromptInsertMode {
  return value === "replace" ? "replace" : "append";
}

function parseExportFormat(value: unknown): ExportFormat {
  return value === "html" ? "html" : "markdown";
}

function parseConversationCardDensity(value: unknown): ConversationCardDensity {
  if (value === "compact") {
    return "compact";
  }
  if (value === "minimal") {
    return "minimal";
  }
  return "standard";
}

function parseConversationSortMode(value: unknown): ConversationSortMode {
  return value === "title_asc" ? "title_asc" : "recent_desc";
}

function clampChatContentWidthPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 78;
  }
  return Math.min(96, Math.max(64, Math.round(value)));
}

function normalizeManualScope(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.@-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function sanitizeUserSettings(raw: unknown): UserSettings {
  const defaults = createDefaultSettings();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Partial<UserSettings>;
  return {
    version: 1,
    autoScanEnabled: source.autoScanEnabled !== undefined ? Boolean(source.autoScanEnabled) : defaults.autoScanEnabled,
    scanIntervalSec:
      source.scanIntervalSec !== undefined ? clampScanInterval(source.scanIntervalSec) : defaults.scanIntervalSec,
    promptInsertMode: parseInsertMode(source.promptInsertMode),
    defaultExportFormat: parseExportFormat(source.defaultExportFormat),
    enableShortcuts: source.enableShortcuts !== undefined ? Boolean(source.enableShortcuts) : defaults.enableShortcuts,
    formulaClickCopyEnabled:
      source.formulaClickCopyEnabled !== undefined
        ? Boolean(source.formulaClickCopyEnabled)
        : defaults.formulaClickCopyEnabled,
    chatContentWidthPercent:
      source.chatContentWidthPercent !== undefined
        ? clampChatContentWidthPercent(source.chatContentWidthPercent)
        : defaults.chatContentWidthPercent,
    conversationCardDensity: parseConversationCardDensity(source.conversationCardDensity),
    conversationSortMode: parseConversationSortMode(source.conversationSortMode),
    accountIsolationEnabled:
      source.accountIsolationEnabled !== undefined
        ? Boolean(source.accountIsolationEnabled)
        : defaults.accountIsolationEnabled,
    accountIsolationManualScope:
      source.accountIsolationManualScope !== undefined
        ? normalizeManualScope(source.accountIsolationManualScope)
        : defaults.accountIsolationManualScope,
    quoteReplyEnabled:
      source.quoteReplyEnabled !== undefined ? Boolean(source.quoteReplyEnabled) : defaults.quoteReplyEnabled
  };
}

export async function loadUserSettings(): Promise<UserSettings> {
  if (!chrome?.storage?.local) {
    return createDefaultSettings();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_STORAGE_KEY, (result) => {
      resolve(sanitizeUserSettings(result?.[SETTINGS_STORAGE_KEY]));
    });
  });
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings }, () => resolve());
  });
}
