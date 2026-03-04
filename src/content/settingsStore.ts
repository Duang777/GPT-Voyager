export type ExportFormat = "markdown" | "html";
export type PromptInsertMode = "append" | "replace";

export type UserSettings = {
  version: 1;
  autoScanEnabled: boolean;
  scanIntervalSec: number;
  promptInsertMode: PromptInsertMode;
  defaultExportFormat: ExportFormat;
  enableShortcuts: boolean;
  formulaClickCopyEnabled: boolean;
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
    formulaClickCopyEnabled: true
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
        : defaults.formulaClickCopyEnabled
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
