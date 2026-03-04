import {
  sanitizeClassificationState,
  type ClassificationState
} from "./classificationStore";
import {
  sanitizeConversationIndex,
  type ConversationEntry
} from "./conversationIndex";
import {
  sanitizePromptLibrary,
  type PromptSnippet
} from "./promptLibrary";
import {
  sanitizeFormulaFavorites,
  type FormulaFavorite
} from "./formulaFavoritesStore";
import {
  sanitizeUserSettings,
  type UserSettings
} from "./settingsStore";

export type VoyagerBackupV1 = {
  schemaVersion: 1;
  exportedAt: number;
  app: "gpt-voyager-extension";
  data: {
    conversationIndex: ConversationEntry[];
    classificationState: ClassificationState;
    promptLibrary: PromptSnippet[];
    formulaFavorites: FormulaFavorite[];
    settings: UserSettings;
  };
};

export type BackupParseResult =
  | { ok: true; payload: VoyagerBackupV1 }
  | { ok: false; reason: string };

export function createBackupPayload(input: {
  conversationIndex: ConversationEntry[];
  classificationState: ClassificationState;
  promptLibrary: PromptSnippet[];
  formulaFavorites: FormulaFavorite[];
  settings: UserSettings;
}): VoyagerBackupV1 {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    app: "gpt-voyager-extension",
    data: {
      conversationIndex: sanitizeConversationIndex(input.conversationIndex),
      classificationState: sanitizeClassificationState(input.classificationState),
      promptLibrary: sanitizePromptLibrary(input.promptLibrary),
      formulaFavorites: sanitizeFormulaFavorites(input.formulaFavorites),
      settings: sanitizeUserSettings(input.settings)
    }
  };
}

export function parseBackupPayload(rawText: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: "备份文件不是有效的 JSON" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "备份文件结构无效" };
  }

  const source = parsed as Partial<VoyagerBackupV1> & { data?: unknown };
  if (source.schemaVersion !== 1) {
    return { ok: false, reason: "不支持的备份版本，仅支持 schemaVersion=1" };
  }
  if (!source.data || typeof source.data !== "object") {
    return { ok: false, reason: "备份文件缺少 data 字段" };
  }

  const data = source.data as Partial<VoyagerBackupV1["data"]>;
  return {
    ok: true,
    payload: {
      schemaVersion: 1,
      exportedAt: typeof source.exportedAt === "number" ? source.exportedAt : Date.now(),
      app: "gpt-voyager-extension",
      data: {
        conversationIndex: sanitizeConversationIndex(data.conversationIndex),
        classificationState: sanitizeClassificationState(data.classificationState),
        promptLibrary: sanitizePromptLibrary(data.promptLibrary),
        formulaFavorites: sanitizeFormulaFavorites(data.formulaFavorites),
        settings: sanitizeUserSettings(data.settings)
      }
    }
  };
}

export function createBackupFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `gpt-voyager-backup-${year}${month}${day}-${hour}${minute}${second}.json`;
}
