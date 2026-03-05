import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyClassificationState,
  createEntityId,
  isDuplicateName,
  loadClassificationStateByScope,
  normalizeName,
  saveClassificationState,
  type ClassificationState,
  type ConversationClassificationMeta
} from "./classificationStore";
import {
  collectVisibleConversations,
  type ConversationEntry,
  loadConversationIndexByScope,
  mergeConversationIndex,
  observeConversationList,
  saveConversationIndex
} from "./conversationIndex";
import {
  exportCurrentConversationToHtml,
  exportCurrentConversationToMarkdown,
  exportCurrentConversationToPdf,
  extractMessageHtmlFromNode,
  extractMessageMarkdownFromNode
} from "./conversationExport";
import {
  collectConversationTimelineNodes,
  observeConversationThread,
  type ConversationTimelineItem,
  type TimelineRole
} from "./conversationTimeline";
import {
  collectConversationFormulaNodes,
  extractFormulaFromTarget,
  type ConversationFormulaItem,
  type FormulaDisplayMode
} from "./conversationFormula";
import {
  collectConversationMermaidNodes,
  type ConversationMermaidItem
} from "./conversationMermaid";
import { renderMermaidSvg } from "./mermaidRender";
import {
  createPromptId,
  createPromptPresetId,
  extractPromptVariables,
  fillPromptVariables,
  loadPromptLibraryByScope,
  normalizePromptContent,
  normalizePromptPresetName,
  normalizePromptPresetValues,
  normalizePromptTags,
  normalizePromptTitle,
  sanitizePromptVariablePresets,
  savePromptLibrary,
  type PromptVariablePreset,
  type PromptSnippet
} from "./promptLibrary";
import {
  createFormulaFavoriteId,
  loadFormulaFavoritesByScope,
  saveFormulaFavorites,
  type FormulaFavorite
} from "./formulaFavoritesStore";
import {
  createMermaidFavoriteId,
  loadMermaidFavoritesByScope,
  normalizeMermaidCodeForMatch,
  saveMermaidFavorites,
  type MermaidFavorite
} from "./mermaidFavoritesStore";
import {
  buildTimelineAnnotationKey,
  createTimelineAnnotationId,
  loadTimelineAnnotationsByScope,
  normalizeTimelineAnnotationTags,
  saveTimelineAnnotations,
  type TimelineNodeAnnotation
} from "./timelineAnnotationsStore";
import {
  createDefaultSettings,
  loadUserSettings,
  saveUserSettings,
  type ConversationCardDensity,
  type ConversationSortMode,
  type UserSettings
} from "./settingsStore";
import {
  createBackupFileName,
  createBackupPayload,
  parseBackupPayload
} from "./dataBackup";
import { detectAccountScope, type AccountScopeInfo } from "./accountScope";
import { normalizeStorageScope } from "./storageScope";

type PanelState = {
  collapsed: boolean;
  width: number;
};

type ViewKey = "conversations" | "prompts" | "guide" | "settings";
type ConversationWorkspaceKey =
  | "home"
  | "overview"
  | "export"
  | "starred"
  | "timeline"
  | "formula"
  | "mermaid"
  | "classification"
  | "index";

type SelectOption<Value extends string> = {
  value: Value;
  label: string;
};

type BatchUndoSnapshot = {
  ids: string[];
  beforeMetaByConversationId: Record<string, ConversationClassificationMeta | undefined>;
  actionLabel: string;
  createdAt: number;
};

type PromptTemplateTransferPreset = {
  name: string;
  values: Record<string, string>;
};

type PromptTemplateTransferItem = {
  title: string;
  content: string;
  tags: string[];
  variablePresets: PromptTemplateTransferPreset[];
};

type PromptTemplateTransferPayload = {
  schemaVersion: 1;
  app: "gpt-voyager-prompt-template";
  exportedAt: number;
  prompt: PromptTemplateTransferItem;
};

type PromptTemplateBatchTransferPayload = {
  schemaVersion: 1;
  app: "gpt-voyager-prompt-template-batch";
  exportedAt: number;
  prompts: PromptTemplateTransferItem[];
};

type TimelineExportContent = {
  item: ConversationTimelineItem;
  annotation?: TimelineNodeAnnotation;
  content: string;
};

const PANEL_STORAGE_KEY = "gpt_voyager_panel_state";
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 360;
const EXTENSION_HOST_ID = "gpt-voyager-host";
const TIMELINE_HIGHLIGHT_STYLE_ID = "gpt-voyager-timeline-highlight-style";
const TIMELINE_HIGHLIGHT_ATTR = "data-gv-timeline-highlighted";
const CHAT_WIDTH_STYLE_ID = "gpt-voyager-chat-content-width-style";
const CONVERSATION_ROW_HEIGHT_COMPACT = 174;
const CONVERSATION_ROW_HEIGHT_MINIMAL = 164;
const CONVERSATION_ROW_HEIGHT_STANDARD = 188;
const CONVERSATION_VIRTUAL_OVERSCAN = 6;
const CONVERSATION_LIST_FALLBACK_HEIGHT = 520;
const QUOTE_REPLY_BADGE_ID = "gpt-voyager-quote-reply-badge";
const EMPTY_META: ConversationClassificationMeta = { tagIds: [] };
const CONVERSATION_WORKSPACE_LABELS: Record<Exclude<ConversationWorkspaceKey, "home">, string> = {
  overview: "总览",
  export: "导出中心",
  starred: "星标会话",
  timeline: "会话时间线",
  formula: "公式工作台",
  mermaid: "Mermaid 工作台",
  classification: "分类管理",
  index: "会话索引"
};
const CONVERSATION_SORT_OPTIONS: Array<SelectOption<ConversationSortMode>> = [
  { value: "recent_desc", label: "按最近活跃" },
  { value: "title_asc", label: "按标题 A-Z" }
];
const CONVERSATION_DENSITY_OPTIONS: Array<SelectOption<ConversationCardDensity>> = [
  { value: "standard", label: "标准" },
  { value: "compact", label: "紧凑" },
  { value: "minimal", label: "极简紧凑" }
];
const SCAN_INTERVAL_OPTIONS: Array<SelectOption<string>> = [
  { value: "2", label: "2" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "30", label: "30" }
];
const PROMPT_INSERT_MODE_OPTIONS: Array<SelectOption<UserSettings["promptInsertMode"]>> = [
  { value: "append", label: "追加到输入框" },
  { value: "replace", label: "覆盖输入框" }
];
const DEFAULT_EXPORT_FORMAT_OPTIONS: Array<SelectOption<UserSettings["defaultExportFormat"]>> = [
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" }
];

function resolveActiveStorageScope(settings: UserSettings, detected: AccountScopeInfo): string {
  if (!settings.accountIsolationEnabled) {
    return "global";
  }
  const manual = normalizeStorageScope(settings.accountIsolationManualScope);
  if (manual && manual !== "global") {
    return manual;
  }
  return normalizeStorageScope(detected.scope);
}

function isNodeInsideVoyagerHost(node: Node | null): boolean {
  if (!node) {
    return false;
  }
  const host = document.getElementById(EXTENSION_HOST_ID);
  if (host && host.contains(node)) {
    return true;
  }
  const root = node.getRootNode();
  return root instanceof ShadowRoot && root.host?.id === EXTENSION_HOST_ID;
}

async function loadPanelState(): Promise<PanelState> {
  if (!chrome?.storage?.local) {
    return { collapsed: false, width: DEFAULT_WIDTH };
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(PANEL_STORAGE_KEY, (result) => {
      const raw = result?.[PANEL_STORAGE_KEY] as Partial<PanelState> | undefined;
      const width = typeof raw?.width === "number" ? raw.width : DEFAULT_WIDTH;
      const collapsed = Boolean(raw?.collapsed);
      resolve({
        collapsed,
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
      });
    });
  });
}

async function savePanelState(state: PanelState): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [PANEL_STORAGE_KEY]: state }, () => resolve());
  });
}

function getCurrentConversationId(): string {
  const matched = window.location.pathname.match(/^\/c\/([a-zA-Z0-9-]+)/);
  return matched?.[1] ?? "";
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "-";
  }
}

function openConversation(url: string): void {
  window.location.href = url;
}

function timelineRoleLabel(role: TimelineRole): string {
  if (role === "user") {
    return "用户";
  }
  if (role === "assistant") {
    return "助手";
  }
  if (role === "tool") {
    return "工具";
  }
  return "未知";
}

function formulaDisplayLabel(mode: FormulaDisplayMode): string {
  return mode === "display" ? "块级" : "行内";
}

function normalizeFormulaTexForMatch(tex: string): string {
  return tex.replace(/\s+/g, " ").trim();
}

function createFormulaAlias(tex: string): string {
  const compact = normalizeFormulaTexForMatch(tex);
  if (!compact) {
    return "未命名公式";
  }
  return compact.length > 24 ? `${compact.slice(0, 24)}…` : compact;
}

function buildFormulaFavoriteKey(
  conversationId: string,
  displayMode: FormulaDisplayMode,
  tex: string
): string {
  return `${conversationId}::${displayMode}::${normalizeFormulaTexForMatch(tex)}`;
}

function createMermaidAlias(code: string): string {
  const firstLine = code.split("\n")[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (!firstLine) {
    return "未命名图表";
  }
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
}

function buildMermaidFavoriteKey(conversationId: string, code: string): string {
  return `${conversationId}::${normalizeMermaidCodeForMatch(code)}`;
}

function getConversationTitleForExport(): string {
  const activeLink = document.querySelector<HTMLAnchorElement>('a[href^="/c/"][aria-current="page"]');
  if (activeLink?.textContent?.trim()) {
    return activeLink.textContent.trim();
  }
  const titleFromDocument = document.title.replace(/\s*-\s*ChatGPT\s*$/i, "").trim();
  if (titleFromDocument) {
    return titleFromDocument;
  }
  return "未命名会话";
}

function sanitizeExportFileName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  const compact = base.replace(/\s+/g, "_");
  if (!compact) {
    return "chatgpt-conversation";
  }
  return compact.slice(0, 80);
}

function clampChatContentWidthPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 78;
  }
  return Math.min(96, Math.max(64, Math.round(value)));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTimelineMarkdown(
  title: string,
  url: string,
  nodes: TimelineExportContent[],
  query: string,
  roleFilter: "all" | TimelineRole,
  tagFilter: string
): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const filterRoleText = roleFilter === "all" ? "全部角色" : timelineRoleLabel(roleFilter);
  const filterQueryText = query.trim() || "(空)";
  const filterTagText = tagFilter === "all" ? "全部标签" : tagFilter;
  const lines: string[] = [];
  lines.push(`# ${title} - 会话时间线导出`);
  lines.push("");
  lines.push(`- 导出时间：${exportedAt}`);
  lines.push(`- 会话链接：${url}`);
  lines.push(`- 节点数量：${nodes.length}`);
  lines.push(`- 角色筛选：${filterRoleText}`);
  lines.push(`- 标签筛选：${filterTagText}`);
  lines.push(`- 关键词筛选：${filterQueryText}`);
  lines.push("");
  for (const node of nodes) {
    lines.push(`## 第 ${node.item.index} 条 · ${timelineRoleLabel(node.item.role)} · ${node.item.charCount} 字`);
    if (node.annotation?.highlighted) {
      lines.push("- 高亮标注：是");
    }
    if (node.annotation && node.annotation.tags.length > 0) {
      lines.push(`- 节点标签：${node.annotation.tags.join("、")}`);
    }
    lines.push("");
    lines.push(node.content || "(空消息)");
    lines.push("");
  }
  return lines.join("\n");
}

function buildTimelineHtml(
  title: string,
  url: string,
  nodes: TimelineExportContent[],
  query: string,
  roleFilter: "all" | TimelineRole,
  tagFilter: string
): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const filterRoleText = roleFilter === "all" ? "全部角色" : timelineRoleLabel(roleFilter);
  const filterQueryText = query.trim() || "(空)";
  const filterTagText = tagFilter === "all" ? "全部标签" : tagFilter;
  const body = nodes
    .map((node) => {
      const notes: string[] = [];
      if (node.annotation?.highlighted) {
        notes.push('<div class="timeline-note timeline-note-highlight">高亮标注：是</div>');
      }
      if (node.annotation && node.annotation.tags.length > 0) {
        notes.push(`<div class="timeline-note">节点标签：${escapeHtml(node.annotation.tags.join("、"))}</div>`);
      }
      return `
<section class="timeline-item">
  <h2>第 ${node.item.index} 条 · ${timelineRoleLabel(node.item.role)} · ${node.item.charCount} 字</h2>
  ${notes.join("\n  ")}
  <div class="timeline-content">${node.content}</div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - 会话时间线导出</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    body {
      margin: 0;
      padding: 28px;
      color: #111;
      background: #f7f8fb;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.65;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e3e8f2;
      border-radius: 14px;
      box-shadow: 0 8px 22px rgba(27, 39, 71, 0.08);
      padding: 24px 26px;
    }
    h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.35; }
    .meta {
      margin: 0 0 18px;
      padding-left: 20px;
      color: #3d4c6a;
      font-size: 14px;
    }
    .timeline-item {
      border-top: 1px solid #e8edf6;
      padding-top: 16px;
      margin-top: 16px;
    }
    .timeline-item h2 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.35;
    }
    .timeline-note {
      margin: 0 0 7px;
      color: #5a6270;
      font-size: 14px;
    }
    .timeline-note-highlight {
      color: #0f8064;
      font-weight: 600;
    }
    .timeline-content pre {
      overflow-x: auto;
      background: #0e1420;
      color: #e7ecf9;
      padding: 10px 12px;
      border-radius: 8px;
    }
    .timeline-content code {
      font-family: "Consolas", "SFMono-Regular", Menlo, monospace;
      font-size: 0.95em;
    }
    .timeline-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    .timeline-content th, .timeline-content td {
      border: 1px solid #d9e1ef;
      padding: 6px 8px;
      text-align: left;
    }
    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 0;
    }
  </style>
</head>
<body>
  <main class="container">
    <h1>${escapeHtml(title)} - 会话时间线导出</h1>
    <ul class="meta">
      <li>导出时间：${escapeHtml(exportedAt)}</li>
      <li>会话链接：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>
      <li>节点数量：${nodes.length}</li>
      <li>角色筛选：${escapeHtml(filterRoleText)}</li>
      <li>标签筛选：${escapeHtml(filterTagText)}</li>
      <li>关键词筛选：${escapeHtml(filterQueryText)}</li>
    </ul>
    ${body}
  </main>
</body>
</html>`;
}

function upsertConversationMeta(
  source: Record<string, ConversationClassificationMeta>,
  conversationId: string,
  nextMeta: ConversationClassificationMeta
): Record<string, ConversationClassificationMeta> {
  const hasFolder = Boolean(nextMeta.folderId);
  const hasTags = nextMeta.tagIds.length > 0;
  const hasStar = Boolean(nextMeta.starred);
  const hasNote = Boolean(nextMeta.note?.trim());
  if (!hasFolder && !hasTags && !hasStar && !hasNote) {
    const { [conversationId]: _removed, ...rest } = source;
    return rest;
  }

  return {
    ...source,
    [conversationId]: {
      folderId: nextMeta.folderId,
      tagIds: Array.from(new Set(nextMeta.tagIds)),
      starred: hasStar,
      note: hasNote ? nextMeta.note?.trim() : undefined
    }
  };
}

function cloneConversationMeta(meta: ConversationClassificationMeta | undefined): ConversationClassificationMeta | undefined {
  if (!meta) {
    return undefined;
  }
  return {
    folderId: meta.folderId,
    tagIds: [...meta.tagIds],
    starred: meta.starred,
    note: meta.note
  };
}

function normalizeMetaForCompare(meta: ConversationClassificationMeta | undefined): {
  folderId: string;
  tagIds: string[];
  starred: boolean;
  note: string;
} {
  return {
    folderId: meta?.folderId ?? "",
    tagIds: Array.from(new Set(meta?.tagIds ?? [])).sort((a, b) => a.localeCompare(b)),
    starred: Boolean(meta?.starred),
    note: meta?.note?.trim() ?? ""
  };
}

function isConversationMetaEqual(
  left: ConversationClassificationMeta | undefined,
  right: ConversationClassificationMeta | undefined
): boolean {
  const normalizedLeft = normalizeMetaForCompare(left);
  const normalizedRight = normalizeMetaForCompare(right);
  if (normalizedLeft.folderId !== normalizedRight.folderId) {
    return false;
  }
  if (normalizedLeft.starred !== normalizedRight.starred) {
    return false;
  }
  if (normalizedLeft.note !== normalizedRight.note) {
    return false;
  }
  if (normalizedLeft.tagIds.length !== normalizedRight.tagIds.length) {
    return false;
  }
  return normalizedLeft.tagIds.every((tag, index) => tag === normalizedRight.tagIds[index]);
}

function getMetaOrEmpty(state: ClassificationState, conversationId: string): ConversationClassificationMeta {
  return state.metaByConversationId[conversationId] ?? EMPTY_META;
}

function setTextAreaValue(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return element.getClientRects().length > 0;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target.closest("[contenteditable='true']"));
}

function findComposerTarget(): HTMLTextAreaElement | HTMLElement | null {
  const selectors = [
    "textarea#prompt-textarea",
    "textarea[data-testid='prompt-textarea']",
    "div#prompt-textarea[contenteditable='true']",
    "#prompt-textarea[contenteditable='true']",
    "main [contenteditable='true'][data-lexical-editor='true']",
    "main [contenteditable='true'][role='textbox']"
  ];

  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node) {
      continue;
    }
    if (!isVisibleElement(node)) {
      continue;
    }
    return node as HTMLTextAreaElement | HTMLElement;
  }

  return null;
}

function dispatchComposerInput(element: HTMLElement, inserted: string): void {
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType: "insertText",
      data: inserted
    })
  );
}

function appendToTextarea(textarea: HTMLTextAreaElement, content: string, mode: "append" | "replace"): boolean {
  if (mode === "replace") {
    textarea.focus();
    setTextAreaValue(textarea, content);
    textarea.setSelectionRange(content.length, content.length);
    dispatchComposerInput(textarea, content);
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const value = textarea.value ?? "";
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const prefix = start > 0 && !value.slice(0, start).endsWith("\n") ? "\n" : "";
  const inserted = `${prefix}${content}`;
  const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;

  textarea.focus();
  setTextAreaValue(textarea, next);
  const caret = start + inserted.length;
  textarea.setSelectionRange(caret, caret);
  dispatchComposerInput(textarea, inserted);
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function appendToContentEditable(editable: HTMLElement, content: string, mode: "append" | "replace"): boolean {
  if (mode === "replace") {
    editable.focus();
    editable.textContent = content;
    dispatchComposerInput(editable, content);
    return true;
  }

  const existing = editable.innerText ?? "";
  const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
  const inserted = `${prefix}${content}`;

  editable.focus();
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  let insertedByCommand = false;
  if (document.execCommand) {
    insertedByCommand = document.execCommand("insertText", false, inserted);
  }

  if (!insertedByCommand) {
    editable.textContent = `${editable.textContent ?? ""}${inserted}`;
  }

  dispatchComposerInput(editable, inserted);
  return true;
}

function insertPromptToComposer(content: string, mode: "append" | "replace"): boolean {
  const normalized = normalizePromptContent(content);
  if (!normalized) {
    return false;
  }

  const composer = findComposerTarget();
  if (!composer) {
    return false;
  }

  if (composer instanceof HTMLTextAreaElement) {
    return appendToTextarea(composer, normalized, mode);
  }

  if (composer.isContentEditable || composer.getAttribute("contenteditable") === "true") {
    return appendToContentEditable(composer, normalized, mode);
  }

  return false;
}

function toQuotedReplyText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  const lines = normalized.split("\n").map((line) => line.trimEnd());
  const quoted = lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
  return `${quoted}\n\n`;
}

async function copyPromptText(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

type WordMathCopyResult = "ok" | "fallback_tex" | "failed";

function ensureMathmlNamespace(mathml: string): string {
  const normalized = mathml.trim();
  if (!normalized) {
    return "";
  }
  if (!/<math[\s>]/i.test(normalized)) {
    return "";
  }
  if (/<math[^>]*\sxmlns=/i.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/<math(\s|>)/i, '<math xmlns="http://www.w3.org/1998/Math/MathML"$1');
}

function buildWordMathClipboardHtml(mathml: string): string {
  return `<!doctype html><html><body>${mathml}</body></html>`;
}

async function copyWordMathSource(mathml: string | undefined, fallbackTex: string): Promise<WordMathCopyResult> {
  const normalizedMathml = ensureMathmlNamespace(mathml ?? "");
  if (!normalizedMathml) {
    const copiedTex = await copyPromptText(fallbackTex);
    return copiedTex ? "fallback_tex" : "failed";
  }

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const html = buildWordMathClipboardHtml(normalizedMathml);
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([normalizedMathml], { type: "text/plain" })
      });
      await navigator.clipboard.write([item]);
      return "ok";
    }
  } catch {
    // Fallback to LaTeX below.
  }

  const copiedTex = await copyPromptText(fallbackTex);
  return copiedTex ? "fallback_tex" : "failed";
}

function showPageFormulaCopyFeedback(element: HTMLElement, copiedKind: "Word" | "LaTeX"): void {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  document.getElementById("gpt-voyager-formula-copy-ring")?.remove();
  document.getElementById("gpt-voyager-formula-copy-badge")?.remove();

  const accent =
    copiedKind === "Word"
      ? {
          badgeBorder: "rgba(71, 85, 105, 0.32)",
          badgeBg: "rgba(255, 255, 255, 0.96)",
          badgeColor: "#334155",
          tag: "已复制 Word 公式"
        }
      : {
          badgeBorder: "rgba(72, 102, 255, 0.3)",
          badgeBg: "rgba(255, 255, 255, 0.96)",
          badgeColor: "#3551be",
          tag: "已复制 LaTeX"
        };

  const badge = document.createElement("div");

  const anchorLeft = window.scrollX + rect.left;
  const anchorTop = window.scrollY + rect.top;
  const anchorWidth = rect.width;
  const anchorHeight = rect.height;
  const minBadgeLeft = window.scrollX + 8;
  const maxBadgeLeft = window.scrollX + window.innerWidth - 126;
  const badgePreferredLeft = anchorLeft + anchorWidth - 118;
  const badgeLeft = Math.min(maxBadgeLeft, Math.max(minBadgeLeft, badgePreferredLeft));
  const badgeTopAbove = anchorTop - 28;
  const minBadgeTop = window.scrollY + 8;
  const badgeTop = badgeTopAbove < minBadgeTop ? anchorTop + anchorHeight + 6 : badgeTopAbove;

  badge.textContent = accent.tag;
  badge.id = "gpt-voyager-formula-copy-badge";
  badge.style.position = "absolute";
  badge.style.left = `${badgeLeft}px`;
  badge.style.top = `${badgeTop}px`;
  badge.style.borderRadius = "999px";
  badge.style.border = `1px solid ${accent.badgeBorder}`;
  badge.style.background = accent.badgeBg;
  badge.style.color = accent.badgeColor;
  badge.style.fontSize = "11px";
  badge.style.fontWeight = "600";
  badge.style.lineHeight = "1";
  badge.style.padding = "6px 10px";
  badge.style.pointerEvents = "none";
  badge.style.zIndex = "2147483647";
  badge.style.boxShadow = "0 3px 10px rgba(15, 23, 42, 0.08)";
  badge.style.opacity = "0";
  badge.style.transform = "translateY(2px)";
  badge.style.transition = "opacity 140ms ease, transform 160ms ease";

  document.body.appendChild(badge);

  window.requestAnimationFrame(() => {
    badge.style.opacity = "1";
    badge.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    badge.style.opacity = "0";
    badge.style.transform = "translateY(-1px)";
    window.setTimeout(() => {
      badge.remove();
    }, 180);
  }, 900);
}

function toPromptTemplateTransferItem(snippet: PromptSnippet): PromptTemplateTransferItem {
  return {
    title: snippet.title,
    content: snippet.content,
    tags: snippet.tags,
    variablePresets: snippet.variablePresets.map((preset) => ({
      name: preset.name,
      values: preset.values
    }))
  };
}

function normalizeTemplatePreset(input: unknown): PromptTemplateTransferPreset | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const typed = input as { name?: unknown; values?: unknown };
  const name = normalizePromptPresetName(typeof typed.name === "string" ? typed.name : "");
  const values = normalizePromptPresetValues(typed.values);
  if (!name || Object.keys(values).length === 0) {
    return null;
  }
  return { name, values };
}

function normalizePromptTemplateInput(raw: unknown): PromptTemplateTransferItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const typed = raw as {
    title?: unknown;
    content?: unknown;
    tags?: unknown;
    variablePresets?: unknown;
  };
  const title = normalizePromptTitle(typeof typed.title === "string" ? typed.title : "");
  const content = normalizePromptContent(typeof typed.content === "string" ? typed.content : "");
  if (!title || !content) {
    return null;
  }

  const tags = normalizePromptTags(typed.tags);
  const presetsRaw = Array.isArray(typed.variablePresets) ? typed.variablePresets : [];
  const variablePresets: PromptTemplateTransferPreset[] = [];
  for (const item of presetsRaw) {
    const normalized = normalizeTemplatePreset(item);
    if (!normalized) {
      continue;
    }
    variablePresets.push(normalized);
    if (variablePresets.length >= 12) {
      break;
    }
  }

  return {
    title,
    content,
    tags,
    variablePresets
  };
}

function parsePromptTemplateTransferPayload(rawText: string): PromptTemplateTransferItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return [];
  }

  const items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items.push(...parsed);
  } else if (parsed && typeof parsed === "object") {
    const typed = parsed as {
      prompt?: unknown;
      prompts?: unknown;
      schemaVersion?: unknown;
      app?: unknown;
    };
    if (Array.isArray(typed.prompts)) {
      items.push(...typed.prompts);
    } else if (typed.prompt) {
      items.push(typed.prompt);
    } else if (
      typed.schemaVersion === 1 &&
      typed.app === "gpt-voyager-prompt-template" &&
      typed.prompt
    ) {
      items.push(typed.prompt);
    } else {
      items.push(parsed);
    }
  }

  const normalized: PromptTemplateTransferItem[] = [];
  for (const item of items) {
    const next = normalizePromptTemplateInput(item);
    if (!next) {
      continue;
    }
    normalized.push(next);
    if (normalized.length >= 50) {
      break;
    }
  }
  return normalized;
}

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function buildMermaidHtmlDocument(title: string, code: string, svg: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - Mermaid 导出</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f6f7fb;
      color: #1f2735;
      line-height: 1.6;
    }
    .card {
      max-width: 980px;
      margin: 0 auto;
      border: 1px solid #e4e8f1;
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(24, 37, 62, 0.08);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 24px;
    }
    h2 {
      margin: 18px 0 8px;
      font-size: 16px;
      color: #4d5562;
    }
    pre {
      margin: 0;
      overflow-x: auto;
      border: 1px solid #e6eaf2;
      background: #f9fbff;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .svg-wrap {
      margin-top: 8px;
      border: 1px solid #e6eaf2;
      border-radius: 8px;
      background: #fcfdff;
      padding: 12px;
      overflow-x: auto;
    }
    .svg-wrap svg {
      display: block;
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <h2>源码</h2>
    <pre><code>${escapeHtml(code)}</code></pre>
    <h2>预览</h2>
    <div class="svg-wrap">${svg}</div>
  </main>
</body>
</html>`;
}

function VoyagerSelect<Value extends string>(props: {
  value: Value;
  options: Array<SelectOption<Value>>;
  onChange: (value: Value) => void;
  ariaLabel: string;
  className?: string;
}): React.ReactElement {
  const { value, options, onChange, ariaLabel, className } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    top: 0,
    left: 0,
    width: 160,
    maxHeight: 220
  });

  const selectedOption = options.find((item) => item.value === value) ?? options[0];
  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(140, Math.round(rect.width));
    const viewportPadding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(
      viewportWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, Math.round(rect.left))
    );
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, openUpward ? spaceAbove - 8 : spaceBelow - 8));
    const top = openUpward ? rect.top - maxHeight - 6 : rect.bottom + 6;

    setMenuStyle({
      top: Math.max(viewportPadding, Math.round(top)),
      left: Math.max(viewportPadding, Math.round(left)),
      width: menuWidth,
      maxHeight
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    syncMenuPosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (
        rootRef.current &&
        ((path.length > 0 && path.includes(rootRef.current)) || (target instanceof Node && rootRef.current.contains(target)))
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onViewportChange = () => {
      syncMenuPosition();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onViewportChange, true);
    document.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onViewportChange, true);
      document.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, syncMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const currentIndex = Math.max(
      0,
      options.findIndex((item) => item.value === value)
    );
    const timeoutId = window.setTimeout(() => {
      optionRefs.current[currentIndex]?.focus();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [open, options, value]);

  return (
    <div className={`gv-select-shell ${className ?? ""}`} ref={rootRef}>
      <button
        className={`gv-select-trigger ${open ? "gv-select-trigger-open" : ""}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
      >
        <span className="gv-select-trigger-value">{selectedOption?.label ?? ""}</span>
        <span className={`gv-select-trigger-arrow ${open ? "gv-select-trigger-arrow-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="gv-select-menu" style={menuStyle} role="listbox" aria-label={ariaLabel} ref={menuRef}>
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                className={`gv-select-option ${active ? "gv-select-option-active" : ""}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    setOpen(false);
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    optionRefs.current[index + 1]?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (index === 0) {
                      triggerRef.current?.focus();
                      return;
                    }
                    optionRefs.current[index - 1]?.focus();
                  }
                }}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function App(): React.ReactElement {
  const [panelReady, setPanelReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [activeView, setActiveView] = useState<ViewKey>("conversations");
  const [conversationWorkspace, setConversationWorkspace] = useState<ConversationWorkspaceKey>("home");

  const [indexReady, setIndexReady] = useState(false);
  const [classificationReady, setClassificationReady] = useState(false);
  const [promptReady, setPromptReady] = useState(false);
  const [formulaFavoriteReady, setFormulaFavoriteReady] = useState(false);
  const [mermaidFavoriteReady, setMermaidFavoriteReady] = useState(false);
  const [timelineAnnotationReady, setTimelineAnnotationReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [detectedAccountScope, setDetectedAccountScope] = useState<AccountScopeInfo>(() => detectAccountScope(document));

  const [indexLoadedScope, setIndexLoadedScope] = useState("");
  const [classificationLoadedScope, setClassificationLoadedScope] = useState("");
  const [promptLoadedScope, setPromptLoadedScope] = useState("");
  const [formulaFavoriteLoadedScope, setFormulaFavoriteLoadedScope] = useState("");
  const [mermaidFavoriteLoadedScope, setMermaidFavoriteLoadedScope] = useState("");
  const [timelineLoadedScope, setTimelineLoadedScope] = useState("");

  const [query, setQuery] = useState("");
  const [timelineQuery, setTimelineQuery] = useState("");
  const [timelineRoleFilter, setTimelineRoleFilter] = useState<"all" | TimelineRole>("all");
  const [timelineTagFilter, setTimelineTagFilter] = useState("all");
  const [timelineItems, setTimelineItems] = useState<ConversationTimelineItem[]>([]);
  const [timelineStatus, setTimelineStatus] = useState("");
  const [timelineActiveId, setTimelineActiveId] = useState("");
  const [timelineTagEditorOpenId, setTimelineTagEditorOpenId] = useState("");
  const [timelineTagDraftById, setTimelineTagDraftById] = useState<Record<string, string>>({});
  const [formulaQuery, setFormulaQuery] = useState("");
  const [formulaDisplayFilter, setFormulaDisplayFilter] = useState<"all" | FormulaDisplayMode>("all");
  const [formulaItems, setFormulaItems] = useState<ConversationFormulaItem[]>([]);
  const [formulaStatus, setFormulaStatus] = useState("");
  const [formulaActiveId, setFormulaActiveId] = useState("");
  const [formulaCopiedTex, setFormulaCopiedTex] = useState("");
  const [formulaCopiedFrom, setFormulaCopiedFrom] = useState("");
  const [formulaFavoriteQuery, setFormulaFavoriteQuery] = useState("");
  const [mermaidQuery, setMermaidQuery] = useState("");
  const [mermaidItems, setMermaidItems] = useState<ConversationMermaidItem[]>([]);
  const [mermaidStatus, setMermaidStatus] = useState("");
  const [mermaidActiveId, setMermaidActiveId] = useState("");
  const [mermaidSvgById, setMermaidSvgById] = useState<Record<string, string>>({});
  const [mermaidErrorById, setMermaidErrorById] = useState<Record<string, string>>({});
  const [mermaidFavoriteQuery, setMermaidFavoriteQuery] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [batchFolderId, setBatchFolderId] = useState("");
  const [batchTagId, setBatchTagId] = useState("");
  const [batchPanelExpanded, setBatchPanelExpanded] = useState(false);
  const [lastBatchUndo, setLastBatchUndo] = useState<BatchUndoSnapshot | null>(null);
  const [minimalExpandedConversationId, setMinimalExpandedConversationId] = useState("");
  const [conversationStatus, setConversationStatus] = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const [conversationIndex, setConversationIndex] = useState<ConversationEntry[]>([]);
  const [conversationListHeight, setConversationListHeight] = useState(0);
  const [conversationListScrollTop, setConversationListScrollTop] = useState(0);
  const [classificationState, setClassificationState] = useState<ClassificationState>(createEmptyClassificationState());

  const [promptLibrary, setPromptLibrary] = useState<PromptSnippet[]>([]);
  const [formulaFavorites, setFormulaFavorites] = useState<FormulaFavorite[]>([]);
  const [mermaidFavorites, setMermaidFavorites] = useState<MermaidFavorite[]>([]);
  const [timelineAnnotations, setTimelineAnnotations] = useState<TimelineNodeAnnotation[]>([]);
  const [promptTitleDraft, setPromptTitleDraft] = useState("");
  const [promptContentDraft, setPromptContentDraft] = useState("");
  const [promptTagsDraft, setPromptTagsDraft] = useState("");
  const [promptQuery, setPromptQuery] = useState("");
  const [promptTagFilter, setPromptTagFilter] = useState("all");
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [promptVariableOpenId, setPromptVariableOpenId] = useState("");
  const [promptVariableValues, setPromptVariableValues] = useState<Record<string, Record<string, string>>>({});
  const [promptPresetNameDraftById, setPromptPresetNameDraftById] = useState<Record<string, string>>({});
  const [editingPromptId, setEditingPromptId] = useState("");
  const [promptStatus, setPromptStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [settings, setSettings] = useState<UserSettings>(createDefaultSettings());

  const resizingRef = useRef(false);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const promptTemplateFileInputRef = useRef<HTMLInputElement>(null);
  const timelineNodeMapRef = useRef<Record<string, HTMLElement>>({});
  const timelineHighlightedElementsRef = useRef<HTMLElement[]>([]);
  const formulaNodeMapRef = useRef<Record<string, HTMLElement>>({});
  const mermaidNodeMapRef = useRef<Record<string, HTMLElement>>({});
  const derivedRefreshRafRef = useRef(0);
  const activeConversationId = getCurrentConversationId();
  const activeStorageScope = useMemo(
    () => resolveActiveStorageScope(settings, detectedAccountScope),
    [detectedAccountScope, settings]
  );
  const starredConversationMetric = useMemo(() => {
    let count = 0;
    for (const item of conversationIndex) {
      if (classificationState.metaByConversationId[item.id]?.starred) {
        count += 1;
      }
    }
    return count;
  }, [classificationState.metaByConversationId, conversationIndex]);
  const activeConversationWorkspaceLabel = useMemo(() => {
    if (conversationWorkspace === "home") {
      return "";
    }
    return CONVERSATION_WORKSPACE_LABELS[conversationWorkspace];
  }, [conversationWorkspace]);
  const conversationWorkspaceCards = useMemo<Array<{
    key: Exclude<ConversationWorkspaceKey, "home">;
    title: string;
    metric: string;
    description: string;
  }>>(
    () => [
      {
        key: "overview",
        title: "总览",
        metric: `${visibleCount} / ${conversationIndex.length}`,
        description: "查看当前可见会话、索引总量与星标入口。"
      },
      {
        key: "export",
        title: "导出中心",
        metric: "MD / HTML / PDF",
        description: "导出当前会话，支持直接下载与失败回退。"
      },
      {
        key: "starred",
        title: "星标会话",
        metric: `${starredConversationMetric} 条`,
        description: "快速查看和打开你标记过的重要会话。"
      },
      {
        key: "timeline",
        title: "会话时间线",
        metric: `${timelineItems.length} 条`,
        description: "按消息时间线定位、标注和导出节点。"
      },
      {
        key: "formula",
        title: "公式工作台",
        metric: `${formulaItems.length} 个`,
        description: "复制 LaTeX / Word 公式，收藏并回溯来源。"
      },
      {
        key: "mermaid",
        title: "Mermaid 工作台",
        metric: `${mermaidItems.length} 个`,
        description: "预览图表、复制源码并导出 SVG/HTML。"
      },
      {
        key: "classification",
        title: "分类管理",
        metric: `${classificationState.folders.length} 夹 / ${classificationState.tags.length} 标签`,
        description: "维护文件夹与标签体系，统一会话分类标准。"
      },
      {
        key: "index",
        title: "会话索引",
        metric: `${conversationIndex.length} 条`,
        description: "搜索、筛选、批量处理和虚拟滚动索引列表。"
      }
    ],
    [
      classificationState.folders.length,
      classificationState.tags.length,
      conversationIndex.length,
      formulaItems.length,
      mermaidItems.length,
      starredConversationMetric,
      timelineItems.length,
      visibleCount
    ]
  );
  const shouldObserveConversationWorkspace = panelReady && !collapsed && activeView === "conversations";

  const timelineRoleFilterOptions = useMemo<Array<SelectOption<"all" | TimelineRole>>>(
    () => [
      { value: "all", label: "全部角色" },
      { value: "user", label: "用户" },
      { value: "assistant", label: "助手" },
      { value: "tool", label: "工具" },
      { value: "unknown", label: "未知" }
    ],
    []
  );

  const formulaDisplayFilterOptions = useMemo<Array<SelectOption<"all" | FormulaDisplayMode>>>(
    () => [
      { value: "all", label: "全部类型" },
      { value: "inline", label: "行内公式" },
      { value: "display", label: "块级公式" }
    ],
    []
  );

  useEffect(() => {
    let active = true;
    loadPanelState().then((state) => {
      if (!active) {
        return;
      }
      setCollapsed(state.collapsed);
      setWidth(state.width);
      setPanelReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshScope = () => {
      setDetectedAccountScope(detectAccountScope(document));
    };
    const timer = window.setTimeout(refreshScope, 600);
    window.addEventListener("focus", refreshScope);
    document.addEventListener("visibilitychange", refreshScope);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshScope);
      document.removeEventListener("visibilitychange", refreshScope);
    };
  }, []);

  useEffect(() => {
    if (!panelReady) {
      return;
    }
    savePanelState({ collapsed, width }).catch(() => {
      // Ignore storage errors to avoid breaking UI interaction.
    });
  }, [collapsed, panelReady, width]);

  useEffect(() => {
    let active = true;
    setIndexReady(false);
    setIndexLoadedScope("");
    loadConversationIndexByScope(activeStorageScope).then((entries) => {
      if (!active) {
        return;
      }
      setConversationIndex(entries);
      setSelectedConversationIds([]);
      setIndexLoadedScope(activeStorageScope);
      setIndexReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    setClassificationReady(false);
    setClassificationLoadedScope("");
    loadClassificationStateByScope(activeStorageScope).then((state) => {
      if (!active) {
        return;
      }
      setClassificationState(state);
      setClassificationLoadedScope(activeStorageScope);
      setClassificationReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    setPromptReady(false);
    setPromptLoadedScope("");
    loadPromptLibraryByScope(activeStorageScope).then((snippets) => {
      if (!active) {
        return;
      }
      setPromptLibrary(snippets);
      setSelectedPromptIds([]);
      setPromptLoadedScope(activeStorageScope);
      setPromptReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    setFormulaFavoriteReady(false);
    setFormulaFavoriteLoadedScope("");
    loadFormulaFavoritesByScope(activeStorageScope).then((items) => {
      if (!active) {
        return;
      }
      setFormulaFavorites(items);
      setFormulaFavoriteLoadedScope(activeStorageScope);
      setFormulaFavoriteReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    setMermaidFavoriteReady(false);
    setMermaidFavoriteLoadedScope("");
    loadMermaidFavoritesByScope(activeStorageScope).then((items) => {
      if (!active) {
        return;
      }
      setMermaidFavorites(items);
      setMermaidFavoriteLoadedScope(activeStorageScope);
      setMermaidFavoriteReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    setTimelineAnnotationReady(false);
    setTimelineLoadedScope("");
    loadTimelineAnnotationsByScope(activeStorageScope).then((items) => {
      if (!active) {
        return;
      }
      setTimelineAnnotations(items);
      setTimelineLoadedScope(activeStorageScope);
      setTimelineAnnotationReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStorageScope]);

  useEffect(() => {
    let active = true;
    loadUserSettings().then((loaded) => {
      if (!active) {
        return;
      }
      setSettings(loaded);
      setSettingsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldObserveConversationWorkspace) {
      return () => {
        // 面板未展开或不在会话工作台时，不启动自动扫描，减少页面负担。
      };
    }

    if (!settings.autoScanEnabled) {
      const visibleConversations = collectVisibleConversations(document);
      setVisibleCount(visibleConversations.length);
      setConversationIndex((previous) => mergeConversationIndex(previous, visibleConversations));
      return () => {
        // No-op cleanup for disabled auto scan mode.
      };
    }

    const stopObserve = observeConversationList((visibleConversations) => {
      setVisibleCount(visibleConversations.length);
      setConversationIndex((previous) => mergeConversationIndex(previous, visibleConversations));
    }, {
      intervalMs: settings.scanIntervalSec * 1000
    });
    return () => stopObserve();
  }, [settings.autoScanEnabled, settings.scanIntervalSec, shouldObserveConversationWorkspace]);

  useEffect(() => {
    if (!indexReady || indexLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveConversationIndex(conversationIndex, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, conversationIndex, indexLoadedScope, indexReady]);

  useEffect(() => {
    if (!classificationReady || classificationLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveClassificationState(classificationState, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, classificationLoadedScope, classificationReady, classificationState]);

  useEffect(() => {
    if (!promptReady || promptLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      savePromptLibrary(promptLibrary, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, promptLibrary, promptLoadedScope, promptReady]);

  useEffect(() => {
    if (!formulaFavoriteReady || formulaFavoriteLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveFormulaFavorites(formulaFavorites, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, formulaFavoriteLoadedScope, formulaFavoriteReady, formulaFavorites]);

  useEffect(() => {
    if (!mermaidFavoriteReady || mermaidFavoriteLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveMermaidFavorites(mermaidFavorites, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, mermaidFavoriteLoadedScope, mermaidFavoriteReady, mermaidFavorites]);

  useEffect(() => {
    if (!timelineAnnotationReady || timelineLoadedScope !== activeStorageScope) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveTimelineAnnotations(timelineAnnotations, activeStorageScope).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeStorageScope, timelineAnnotationReady, timelineAnnotations, timelineLoadedScope]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveUserSettings(settings).catch(() => {
        // Ignore storage errors and keep runtime state.
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [settings, settingsReady]);

  useEffect(() => {
    if (conversationIndex.length === 0) {
      setSelectedConversationIds([]);
      return;
    }
    const validIds = new Set(conversationIndex.map((item) => item.id));
    setSelectedConversationIds((previous) => previous.filter((id) => validIds.has(id)));
  }, [conversationIndex]);

  useEffect(() => {
    if (promptLibrary.length === 0) {
      setSelectedPromptIds([]);
      return;
    }
    const validIds = new Set(promptLibrary.map((item) => item.id));
    setSelectedPromptIds((previous) => previous.filter((id) => validIds.has(id)));
  }, [promptLibrary]);

  useEffect(() => {
    if (!promptStatus) {
      return;
    }
    const timer = window.setTimeout(() => setPromptStatus(""), 1600);
    return () => window.clearTimeout(timer);
  }, [promptStatus]);

  useEffect(() => {
    if (!exportStatus) {
      return;
    }
    const timer = window.setTimeout(() => setExportStatus(""), 2000);
    return () => window.clearTimeout(timer);
  }, [exportStatus]);

  useEffect(() => {
    if (!backupStatus) {
      return;
    }
    const timer = window.setTimeout(() => setBackupStatus(""), 2600);
    return () => window.clearTimeout(timer);
  }, [backupStatus]);

  useEffect(() => {
    if (!timelineStatus) {
      return;
    }
    const timer = window.setTimeout(() => setTimelineStatus(""), 2200);
    return () => window.clearTimeout(timer);
  }, [timelineStatus]);

  useEffect(() => {
    if (!formulaStatus) {
      return;
    }
    const timer = window.setTimeout(() => setFormulaStatus(""), 2200);
    return () => window.clearTimeout(timer);
  }, [formulaStatus]);

  useEffect(() => {
    if (!mermaidStatus) {
      return;
    }
    const timer = window.setTimeout(() => setMermaidStatus(""), 2200);
    return () => window.clearTimeout(timer);
  }, [mermaidStatus]);

  useEffect(() => {
    if (!conversationStatus) {
      return;
    }
    const timer = window.setTimeout(() => setConversationStatus(""), 2200);
    return () => window.clearTimeout(timer);
  }, [conversationStatus]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!resizingRef.current) {
        return;
      }
      const nextWidth = window.innerWidth - event.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)));
    };

    const onPointerUp = () => {
      resizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const refreshVisibleConversations = useCallback(() => {
    const visibleConversations = collectVisibleConversations(document);
    setVisibleCount(visibleConversations.length);
    setConversationIndex((previous) => mergeConversationIndex(previous, visibleConversations));
  }, []);

  const refreshConversationTimeline = useCallback(() => {
    if (!activeConversationId) {
      timelineNodeMapRef.current = {};
      setTimelineItems([]);
      return;
    }

    const nodes = collectConversationTimelineNodes(document);
    const nodeMap: Record<string, HTMLElement> = {};
    const items: ConversationTimelineItem[] = [];
    for (const node of nodes) {
      nodeMap[node.item.id] = node.element;
      items.push(node.item);
    }
    timelineNodeMapRef.current = nodeMap;
    setTimelineItems(items);
  }, [activeConversationId]);

  const refreshConversationFormulas = useCallback(() => {
    if (!activeConversationId) {
      formulaNodeMapRef.current = {};
      setFormulaItems([]);
      return;
    }

    const nodes = collectConversationFormulaNodes(document);
    const nodeMap: Record<string, HTMLElement> = {};
    const items: ConversationFormulaItem[] = [];
    for (const node of nodes) {
      nodeMap[node.item.id] = node.element;
      items.push(node.item);
    }
    formulaNodeMapRef.current = nodeMap;
    setFormulaItems(items);
  }, [activeConversationId]);

  const refreshConversationMermaid = useCallback(() => {
    if (!activeConversationId) {
      mermaidNodeMapRef.current = {};
      setMermaidItems([]);
      setMermaidSvgById({});
      setMermaidErrorById({});
      return;
    }

    const nodes = collectConversationMermaidNodes(document);
    const nodeMap: Record<string, HTMLElement> = {};
    const items: ConversationMermaidItem[] = [];
    for (const node of nodes) {
      nodeMap[node.item.id] = node.element;
      items.push(node.item);
    }
    mermaidNodeMapRef.current = nodeMap;
    setMermaidItems(items);
  }, [activeConversationId]);

  const jumpToTimelineItem = useCallback((timelineId: string) => {
    const node = timelineNodeMapRef.current[timelineId];
    if (!node) {
      setTimelineStatus("未找到消息节点，已尝试重新加载");
      refreshConversationTimeline();
      return;
    }

    setTimelineActiveId(timelineId);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = node.style.outline;
    const previousOutlineOffset = node.style.outlineOffset;
    const previousTransition = node.style.transition;
    node.style.transition = "outline-color 220ms ease";
    node.style.outline = "2px solid #64748b";
    node.style.outlineOffset = "2px";
    window.setTimeout(() => {
      node.style.outline = previousOutline;
      node.style.outlineOffset = previousOutlineOffset;
      node.style.transition = previousTransition;
    }, 850);
  }, [refreshConversationTimeline]);

  const toggleTimelineHighlight = useCallback((item: ConversationTimelineItem) => {
    if (!activeConversationId) {
      setTimelineStatus("请先打开会话详情页");
      return;
    }

    const annotationKey = buildTimelineAnnotationKey(activeConversationId, item.id);
    const existing = timelineAnnotations.find((annotation) => {
      return buildTimelineAnnotationKey(annotation.conversationId, annotation.timelineItemId) === annotationKey;
    });
    const nextHighlighted = !Boolean(existing?.highlighted);
    const now = Date.now();

    setTimelineAnnotations((previous) => {
      const matched = previous.find((annotation) => {
        return buildTimelineAnnotationKey(annotation.conversationId, annotation.timelineItemId) === annotationKey;
      });

      if (!matched) {
        if (!nextHighlighted) {
          return previous;
        }
        const created: TimelineNodeAnnotation = {
          id: createTimelineAnnotationId(),
          conversationId: activeConversationId,
          timelineItemId: item.id,
          tags: [],
          highlighted: true,
          createdAt: now,
          updatedAt: now
        };
        return [created, ...previous];
      }

      if (!nextHighlighted && matched.tags.length === 0) {
        return previous.filter((annotation) => annotation.id !== matched.id);
      }

      const updated: TimelineNodeAnnotation = {
        ...matched,
        highlighted: nextHighlighted,
        updatedAt: now
      };
      return [updated, ...previous.filter((annotation) => annotation.id !== matched.id)];
    });

    setTimelineStatus(nextHighlighted ? "已标记高亮节点" : "已取消高亮标记");
  }, [activeConversationId, timelineAnnotations]);

  const toggleTimelineTagEditor = useCallback((item: ConversationTimelineItem) => {
    if (!activeConversationId) {
      setTimelineStatus("请先打开会话详情页");
      return;
    }
    const existing = timelineAnnotations.find((annotation) => {
      return annotation.conversationId === activeConversationId && annotation.timelineItemId === item.id;
    });
    setTimelineTagDraftById((previous) => ({
      ...previous,
      [item.id]: existing ? existing.tags.join(", ") : ""
    }));
    setTimelineTagEditorOpenId((previous) => (previous === item.id ? "" : item.id));
  }, [activeConversationId, timelineAnnotations]);

  const saveTimelineTags = useCallback((item: ConversationTimelineItem) => {
    if (!activeConversationId) {
      setTimelineStatus("请先打开会话详情页");
      return;
    }

    const nextTags = normalizeTimelineAnnotationTags(timelineTagDraftById[item.id] ?? "");
    const annotationKey = buildTimelineAnnotationKey(activeConversationId, item.id);
    const now = Date.now();

    setTimelineAnnotations((previous) => {
      const matched = previous.find((annotation) => {
        return buildTimelineAnnotationKey(annotation.conversationId, annotation.timelineItemId) === annotationKey;
      });

      if (!matched) {
        if (nextTags.length === 0) {
          return previous;
        }
        const created: TimelineNodeAnnotation = {
          id: createTimelineAnnotationId(),
          conversationId: activeConversationId,
          timelineItemId: item.id,
          tags: nextTags,
          highlighted: false,
          createdAt: now,
          updatedAt: now
        };
        return [created, ...previous];
      }

      if (nextTags.length === 0 && !matched.highlighted) {
        return previous.filter((annotation) => annotation.id !== matched.id);
      }

      const updated: TimelineNodeAnnotation = {
        ...matched,
        tags: nextTags,
        updatedAt: now
      };
      return [updated, ...previous.filter((annotation) => annotation.id !== matched.id)];
    });

    setTimelineStatus(nextTags.length === 0 ? "已清空节点标签" : `已保存 ${nextTags.length} 个标签`);
  }, [activeConversationId, timelineTagDraftById]);

  const removeTimelineTag = useCallback((item: ConversationTimelineItem, tag: string) => {
    if (!activeConversationId) {
      return;
    }
    const annotationKey = buildTimelineAnnotationKey(activeConversationId, item.id);
    const now = Date.now();

    setTimelineAnnotations((previous) => {
      const matched = previous.find((annotation) => {
        return buildTimelineAnnotationKey(annotation.conversationId, annotation.timelineItemId) === annotationKey;
      });
      if (!matched) {
        return previous;
      }
      const nextTags = matched.tags.filter((itemTag) => itemTag !== tag);
      if (nextTags.length === 0 && !matched.highlighted) {
        return previous.filter((annotation) => annotation.id !== matched.id);
      }
      const updated: TimelineNodeAnnotation = {
        ...matched,
        tags: nextTags,
        updatedAt: now
      };
      return [updated, ...previous.filter((annotation) => annotation.id !== matched.id)];
    });

    setTimelineStatus(`已移除标签：${tag}`);
  }, [activeConversationId]);

  const clearConversationTimelineAnnotations = useCallback(() => {
    if (!activeConversationId) {
      setTimelineStatus("请先打开会话详情页");
      return;
    }
    const removed = timelineAnnotations.filter((item) => item.conversationId === activeConversationId).length;
    setTimelineAnnotations((previous) => previous.filter((item) => item.conversationId !== activeConversationId));
    setTimelineStatus(removed > 0 ? `已清空当前会话标注（${removed} 条）` : "当前会话暂无标注");
    setTimelineTagFilter("all");
    setTimelineTagEditorOpenId("");
  }, [activeConversationId, timelineAnnotations]);

  const jumpToFormulaItem = useCallback((formulaId: string) => {
    const node = formulaNodeMapRef.current[formulaId];
    if (!node) {
      setFormulaStatus("未找到公式节点，已尝试重新加载");
      refreshConversationFormulas();
      return;
    }

    setFormulaActiveId(formulaId);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = node.style.outline;
    const previousOutlineOffset = node.style.outlineOffset;
    const previousTransition = node.style.transition;
    node.style.transition = "outline-color 220ms ease";
    node.style.outline = "2px solid #64748b";
    node.style.outlineOffset = "2px";
    window.setTimeout(() => {
      node.style.outline = previousOutline;
      node.style.outlineOffset = previousOutlineOffset;
      node.style.transition = previousTransition;
    }, 850);
  }, [refreshConversationFormulas]);

  const jumpToMermaidItem = useCallback((mermaidId: string) => {
    const node = mermaidNodeMapRef.current[mermaidId];
    if (!node) {
      setMermaidStatus("未找到图表节点，已尝试重新加载");
      refreshConversationMermaid();
      return;
    }

    setMermaidActiveId(mermaidId);
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = node.style.outline;
    const previousOutlineOffset = node.style.outlineOffset;
    const previousTransition = node.style.transition;
    node.style.transition = "outline-color 220ms ease";
    node.style.outline = "2px solid #64748b";
    node.style.outlineOffset = "2px";
    window.setTimeout(() => {
      node.style.outline = previousOutline;
      node.style.outlineOffset = previousOutlineOffset;
      node.style.transition = previousTransition;
    }, 850);
  }, [refreshConversationMermaid]);

  const notifyFormulaCopied = useCallback((tex: string, from: string) => {
    setFormulaCopiedTex(tex);
    setFormulaCopiedFrom(from);
    setFormulaStatus("已复制 LaTeX");
  }, []);

  const copyFormulaTex = useCallback(async (tex: string, from: string = "公式工作台") => {
    const ok = await copyPromptText(tex);
    if (!ok) {
      setFormulaStatus("复制失败");
      return;
    }
    notifyFormulaCopied(tex, from);
  }, [notifyFormulaCopied]);

  const copyFormulaWordSource = useCallback(async (
    mathml: string | undefined,
    tex: string,
    from: string = "公式工作台"
  ) => {
    const result = await copyWordMathSource(mathml, tex);
    if (result === "failed") {
      setFormulaStatus("复制 Word 公式失败");
      return;
    }
    if (result === "fallback_tex") {
      notifyFormulaCopied(tex, `${from} · LaTeX 回退`);
      setFormulaStatus("Word 复制失败，已回退复制 LaTeX");
      return;
    }
    notifyFormulaCopied(tex, `${from} · Word(MathML)`);
    setFormulaStatus("已复制 Word 公式（MathML），可直接粘贴到 Word");
  }, [notifyFormulaCopied]);

  const copyMermaidCode = useCallback(async (code: string) => {
    const ok = await copyPromptText(code);
    setMermaidStatus(ok ? "已复制 Mermaid 源码" : "复制 Mermaid 源码失败");
  }, []);

  const exportMermaidSource = useCallback((code: string, name: string) => {
    const fileName = `${sanitizeExportFileName(name)}.mmd`;
    downloadTextFile(fileName, `${code.trim()}\n`, "text/plain;charset=utf-8");
    setMermaidStatus(`已导出 Mermaid 源码：${fileName}`);
  }, []);

  const exportMermaidSvg = useCallback(async (
    code: string,
    name: string,
    cachedSvg?: string
  ) => {
    const svg = cachedSvg?.trim() ? cachedSvg.trim() : "";
    let content = svg;
    if (!content) {
      const rendered = await renderMermaidSvg(code);
      if (!rendered.ok) {
        setMermaidStatus("导出 SVG 失败：图表渲染失败");
        return;
      }
      content = rendered.svg;
    }

    const fileName = `${sanitizeExportFileName(name)}.svg`;
    downloadTextFile(fileName, content, "image/svg+xml;charset=utf-8");
    setMermaidStatus(`已导出 SVG：${fileName}`);
  }, []);

  const exportMermaidHtml = useCallback(async (
    code: string,
    name: string,
    cachedSvg?: string
  ) => {
    const svg = cachedSvg?.trim() ? cachedSvg.trim() : "";
    let content = svg;
    if (!content) {
      const rendered = await renderMermaidSvg(code);
      if (!rendered.ok) {
        setMermaidStatus("导出 HTML 失败：图表渲染失败");
        return;
      }
      content = rendered.svg;
    }

    const fileName = `${sanitizeExportFileName(name)}.html`;
    const html = buildMermaidHtmlDocument(name, code, content);
    downloadTextFile(fileName, html, "text/html;charset=utf-8");
    setMermaidStatus(`已导出 HTML：${fileName}`);
  }, []);

  const toggleMermaidFavorite = useCallback((item: ConversationMermaidItem) => {
    if (!activeConversationId) {
      setMermaidStatus("请先打开会话详情页再收藏图表");
      return;
    }

    const favoriteKey = buildMermaidFavoriteKey(activeConversationId, item.code);
    const existing = mermaidFavorites.find((favorite) => {
      return buildMermaidFavoriteKey(favorite.sourceConversationId, favorite.code) === favoriteKey;
    });
    if (existing) {
      setMermaidFavorites((previous) => previous.filter((favorite) => favorite.id !== existing.id));
      setMermaidStatus("已取消收藏图表");
      return;
    }

    const now = Date.now();
    const nextFavorite: MermaidFavorite = {
      id: createMermaidFavoriteId(),
      alias: createMermaidAlias(item.code),
      code: item.code,
      preview: item.preview,
      sourceConversationId: activeConversationId,
      sourceConversationTitle: getConversationTitleForExport(),
      sourceMessageIndex: item.messageIndex,
      createdAt: now,
      updatedAt: now
    };
    setMermaidFavorites((previous) => [nextFavorite, ...previous]);
    setMermaidStatus("已收藏图表");
  }, [activeConversationId, mermaidFavorites]);

  const updateMermaidFavoriteAlias = useCallback((favoriteId: string, alias: string) => {
    const normalizedAlias = alias.replace(/\s+/g, " ").trim().slice(0, 60);
    setMermaidFavorites((previous) =>
      previous.map((item) => {
        if (item.id !== favoriteId) {
          return item;
        }
        return {
          ...item,
          alias: normalizedAlias || createMermaidAlias(item.code),
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  const removeMermaidFavorite = useCallback((favoriteId: string) => {
    setMermaidFavorites((previous) => previous.filter((item) => item.id !== favoriteId));
    setMermaidStatus("已删除图表收藏");
  }, []);

  const locateMermaidFavorite = useCallback((favorite: MermaidFavorite) => {
    if (favorite.sourceConversationId !== activeConversationId) {
      const target = conversationIndex.find((item) => item.id === favorite.sourceConversationId);
      if (target) {
        openConversation(target.url);
      } else {
        openConversation(`${window.location.origin}/c/${favorite.sourceConversationId}`);
      }
      return;
    }

    const normalizedCode = normalizeMermaidCodeForMatch(favorite.code);
    const matched = mermaidItems.find((item) => {
      return normalizeMermaidCodeForMatch(item.code) === normalizedCode;
    });
    if (!matched) {
      setMermaidStatus("当前会话未找到该图表，已尝试刷新");
      refreshConversationMermaid();
      return;
    }
    jumpToMermaidItem(matched.id);
  }, [activeConversationId, conversationIndex, jumpToMermaidItem, mermaidItems, refreshConversationMermaid]);

  const toggleFormulaFavorite = useCallback((item: ConversationFormulaItem) => {
    if (!activeConversationId) {
      setFormulaStatus("请先打开会话详情页再收藏公式");
      return;
    }
    const favoriteKey = buildFormulaFavoriteKey(activeConversationId, item.displayMode, item.tex);
    const existing = formulaFavorites.find((fav) => {
      return buildFormulaFavoriteKey(fav.sourceConversationId, fav.displayMode, fav.tex) === favoriteKey;
    });
    if (existing) {
      setFormulaFavorites((previous) => previous.filter((fav) => fav.id !== existing.id));
      setFormulaStatus("已取消收藏公式");
      return;
    }
    const now = Date.now();
    const nextFavorite: FormulaFavorite = {
      id: createFormulaFavoriteId(),
      tex: item.tex,
      mathml: item.mathml,
      alias: createFormulaAlias(item.tex),
      source: item.source,
      displayMode: item.displayMode,
      sourceConversationId: activeConversationId,
      sourceConversationTitle: getConversationTitleForExport(),
      createdAt: now,
      updatedAt: now
    };
    setFormulaFavorites((previous) => [nextFavorite, ...previous]);
    setFormulaStatus("已收藏公式");
  }, [activeConversationId, formulaFavorites]);

  const updateFormulaFavoriteAlias = useCallback((favoriteId: string, alias: string) => {
    const normalizedAlias = alias.replace(/\s+/g, " ").trim().slice(0, 60);
    setFormulaFavorites((previous) =>
      previous.map((item) => {
        if (item.id !== favoriteId) {
          return item;
        }
        return {
          ...item,
          alias: normalizedAlias || createFormulaAlias(item.tex),
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  const removeFormulaFavorite = useCallback((favoriteId: string) => {
    setFormulaFavorites((previous) => previous.filter((item) => item.id !== favoriteId));
    setFormulaStatus("已删除收藏公式");
  }, []);

  const locateFormulaFavorite = useCallback((favorite: FormulaFavorite) => {
    if (favorite.sourceConversationId !== activeConversationId) {
      const target = conversationIndex.find((item) => item.id === favorite.sourceConversationId);
      if (target) {
        openConversation(target.url);
      } else {
        openConversation(`${window.location.origin}/c/${favorite.sourceConversationId}`);
      }
      return;
    }

    const normalizedTex = normalizeFormulaTexForMatch(favorite.tex);
    const matched = formulaItems.find((item) => {
      return item.displayMode === favorite.displayMode && normalizeFormulaTexForMatch(item.tex) === normalizedTex;
    });
    if (!matched) {
      setFormulaStatus("当前会话未找到该公式，已尝试刷新");
      refreshConversationFormulas();
      return;
    }
    jumpToFormulaItem(matched.id);
  }, [activeConversationId, conversationIndex, formulaItems, jumpToFormulaItem, refreshConversationFormulas]);

  const refreshConversationDerivedData = useCallback(() => {
    if (derivedRefreshRafRef.current !== 0) {
      return;
    }
    derivedRefreshRafRef.current = window.requestAnimationFrame(() => {
      derivedRefreshRafRef.current = 0;
      refreshConversationTimeline();
      refreshConversationFormulas();
      refreshConversationMermaid();
    });
  }, [refreshConversationFormulas, refreshConversationMermaid, refreshConversationTimeline]);

  useEffect(() => {
    return () => {
      if (derivedRefreshRafRef.current !== 0) {
        window.cancelAnimationFrame(derivedRefreshRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setTimelineActiveId("");
    setTimelineQuery("");
    setTimelineRoleFilter("all");
    setTimelineTagFilter("all");
    setTimelineTagEditorOpenId("");
    setTimelineTagDraftById({});
    setFormulaActiveId("");
    setFormulaQuery("");
    setFormulaDisplayFilter("all");
    setMermaidActiveId("");
    setMermaidQuery("");
    setMermaidSvgById({});
    setMermaidErrorById({});
    if (!shouldObserveConversationWorkspace) {
      return;
    }
    refreshConversationDerivedData();
  }, [activeConversationId, refreshConversationDerivedData, shouldObserveConversationWorkspace]);

  useEffect(() => {
    if (!activeConversationId || !shouldObserveConversationWorkspace) {
      return;
    }
    const stopObserve = observeConversationThread(refreshConversationDerivedData, { intervalMs: 1400 });
    return () => stopObserve();
  }, [activeConversationId, refreshConversationDerivedData, shouldObserveConversationWorkspace]);

  useEffect(() => {
    if (document.getElementById(TIMELINE_HIGHLIGHT_STYLE_ID)) {
      return;
    }
    if (!document.head) {
      return;
    }

    const style = document.createElement("style");
    style.id = TIMELINE_HIGHLIGHT_STYLE_ID;
    style.textContent = `
      [${TIMELINE_HIGHLIGHT_ATTR}="true"] {
        outline: 2px solid rgba(71, 85, 105, 0.55) !important;
        outline-offset: 2px !important;
        box-shadow: inset 0 0 0 1px rgba(71, 85, 105, 0.16) !important;
        border-radius: 10px !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    for (const element of timelineHighlightedElementsRef.current) {
      element.removeAttribute(TIMELINE_HIGHLIGHT_ATTR);
    }

    if (!activeConversationId) {
      timelineHighlightedElementsRef.current = [];
      return;
    }

    const nextHighlightedElements: HTMLElement[] = [];
    for (const item of timelineItems) {
      const annotation = timelineAnnotations.find((annotationItem) => {
        return annotationItem.conversationId === activeConversationId && annotationItem.timelineItemId === item.id;
      });
      if (!annotation?.highlighted) {
        continue;
      }
      const element = timelineNodeMapRef.current[item.id];
      if (!element) {
        continue;
      }
      element.setAttribute(TIMELINE_HIGHLIGHT_ATTR, "true");
      nextHighlightedElements.push(element);
    }
    timelineHighlightedElementsRef.current = nextHighlightedElements;
  }, [activeConversationId, timelineAnnotations, timelineItems]);

  useEffect(() => {
    return () => {
      for (const element of timelineHighlightedElementsRef.current) {
        element.removeAttribute(TIMELINE_HIGHLIGHT_ATTR);
      }
      timelineHighlightedElementsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (mermaidItems.length === 0) {
      setMermaidSvgById({});
      setMermaidErrorById({});
      return;
    }

    let cancelled = false;
    const run = async () => {
      const nextSvgById: Record<string, string> = {};
      const nextErrorById: Record<string, string> = {};
      await Promise.all(
        mermaidItems.map(async (item) => {
          const rendered = await renderMermaidSvg(item.code);
          if (cancelled) {
            return;
          }
          if (rendered.ok) {
            nextSvgById[item.id] = rendered.svg;
            return;
          }
          nextErrorById[item.id] = rendered.reason;
        })
      );
      if (cancelled) {
        return;
      }
      setMermaidSvgById(nextSvgById);
      setMermaidErrorById(nextErrorById);
    };

    run().catch(() => {
      if (!cancelled) {
        setMermaidStatus("图表渲染失败");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mermaidItems]);

  const createFolder = useCallback(() => {
    const name = normalizeName(folderDraft);
    if (!name || isDuplicateName(classificationState.folders, name)) {
      return;
    }
    const nextFolder = {
      id: createEntityId("folder"),
      name,
      createdAt: Date.now()
    };
    setClassificationState((previous) => ({
      ...previous,
      folders: [...previous.folders, nextFolder]
    }));
    setFolderDraft("");
  }, [classificationState.folders, folderDraft]);

  const createTag = useCallback(() => {
    const name = normalizeName(tagDraft);
    if (!name || isDuplicateName(classificationState.tags, name)) {
      return;
    }
    const nextTag = {
      id: createEntityId("tag"),
      name,
      createdAt: Date.now()
    };
    setClassificationState((previous) => ({
      ...previous,
      tags: [...previous.tags, nextTag]
    }));
    setTagDraft("");
  }, [classificationState.tags, tagDraft]);

  const removeFolder = useCallback(
    (folderId: string) => {
      setClassificationState((previous) => {
        const nextMetaByConversationId: Record<string, ConversationClassificationMeta> = {};

        for (const [conversationId, meta] of Object.entries(previous.metaByConversationId)) {
          const nextMeta: ConversationClassificationMeta = {
            folderId: meta.folderId === folderId ? undefined : meta.folderId,
            tagIds: [...meta.tagIds],
            starred: meta.starred,
            note: meta.note
          };

          if (nextMeta.folderId || nextMeta.tagIds.length > 0 || nextMeta.starred || nextMeta.note) {
            nextMetaByConversationId[conversationId] = nextMeta;
          }
        }

        return {
          ...previous,
          folders: previous.folders.filter((item) => item.id !== folderId),
          metaByConversationId: nextMetaByConversationId
        };
      });

      if (folderFilter === folderId) {
        setFolderFilter("all");
      }
    },
    [folderFilter]
  );

  const removeTag = useCallback(
    (tagId: string) => {
      setClassificationState((previous) => {
        const nextMetaByConversationId: Record<string, ConversationClassificationMeta> = {};

        for (const [conversationId, meta] of Object.entries(previous.metaByConversationId)) {
          const nextMeta: ConversationClassificationMeta = {
            folderId: meta.folderId,
            tagIds: meta.tagIds.filter((item) => item !== tagId),
            starred: meta.starred,
            note: meta.note
          };

          if (nextMeta.folderId || nextMeta.tagIds.length > 0 || nextMeta.starred || nextMeta.note) {
            nextMetaByConversationId[conversationId] = nextMeta;
          }
        }

        return {
          ...previous,
          tags: previous.tags.filter((item) => item.id !== tagId),
          metaByConversationId: nextMetaByConversationId
        };
      });

      if (tagFilter === tagId) {
        setTagFilter("all");
      }
    },
    [tagFilter]
  );

  const setConversationFolder = useCallback((conversationId: string, folderId: string) => {
    setClassificationState((previous) => {
      const current = getMetaOrEmpty(previous, conversationId);
      const nextMeta: ConversationClassificationMeta = {
        folderId: folderId || undefined,
        tagIds: [...current.tagIds],
        starred: current.starred,
        note: current.note
      };
      return {
        ...previous,
        metaByConversationId: upsertConversationMeta(previous.metaByConversationId, conversationId, nextMeta)
      };
    });
  }, []);

  const toggleConversationTag = useCallback((conversationId: string, tagId: string) => {
    setClassificationState((previous) => {
      const current = getMetaOrEmpty(previous, conversationId);
      const hasTag = current.tagIds.includes(tagId);
      const nextTagIds = hasTag ? current.tagIds.filter((item) => item !== tagId) : [...current.tagIds, tagId];
      const nextMeta: ConversationClassificationMeta = {
        folderId: current.folderId,
        tagIds: nextTagIds,
        starred: current.starred,
        note: current.note
      };
      return {
        ...previous,
        metaByConversationId: upsertConversationMeta(previous.metaByConversationId, conversationId, nextMeta)
      };
    });
  }, []);

  const toggleConversationStar = useCallback((conversationId: string) => {
    setClassificationState((previous) => {
      const current = getMetaOrEmpty(previous, conversationId);
      const nextMeta: ConversationClassificationMeta = {
        folderId: current.folderId,
        tagIds: [...current.tagIds],
        starred: !current.starred,
        note: current.note
      };
      return {
        ...previous,
        metaByConversationId: upsertConversationMeta(previous.metaByConversationId, conversationId, nextMeta)
      };
    });
  }, []);

  const setConversationNote = useCallback((conversationId: string, note: string) => {
    const normalized = note.replace(/\s+/g, " ").trim().slice(0, 240);
    setClassificationState((previous) => {
      const current = getMetaOrEmpty(previous, conversationId);
      const nextMeta: ConversationClassificationMeta = {
        folderId: current.folderId,
        tagIds: [...current.tagIds],
        starred: current.starred,
        note: normalized || undefined
      };
      return {
        ...previous,
        metaByConversationId: upsertConversationMeta(previous.metaByConversationId, conversationId, nextMeta)
      };
    });
  }, []);

  const openConversationFolder = useCallback((folderId?: string) => {
    setStarredOnly(false);
    setTagFilter("all");
    setShowAdvancedFilters(false);
    setQuery("");
    if (!folderId) {
      setFolderFilter("uncategorized");
      setConversationStatus("已打开未分类会话");
      return;
    }
    setFolderFilter(folderId);
    setConversationStatus("已打开对应文件夹会话");
  }, []);

  const savePrompt = useCallback(() => {
    const title = normalizePromptTitle(promptTitleDraft);
    const content = normalizePromptContent(promptContentDraft);
    const tags = normalizePromptTags(promptTagsDraft);
    if (!title || !content) {
      return;
    }

    const now = Date.now();
    if (editingPromptId) {
      setPromptLibrary((previous) => {
        const updated = previous.map((item) => {
          if (item.id !== editingPromptId) {
            return item;
          }
          return {
            ...item,
            title,
            content,
            tags,
            updatedAt: now
          };
        });
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setPromptStatus("已更新");
    } else {
      const snippet: PromptSnippet = {
        id: createPromptId(),
        title,
        content,
        tags,
        variablePresets: [],
        createdAt: now,
        updatedAt: now
      };
      setPromptLibrary((previous) => [snippet, ...previous]);
      setPromptStatus("已添加");
    }

    setPromptTitleDraft("");
    setPromptContentDraft("");
    setPromptTagsDraft("");
    setEditingPromptId("");
    setPromptVariableOpenId("");
  }, [editingPromptId, promptContentDraft, promptTagsDraft, promptTitleDraft]);

  const editPrompt = useCallback((snippet: PromptSnippet) => {
    setEditingPromptId(snippet.id);
    setPromptTitleDraft(snippet.title);
    setPromptContentDraft(snippet.content);
    setPromptTagsDraft(snippet.tags.join(", "));
  }, []);

  const deletePrompt = useCallback((snippetId: string) => {
    setPromptLibrary((previous) => previous.filter((item) => item.id !== snippetId));
    if (editingPromptId === snippetId) {
      setEditingPromptId("");
      setPromptTitleDraft("");
      setPromptContentDraft("");
      setPromptTagsDraft("");
    }
    setPromptVariableValues((previous) => {
      const { [snippetId]: _removed, ...rest } = previous;
      return rest;
    });
    setPromptPresetNameDraftById((previous) => {
      const { [snippetId]: _removed, ...rest } = previous;
      return rest;
    });
    if (promptVariableOpenId === snippetId) {
      setPromptVariableOpenId("");
    }
    setPromptStatus("已删除");
  }, [editingPromptId, promptVariableOpenId]);

  const copyPrompt = useCallback(async (content: string) => {
    const ok = await copyPromptText(content);
    setPromptStatus(ok ? "已复制" : "复制失败");
  }, []);

  const insertPrompt = useCallback((content: string) => {
    const ok = insertPromptToComposer(content, settings.promptInsertMode);
    setPromptStatus(ok ? "已插入输入框" : "未找到输入框");
  }, [settings.promptInsertMode]);

  const setPromptVariableValue = useCallback((promptId: string, variable: string, value: string) => {
    setPromptVariableValues((previous) => ({
      ...previous,
      [promptId]: {
        ...(previous[promptId] ?? {}),
        [variable]: value
      }
    }));
  }, []);

  const savePromptVariablePreset = useCallback((snippet: PromptSnippet) => {
    const presetNameDraft = promptPresetNameDraftById[snippet.id] ?? "";
    const normalizedName = normalizePromptPresetName(presetNameDraft);
    const values = normalizePromptPresetValues(promptVariableValues[snippet.id] ?? {});
    const valueCount = Object.keys(values).length;
    if (valueCount === 0) {
      setPromptStatus("请先填写至少一个变量值");
      setPromptVariableOpenId(snippet.id);
      return;
    }

    const now = Date.now();
    const name = normalizedName || `预设 ${new Date(now).toLocaleTimeString("zh-CN", { hour12: false })}`;
    setPromptLibrary((previous) =>
      previous.map((item) => {
        if (item.id !== snippet.id) {
          return item;
        }

        const existed = item.variablePresets.find((preset) => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
        const nextPreset: PromptVariablePreset = existed
          ? {
              ...existed,
              name,
              values,
              updatedAt: now
            }
          : {
              id: createPromptPresetId(),
              name,
              values,
              createdAt: now,
              updatedAt: now
            };

        const merged = sanitizePromptVariablePresets([
          nextPreset,
          ...item.variablePresets.filter((preset) => preset.id !== existed?.id)
        ]);
        return {
          ...item,
          variablePresets: merged,
          updatedAt: now
        };
      })
    );
    setPromptPresetNameDraftById((previous) => ({
      ...previous,
      [snippet.id]: ""
    }));
    setPromptStatus(`已保存变量预设：${name}`);
  }, [promptPresetNameDraftById, promptVariableValues]);

  const applyPromptVariablePreset = useCallback((snippetId: string, presetId: string) => {
    const snippet = promptLibrary.find((item) => item.id === snippetId);
    if (!snippet) {
      return;
    }
    const preset = snippet.variablePresets.find((item) => item.id === presetId);
    if (!preset) {
      setPromptStatus("未找到变量预设");
      return;
    }
    setPromptVariableValues((previous) => ({
      ...previous,
      [snippetId]: {
        ...preset.values
      }
    }));
    setPromptVariableOpenId(snippetId);
    setPromptStatus(`已应用预设：${preset.name}`);
  }, [promptLibrary]);

  const removePromptVariablePreset = useCallback((snippetId: string, presetId: string) => {
    let removedName = "";
    setPromptLibrary((previous) =>
      previous.map((item) => {
        if (item.id !== snippetId) {
          return item;
        }
        const toRemove = item.variablePresets.find((preset) => preset.id === presetId);
        removedName = toRemove?.name ?? "";
        if (!toRemove) {
          return item;
        }
        return {
          ...item,
          variablePresets: item.variablePresets.filter((preset) => preset.id !== presetId),
          updatedAt: Date.now()
        };
      })
    );
    setPromptStatus(removedName ? `已删除预设：${removedName}` : "未找到要删除的预设");
  }, []);

  const insertPromptWithVariables = useCallback((snippet: PromptSnippet) => {
    const variables = extractPromptVariables(snippet.content);
    if (variables.length === 0) {
      insertPrompt(snippet.content);
      return;
    }

    const values = promptVariableValues[snippet.id] ?? {};
    const unresolved = variables.filter((name) => !(values[name] ?? "").trim());
    if (unresolved.length > 0) {
      setPromptStatus(`仍有 ${unresolved.length} 个变量未填写`);
      setPromptVariableOpenId(snippet.id);
      return;
    }
    const filled = fillPromptVariables(snippet.content, values);
    insertPrompt(filled);
  }, [insertPrompt, promptVariableValues]);

  const togglePromptSelection = useCallback((promptId: string) => {
    setSelectedPromptIds((previous) => {
      if (previous.includes(promptId)) {
        return previous.filter((id) => id !== promptId);
      }
      return [...previous, promptId];
    });
  }, []);

  const selectAllFilteredPrompts = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setPromptStatus("当前筛选结果为空");
      return;
    }
    setSelectedPromptIds(ids);
    setPromptStatus(`已选择 ${ids.length} 条模板`);
  }, []);

  const clearPromptSelection = useCallback(() => {
    setSelectedPromptIds([]);
    setPromptStatus("已清空模板选择");
  }, []);

  const exportPromptTemplate = useCallback((snippet: PromptSnippet) => {
    const payload: PromptTemplateTransferPayload = {
      schemaVersion: 1,
      app: "gpt-voyager-prompt-template",
      exportedAt: Date.now(),
      prompt: toPromptTemplateTransferItem(snippet)
    };
    const fileName = `prompt-template-${sanitizeExportFileName(snippet.title)}.json`;
    const content = JSON.stringify(payload, null, 2);
    downloadTextFile(fileName, content, "application/json;charset=utf-8");
    setPromptStatus("已导出共享模板");
  }, []);

  const exportSelectedPromptTemplates = useCallback(() => {
    if (selectedPromptIds.length === 0) {
      setPromptStatus("请先勾选要导出的模板");
      return;
    }

    const selectedSnippets = promptLibrary.filter((snippet) => selectedPromptIds.includes(snippet.id));
    if (selectedSnippets.length === 0) {
      setPromptStatus("未找到可导出的模板");
      return;
    }

    const payload: PromptTemplateBatchTransferPayload = {
      schemaVersion: 1,
      app: "gpt-voyager-prompt-template-batch",
      exportedAt: Date.now(),
      prompts: selectedSnippets.map((snippet) => toPromptTemplateTransferItem(snippet))
    };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    const fileName = `prompt-templates-batch-${stamp}.json`;
    downloadTextFile(fileName, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setPromptStatus(`已批量导出 ${selectedSnippets.length} 条模板`);
  }, [promptLibrary, selectedPromptIds]);

  const openPromptTemplateImportPicker = useCallback(() => {
    promptTemplateFileInputRef.current?.click();
  }, []);

  const importPromptTemplates = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const templateItems = parsePromptTemplateTransferPayload(content);
      if (templateItems.length === 0) {
        setPromptStatus("导入失败：未识别到有效模板");
        return;
      }

      const now = Date.now();
      const snippets = templateItems.map((templateItem, index): PromptSnippet => {
        const baseTimestamp = now + index;
        const presets = sanitizePromptVariablePresets(
          templateItem.variablePresets.map((preset, presetIndex) => ({
            id: createPromptPresetId(),
            name: preset.name,
            values: preset.values,
            createdAt: baseTimestamp + presetIndex,
            updatedAt: baseTimestamp + presetIndex
          }))
        );
        return {
          id: createPromptId(),
          title: templateItem.title,
          content: templateItem.content,
          tags: templateItem.tags,
          variablePresets: presets,
          createdAt: baseTimestamp,
          updatedAt: baseTimestamp
        };
      });

      let importedCount = 0;
      let duplicateCount = 0;
      setPromptLibrary((previous) => {
        const existingKeys = new Set(
          previous.map((item) => `${item.title.toLocaleLowerCase()}::${item.content.toLocaleLowerCase()}`)
        );
        const accepted: PromptSnippet[] = [];
        for (const snippet of snippets) {
          const dedupeKey = `${snippet.title.toLocaleLowerCase()}::${snippet.content.toLocaleLowerCase()}`;
          if (existingKeys.has(dedupeKey)) {
            duplicateCount += 1;
            continue;
          }
          existingKeys.add(dedupeKey);
          accepted.push(snippet);
        }
        importedCount = accepted.length;
        return [...accepted, ...previous].sort((a, b) => b.updatedAt - a.updatedAt);
      });

      if (importedCount === 0) {
        setPromptStatus(duplicateCount > 0 ? "模板已存在，未新增" : "导入失败：未识别到可用模板");
        return;
      }
      setPromptStatus(duplicateCount > 0 ? `已导入 ${importedCount} 条，跳过 ${duplicateCount} 条重复` : `已导入 ${importedCount} 条模板`);
    } catch {
      setPromptStatus("导入失败：读取模板文件出错");
    }
  }, []);

  const exportConversationMarkdown = useCallback(() => {
    const result = exportCurrentConversationToMarkdown();
    if (!result.ok) {
      setExportStatus(result.reason);
      return;
    }
    setExportStatus(`Markdown 已导出（${result.messageCount} 条）`);
  }, []);

  const exportConversationHtml = useCallback(() => {
    const result = exportCurrentConversationToHtml();
    if (!result.ok) {
      setExportStatus(result.reason);
      return;
    }
    setExportStatus(`HTML 已导出（${result.messageCount} 条）`);
  }, []);

  const exportConversationPdf = useCallback(async () => {
    setExportStatus("PDF 导出中，请稍候...");
    const result = await exportCurrentConversationToPdf();
    if (!result.ok) {
      setExportStatus(result.reason);
      return;
    }
    if (result.mode === "print_fallback") {
      setExportStatus(result.warning ?? "直接下载失败，已打开打印页，请在打印窗口选择“另存为 PDF”");
      return;
    }
    setExportStatus(`PDF 已导出（${result.messageCount} 条，含图片）`);
  }, []);

  const exportConversationDefault = useCallback(() => {
    if (settings.defaultExportFormat === "html") {
      exportConversationHtml();
      return;
    }
    exportConversationMarkdown();
  }, [exportConversationHtml, exportConversationMarkdown, settings.defaultExportFormat]);

  const exportJsonBackup = useCallback(() => {
    const payload = createBackupPayload({
      conversationIndex,
      classificationState,
      promptLibrary,
      formulaFavorites,
      mermaidFavorites,
      timelineAnnotations,
      settings
    });
    const content = JSON.stringify(payload, null, 2);
    downloadTextFile(createBackupFileName(), content, "application/json;charset=utf-8");
    setBackupStatus(
      `备份已导出（会话 ${payload.data.conversationIndex.length}，提示词 ${payload.data.promptLibrary.length}，公式收藏 ${payload.data.formulaFavorites.length}，图表收藏 ${payload.data.mermaidFavorites.length}，时间线标注 ${payload.data.timelineAnnotations.length}）`
    );
  }, [classificationState, conversationIndex, formulaFavorites, mermaidFavorites, promptLibrary, settings, timelineAnnotations]);

  const openImportBackupPicker = useCallback(() => {
    backupFileInputRef.current?.click();
  }, []);

  const importJsonBackup = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!(indexReady && classificationReady && promptReady && formulaFavoriteReady && mermaidFavoriteReady && timelineAnnotationReady && settingsReady)) {
      setBackupStatus("数据尚未初始化完成，请稍后再导入");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseBackupPayload(text);
      if (!parsed.ok) {
        setBackupStatus(parsed.reason);
        return;
      }

      const nextConversationIndex = parsed.payload.data.conversationIndex;
      const nextClassificationState = parsed.payload.data.classificationState;
      const nextPromptLibrary = parsed.payload.data.promptLibrary;
      const nextFormulaFavorites = parsed.payload.data.formulaFavorites;
      const nextMermaidFavorites = parsed.payload.data.mermaidFavorites;
      const nextTimelineAnnotations = parsed.payload.data.timelineAnnotations;
      const nextSettings = parsed.payload.data.settings;

      setConversationIndex(nextConversationIndex);
      setClassificationState(nextClassificationState);
      setPromptLibrary(nextPromptLibrary);
      setFormulaFavorites(nextFormulaFavorites);
      setMermaidFavorites(nextMermaidFavorites);
      setTimelineAnnotations(nextTimelineAnnotations);
      setSettings(nextSettings);
      setFolderFilter("all");
      setTagFilter("all");
      setPromptTagFilter("all");
      setTimelineTagFilter("all");
      setPromptQuery("");
      setSelectedPromptIds([]);
      setTimelineQuery("");
      setTimelineRoleFilter("all");
      setTimelineTagEditorOpenId("");
      setTimelineTagDraftById({});
      setFormulaFavoriteQuery("");
      setMermaidFavoriteQuery("");
      setSelectedConversationIds([]);
      setBatchFolderId("");
      setBatchTagId("");
      setShowAdvancedFilters(false);
      setBatchPanelExpanded(false);
      setLastBatchUndo(null);

      await Promise.all([
        saveConversationIndex(nextConversationIndex, activeStorageScope),
        saveClassificationState(nextClassificationState, activeStorageScope),
        savePromptLibrary(nextPromptLibrary, activeStorageScope),
        saveFormulaFavorites(nextFormulaFavorites, activeStorageScope),
        saveMermaidFavorites(nextMermaidFavorites, activeStorageScope),
        saveTimelineAnnotations(nextTimelineAnnotations, activeStorageScope),
        saveUserSettings(nextSettings)
      ]);

      setBackupStatus(
        `备份已导入（会话 ${nextConversationIndex.length}，提示词 ${nextPromptLibrary.length}，公式收藏 ${nextFormulaFavorites.length}，图表收藏 ${nextMermaidFavorites.length}，时间线标注 ${nextTimelineAnnotations.length}）`
      );
    } catch {
      setBackupStatus("导入失败：读取文件时发生错误");
    }
  }, [activeStorageScope, classificationReady, formulaFavoriteReady, indexReady, mermaidFavoriteReady, promptReady, settingsReady, timelineAnnotationReady]);

  useEffect(() => {
    if (!settings.formulaClickCopyEnabled) {
      return;
    }

    const onDocumentClick = async (event: MouseEvent) => {
      const host = document.getElementById(EXTENSION_HOST_ID);
      if (host && event.target instanceof Node && host.contains(event.target)) {
        return;
      }

      const extracted = extractFormulaFromTarget(event.target);
      if (!extracted) {
        return;
      }

      const result = await copyWordMathSource(extracted.mathml, extracted.tex);
      if (result === "failed") {
        setFormulaStatus("页面点击复制失败");
        return;
      }

      if (result === "fallback_tex") {
        notifyFormulaCopied(extracted.tex, `页面点击 · ${formulaDisplayLabel(extracted.displayMode)} · LaTeX 回退`);
        setFormulaStatus("已复制 LaTeX（Word 失败回退）");
        showPageFormulaCopyFeedback(extracted.element, "LaTeX");
        return;
      }

      notifyFormulaCopied(extracted.tex, `页面点击 · ${formulaDisplayLabel(extracted.displayMode)} · Word(MathML)`);
      setFormulaStatus("已复制 Word 公式（MathML）");
      showPageFormulaCopyFeedback(extracted.element, "Word");
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [notifyFormulaCopied, settings.formulaClickCopyEnabled]);

  useEffect(() => {
    const removeBadge = () => {
      document.getElementById(QUOTE_REPLY_BADGE_ID)?.remove();
    };

    if (!settings.quoteReplyEnabled) {
      removeBadge();
      return;
    }

    const showQuoteReplyBadge = (rawText: string, rect: DOMRect) => {
      removeBadge();
      if (rect.width <= 0 && rect.height <= 0) {
        return;
      }

      const quoteText = toQuotedReplyText(rawText);
      if (!quoteText) {
        return;
      }

      const badge = document.createElement("button");
      badge.id = QUOTE_REPLY_BADGE_ID;
      badge.type = "button";
      badge.textContent = "引用回复";
      const docLeft = window.scrollX + rect.left;
      const docTop = window.scrollY + rect.top;
      const minLeft = window.scrollX + 8;
      const maxLeft = window.scrollX + window.innerWidth - 92;
      const preferredLeft = docLeft + rect.width - 84;
      const left = Math.min(maxLeft, Math.max(minLeft, preferredLeft));
      const topAbove = docTop - 32;
      const minTop = window.scrollY + 8;
      const top = topAbove < minTop ? docTop + rect.height + 8 : topAbove;

      badge.style.position = "absolute";
      badge.style.left = `${left}px`;
      badge.style.top = `${top}px`;
      badge.style.zIndex = "2147483647";
      badge.style.border = "1px solid #d5dbe3";
      badge.style.borderRadius = "999px";
      badge.style.background = "rgba(255,255,255,0.98)";
      badge.style.color = "#334155";
      badge.style.padding = "6px 10px";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "600";
      badge.style.cursor = "pointer";
      badge.style.boxShadow = "0 4px 14px rgba(15, 23, 42, 0.12)";
      badge.style.transition = "opacity 140ms ease";

      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const ok = insertPromptToComposer(quoteText, "append");
        if (ok) {
          setPromptStatus("已插入引用内容");
        } else {
          setPromptStatus("插入失败：未找到输入框");
        }
        removeBadge();
      });

      document.body.appendChild(badge);
    };

    const updateBadgeBySelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        removeBadge();
        return;
      }
      const range = selection.getRangeAt(0);
      const anchorNode = selection.anchorNode;
      if (isNodeInsideVoyagerHost(anchorNode)) {
        removeBadge();
        return;
      }
      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 2) {
        removeBadge();
        return;
      }
      showQuoteReplyBadge(selectedText.slice(0, 1200), range.getBoundingClientRect());
    };

    const onMouseUp = () => {
      window.setTimeout(updateBadgeBySelection, 24);
    };
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        removeBadge();
      }
    };
    const onScroll = () => removeBadge();

    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("selectionchange", onSelectionChange, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      removeBadge();
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("selectionchange", onSelectionChange, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [settings.quoteReplyEnabled]);

  useEffect(() => {
    const widthPercent = clampChatContentWidthPercent(settings.chatContentWidthPercent);
    const widthVw = `${widthPercent}vw`;
    const composerWidth = `${Math.min(98, widthPercent + 2)}vw`;

    const rootStyle = document.documentElement?.style;
    rootStyle?.setProperty("--thread-content-max-width", widthVw);
    rootStyle?.setProperty("--composer-max-width", composerWidth);
    document.body?.style.setProperty("--thread-content-max-width", widthVw);
    document.body?.style.setProperty("--composer-max-width", composerWidth);

    const css = `
:root {
  --thread-content-max-width: ${widthVw};
  --composer-max-width: ${composerWidth};
}
main :is(div,section,article)[class*="max-w-"] {
  max-width: min(${widthVw}, 1820px) !important;
}
form :is(div,section,article)[class*="max-w-"] {
  max-width: min(${composerWidth}, 1820px) !important;
}
main [data-testid="conversation-turn"] > div > div {
  max-width: min(${widthVw}, 1820px) !important;
  width: min(${widthVw}, 1820px) !important;
}
main [data-testid="conversation-turn"] [class*="max-w"] {
  max-width: min(${widthVw}, 1820px) !important;
}
main [data-testid="composer"] :is(div,section,article)[class*="max-w"] {
  max-width: min(${composerWidth}, 1820px) !important;
  width: min(${composerWidth}, 1820px) !important;
}
main form [class*="max-w"] {
  max-width: min(${composerWidth}, 1820px) !important;
}
`;

    let style = document.getElementById(CHAT_WIDTH_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = CHAT_WIDTH_STYLE_ID;
      document.head?.appendChild(style);
    }
    style.textContent = css;
  }, [settings.chatContentWidthPercent]);

  useEffect(() => {
    return () => {
      document.getElementById(CHAT_WIDTH_STYLE_ID)?.remove();
      document.documentElement?.style.removeProperty("--thread-content-max-width");
      document.documentElement?.style.removeProperty("--composer-max-width");
      document.body?.style.removeProperty("--thread-content-max-width");
      document.body?.style.removeProperty("--composer-max-width");
    };
  }, []);

  useEffect(() => {
    if (collapsed) {
      return;
    }

    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const host = document.getElementById(EXTENSION_HOST_ID);
      if (!host) {
        return;
      }

      const composedPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (composedPath.includes(host)) {
        return;
      }

      if (event.target instanceof Node && host.contains(event.target)) {
        return;
      }

      setCollapsed(true);
    };

    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  }, [collapsed]);

  const panelStyle = useMemo<React.CSSProperties>(
    () => ({
      width: collapsed ? 0 : width
    }),
    [collapsed, width]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const starredCount = useMemo(() => {
    return Object.values(classificationState.metaByConversationId).filter((meta) => Boolean(meta.starred)).length;
  }, [classificationState.metaByConversationId]);

  const starredConversations = useMemo(() => {
    return conversationIndex.filter((item) => {
      const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
      return Boolean(meta.starred);
    });
  }, [classificationState.metaByConversationId, conversationIndex]);

  const folderConversationCountMap = useMemo(() => {
    const counter = new Map<string, number>();
    for (const item of conversationIndex) {
      const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
      const folderId = meta.folderId;
      if (!folderId) {
        continue;
      }
      counter.set(folderId, (counter.get(folderId) ?? 0) + 1);
    }
    return counter;
  }, [classificationState.metaByConversationId, conversationIndex]);

  const uncategorizedConversationCount = useMemo(() => {
    let count = 0;
    for (const item of conversationIndex) {
      const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
      if (!meta.folderId) {
        count += 1;
      }
    }
    return count;
  }, [classificationState.metaByConversationId, conversationIndex]);

  const filteredConversations = useMemo(() => {
    return conversationIndex.filter((item) => {
      const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
      const noteText = meta.note?.toLowerCase() ?? "";
      const queryMatched =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        noteText.includes(normalizedQuery);
      if (!queryMatched) {
        return false;
      }

      if (folderFilter === "uncategorized") {
        if (meta.folderId) {
          return false;
        }
      } else if (folderFilter !== "all" && (meta.folderId ?? "") !== folderFilter) {
        return false;
      }

      if (tagFilter !== "all" && !meta.tagIds.includes(tagFilter)) {
        return false;
      }

      if (starredOnly && !meta.starred) {
        return false;
      }

      return true;
    });
  }, [classificationState.metaByConversationId, conversationIndex, folderFilter, normalizedQuery, starredOnly, tagFilter]);

  const orderedConversations = useMemo(() => {
    const next = [...filteredConversations];
    if (settings.conversationSortMode === "title_asc") {
      next.sort((left, right) => {
        const titleResult = left.title.localeCompare(right.title, "zh-CN");
        if (titleResult !== 0) {
          return titleResult;
        }
        return right.lastSeenAt - left.lastSeenAt;
      });
      return next;
    }
    next.sort((left, right) => {
      const lastSeenResult = right.lastSeenAt - left.lastSeenAt;
      if (lastSeenResult !== 0) {
        return lastSeenResult;
      }
      return left.title.localeCompare(right.title, "zh-CN");
    });
    return next;
  }, [filteredConversations, settings.conversationSortMode]);

  const conversationVirtualRowHeight =
    settings.conversationCardDensity === "compact"
      ? CONVERSATION_ROW_HEIGHT_COMPACT
      : settings.conversationCardDensity === "minimal"
        ? CONVERSATION_ROW_HEIGHT_MINIMAL
        : CONVERSATION_ROW_HEIGHT_STANDARD;

  const conversationVirtualWindow = useMemo(() => {
    if (orderedConversations.length === 0) {
      return {
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        visibleConversations: orderedConversations
      };
    }

    const viewportHeight = conversationListHeight > 0 ? conversationListHeight : CONVERSATION_LIST_FALLBACK_HEIGHT;
    const visibleCount = Math.max(1, Math.ceil(viewportHeight / conversationVirtualRowHeight));
    const startIndex = Math.max(
      0,
      Math.floor(conversationListScrollTop / conversationVirtualRowHeight) - CONVERSATION_VIRTUAL_OVERSCAN
    );
    const endIndex = Math.min(
      orderedConversations.length,
      startIndex + visibleCount + CONVERSATION_VIRTUAL_OVERSCAN * 2
    );
    const topSpacerHeight = startIndex * conversationVirtualRowHeight;
    const bottomSpacerHeight = Math.max(
      0,
      (orderedConversations.length - endIndex) * conversationVirtualRowHeight
    );

    return {
      topSpacerHeight,
      bottomSpacerHeight,
      visibleConversations: orderedConversations.slice(startIndex, endIndex)
    };
  }, [conversationListHeight, conversationListScrollTop, conversationVirtualRowHeight, orderedConversations]);

  const syncConversationListViewport = useCallback(() => {
    const listElement = conversationListRef.current;
    if (!listElement) {
      return;
    }
    setConversationListHeight(listElement.clientHeight);
    setConversationListScrollTop(listElement.scrollTop);
  }, []);

  useEffect(() => {
    if (activeView !== "conversations") {
      return;
    }

    const listElement = conversationListRef.current;
    if (!listElement) {
      return;
    }

    syncConversationListViewport();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncConversationListViewport();
          });
    resizeObserver?.observe(listElement);

    const onWindowResize = () => {
      syncConversationListViewport();
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [activeView, collapsed, syncConversationListViewport]);

  useEffect(() => {
    const listElement = conversationListRef.current;
    if (listElement) {
      listElement.scrollTop = 0;
    }
    setConversationListScrollTop(0);
    setMinimalExpandedConversationId("");
  }, [folderFilter, normalizedQuery, settings.conversationCardDensity, settings.conversationSortMode, starredOnly, tagFilter]);

  useEffect(() => {
    if (settings.conversationCardDensity !== "minimal") {
      setMinimalExpandedConversationId("");
      return;
    }
    if (!minimalExpandedConversationId) {
      return;
    }
    const exists = orderedConversations.some((item) => item.id === minimalExpandedConversationId);
    if (!exists) {
      setMinimalExpandedConversationId("");
    }
  }, [minimalExpandedConversationId, orderedConversations, settings.conversationCardDensity]);

  const handleConversationListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setConversationListScrollTop(event.currentTarget.scrollTop);
  }, []);

  const activateStarredOnly = useCallback(() => {
    setFolderFilter("all");
    setTagFilter("all");
    setStarredOnly(true);
    setShowAdvancedFilters(false);
  }, []);

  const openFolderView = useCallback((target: "all" | "uncategorized" | string) => {
    setStarredOnly(false);
    setTagFilter("all");
    setShowAdvancedFilters(false);
    setQuery("");
    if (target === "all") {
      setFolderFilter("all");
      setConversationStatus("已打开全部会话");
      return;
    }
    if (target === "uncategorized") {
      setFolderFilter("uncategorized");
      setConversationStatus("已打开未分类会话");
      return;
    }
    setFolderFilter(target);
    setConversationStatus("已打开对应文件夹会话");
  }, []);

  const enterFolderFromClassification = useCallback((target: "all" | "uncategorized" | string) => {
    openFolderView(target);
    setConversationWorkspace("index");
  }, [openFolderView]);

  const selectedConversationIdSet = useMemo(() => new Set(selectedConversationIds), [selectedConversationIds]);
  const selectedConversationCount = selectedConversationIds.length;

  useEffect(() => {
    if (selectedConversationCount > 0) {
      setBatchPanelExpanded(true);
    }
  }, [selectedConversationCount]);

  const toggleConversationSelection = useCallback((conversationId: string) => {
    setSelectedConversationIds((previous) => {
      if (previous.includes(conversationId)) {
        return previous.filter((id) => id !== conversationId);
      }
      return [...previous, conversationId];
    });
  }, []);

  const selectAllFilteredConversations = useCallback(() => {
    setSelectedConversationIds(orderedConversations.map((item) => item.id));
    setBatchPanelExpanded(true);
    setConversationStatus(`已选择当前筛选的 ${orderedConversations.length} 条会话`);
  }, [orderedConversations]);

  const clearConversationSelection = useCallback(() => {
    setSelectedConversationIds([]);
    setBatchPanelExpanded(false);
    setConversationStatus("已清空选择");
  }, []);

  const applyBatchMetaUpdate = useCallback(
    (
      actionLabel: string,
      updateMeta: (current: ConversationClassificationMeta, conversationId: string) => ConversationClassificationMeta
    ) => {
      if (selectedConversationIds.length === 0) {
        setConversationStatus("请先选择会话");
        return;
      }

      const currentMetaByConversationId = classificationState.metaByConversationId;
      const nextMetaByConversationId: Record<string, ConversationClassificationMeta> = {};
      const beforeMetaByConversationId: Record<string, ConversationClassificationMeta | undefined> = {};
      const changedIds: string[] = [];

      for (const conversationId of selectedConversationIds) {
        const currentMeta = currentMetaByConversationId[conversationId];
        const nextMeta = updateMeta(currentMeta ?? EMPTY_META, conversationId);
        if (isConversationMetaEqual(currentMeta, nextMeta)) {
          continue;
        }
        changedIds.push(conversationId);
        beforeMetaByConversationId[conversationId] = cloneConversationMeta(currentMeta);
        nextMetaByConversationId[conversationId] = nextMeta;
      }

      if (changedIds.length === 0) {
        setConversationStatus("没有可更新的会话");
        return;
      }

      setClassificationState((previous) => {
        let working = previous.metaByConversationId;
        for (const conversationId of changedIds) {
          working = upsertConversationMeta(working, conversationId, nextMetaByConversationId[conversationId]);
        }
        return {
          ...previous,
          metaByConversationId: working
        };
      });

      setLastBatchUndo({
        ids: changedIds,
        beforeMetaByConversationId,
        actionLabel,
        createdAt: Date.now()
      });
      setConversationStatus(`${actionLabel}（${changedIds.length} 条）`);
    },
    [classificationState.metaByConversationId, selectedConversationIds]
  );

  const applyBatchFolder = useCallback(() => {
    const actionLabel = batchFolderId ? "已批量设置文件夹" : "已批量设为未分类";
    applyBatchMetaUpdate(actionLabel, (current) => ({
      folderId: batchFolderId || undefined,
      tagIds: [...current.tagIds],
      starred: current.starred,
      note: current.note
    }));
  }, [applyBatchMetaUpdate, batchFolderId]);

  const applyBatchAddTag = useCallback(() => {
    if (!batchTagId) {
      setConversationStatus("请先选择标签");
      return;
    }
    applyBatchMetaUpdate("已批量添加标签", (current) => ({
      folderId: current.folderId,
      tagIds: Array.from(new Set([...current.tagIds, batchTagId])),
      starred: current.starred,
      note: current.note
    }));
  }, [applyBatchMetaUpdate, batchTagId]);

  const applyBatchRemoveTag = useCallback(() => {
    if (!batchTagId) {
      setConversationStatus("请先选择标签");
      return;
    }
    applyBatchMetaUpdate("已批量移除标签", (current) => ({
      folderId: current.folderId,
      tagIds: current.tagIds.filter((id) => id !== batchTagId),
      starred: current.starred,
      note: current.note
    }));
  }, [applyBatchMetaUpdate, batchTagId]);

  const undoLastBatchOperation = useCallback(() => {
    if (!lastBatchUndo) {
      setConversationStatus("没有可撤销的批量操作");
      return;
    }

    setClassificationState((previous) => {
      let working = previous.metaByConversationId;
      for (const conversationId of lastBatchUndo.ids) {
        const beforeMeta = lastBatchUndo.beforeMetaByConversationId[conversationId];
        if (beforeMeta) {
          working = upsertConversationMeta(working, conversationId, beforeMeta);
          continue;
        }
        const { [conversationId]: _removed, ...rest } = working;
        working = rest;
      }
      return {
        ...previous,
        metaByConversationId: working
      };
    });

    setConversationStatus(`已撤销：${lastBatchUndo.actionLabel}（${lastBatchUndo.ids.length} 条）`);
    setLastBatchUndo(null);
  }, [lastBatchUndo]);

  useEffect(() => {
    if (!settings.enableShortcuts) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const withModifier = event.ctrlKey || event.metaKey;
      if (!withModifier || !event.shiftKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setCollapsed((previous) => !previous);
        return;
      }

      if (key === "r") {
        event.preventDefault();
        refreshVisibleConversations();
        setExportStatus("已重新扫描（快捷键）");
        return;
      }

      if (key === "e") {
        event.preventDefault();
        exportConversationDefault();
        return;
      }

      if (key === "b") {
        event.preventDefault();
        setActiveView("conversations");
        selectAllFilteredConversations();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        setActiveView("conversations");
        clearConversationSelection();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        setActiveView("conversations");
        undoLastBatchOperation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    clearConversationSelection,
    exportConversationDefault,
    refreshVisibleConversations,
    selectAllFilteredConversations,
    settings.enableShortcuts,
    undoLastBatchOperation
  ]);

  const normalizedPromptQuery = promptQuery.trim().toLowerCase();

  const promptTagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const snippet of promptLibrary) {
      for (const tag of snippet.tags) {
        set.add(tag);
      }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [promptLibrary]);

  const filteredPromptLibrary = useMemo(() => {
    return promptLibrary.filter((snippet) => {
      if (promptTagFilter !== "all" && !snippet.tags.includes(promptTagFilter)) {
        return false;
      }
      if (!normalizedPromptQuery) {
        return true;
      }
      const tagsText = snippet.tags.join(" ").toLowerCase();
      return (
        snippet.title.toLowerCase().includes(normalizedPromptQuery) ||
        snippet.content.toLowerCase().includes(normalizedPromptQuery) ||
        tagsText.includes(normalizedPromptQuery)
      );
    });
  }, [normalizedPromptQuery, promptLibrary, promptTagFilter]);

  const selectedPromptIdSet = useMemo(() => new Set(selectedPromptIds), [selectedPromptIds]);

  const filteredPromptIds = useMemo(() => filteredPromptLibrary.map((item) => item.id), [filteredPromptLibrary]);

  const normalizedTimelineQuery = timelineQuery.trim().toLowerCase();

  const currentConversationTimelineAnnotations = useMemo(() => {
    if (!activeConversationId) {
      return [];
    }
    return timelineAnnotations.filter((item) => item.conversationId === activeConversationId);
  }, [activeConversationId, timelineAnnotations]);

  const timelineAnnotationByItemId = useMemo(() => {
    const map = new Map<string, TimelineNodeAnnotation>();
    for (const annotation of currentConversationTimelineAnnotations) {
      map.set(annotation.timelineItemId, annotation);
    }
    return map;
  }, [currentConversationTimelineAnnotations]);

  const timelineTagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const annotation of currentConversationTimelineAnnotations) {
      for (const tag of annotation.tags) {
        set.add(tag);
      }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [currentConversationTimelineAnnotations]);

  const highlightedTimelineCount = useMemo(() => {
    return currentConversationTimelineAnnotations.filter((item) => item.highlighted).length;
  }, [currentConversationTimelineAnnotations]);

  const taggedTimelineCount = useMemo(() => {
    return currentConversationTimelineAnnotations.filter((item) => item.tags.length > 0).length;
  }, [currentConversationTimelineAnnotations]);

  const filteredTimelineItems = useMemo(() => {
    return timelineItems.filter((item) => {
      if (timelineRoleFilter !== "all" && item.role !== timelineRoleFilter) {
        return false;
      }
      const annotation = timelineAnnotationByItemId.get(item.id);
      if (timelineTagFilter !== "all" && !annotation?.tags.includes(timelineTagFilter)) {
        return false;
      }
      if (!normalizedTimelineQuery) {
        return true;
      }
      const tagsText = annotation?.tags.join(" ").toLowerCase() ?? "";
      return (
        item.preview.toLowerCase().includes(normalizedTimelineQuery) ||
        timelineRoleLabel(item.role).toLowerCase().includes(normalizedTimelineQuery) ||
        tagsText.includes(normalizedTimelineQuery)
      );
    });
  }, [normalizedTimelineQuery, timelineAnnotationByItemId, timelineItems, timelineRoleFilter, timelineTagFilter]);

  useEffect(() => {
    if (timelineTagFilter === "all") {
      return;
    }
    if (!timelineTagOptions.includes(timelineTagFilter)) {
      setTimelineTagFilter("all");
    }
  }, [timelineTagFilter, timelineTagOptions]);

  const exportTimelineByNodes = useCallback((format: "markdown" | "html") => {
    if (!activeConversationId) {
      setTimelineStatus("请先打开会话详情页再导出时间线");
      return;
    }
    if (filteredTimelineItems.length === 0) {
      setTimelineStatus("当前筛选条件下没有可导出的时间线节点");
      return;
    }

    const nodes: TimelineExportContent[] = [];
    for (const item of filteredTimelineItems) {
      const element = timelineNodeMapRef.current[item.id];
      if (!element) {
        continue;
      }
      const content =
        format === "html"
          ? extractMessageHtmlFromNode(element)
          : extractMessageMarkdownFromNode(element);
      if (!content.trim()) {
        continue;
      }
      nodes.push({
        item,
        annotation: timelineAnnotationByItemId.get(item.id),
        content
      });
    }

    if (nodes.length === 0) {
      setTimelineStatus("未提取到可导出的时间线内容，请先刷新时间线");
      return;
    }

    const title = getConversationTitleForExport();
    const url = `${window.location.origin}${window.location.pathname}`;
    const content =
      format === "html"
        ? buildTimelineHtml(title, url, nodes, timelineQuery, timelineRoleFilter, timelineTagFilter)
        : buildTimelineMarkdown(title, url, nodes, timelineQuery, timelineRoleFilter, timelineTagFilter);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    const extension = format === "html" ? "html" : "md";
    const mimeType = format === "html" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8";
    const fileName = `${sanitizeExportFileName(title)}_timeline_${stamp}.${extension}`;
    downloadTextFile(fileName, content, mimeType);
    setTimelineStatus(`时间线 ${format === "html" ? "HTML" : "Markdown"} 已导出（${nodes.length} 条）`);
  }, [activeConversationId, filteredTimelineItems, timelineAnnotationByItemId, timelineQuery, timelineRoleFilter, timelineTagFilter]);

  const exportTimelineByDefault = useCallback(() => {
    if (settings.defaultExportFormat === "html") {
      exportTimelineByNodes("html");
      return;
    }
    exportTimelineByNodes("markdown");
  }, [exportTimelineByNodes, settings.defaultExportFormat]);

  const normalizedFormulaQuery = formulaQuery.trim().toLowerCase();

  const formulaFavoriteByKey = useMemo(() => {
    const map = new Map<string, FormulaFavorite>();
    for (const item of formulaFavorites) {
      map.set(buildFormulaFavoriteKey(item.sourceConversationId, item.displayMode, item.tex), item);
    }
    return map;
  }, [formulaFavorites]);

  const filteredFormulaItems = useMemo(() => {
    return formulaItems.filter((item) => {
      if (formulaDisplayFilter !== "all" && item.displayMode !== formulaDisplayFilter) {
        return false;
      }
      if (!normalizedFormulaQuery) {
        return true;
      }
      return (
        item.tex.toLowerCase().includes(normalizedFormulaQuery) ||
        formulaDisplayLabel(item.displayMode).toLowerCase().includes(normalizedFormulaQuery)
      );
    });
  }, [formulaDisplayFilter, formulaItems, normalizedFormulaQuery]);

  const normalizedFormulaFavoriteQuery = formulaFavoriteQuery.trim().toLowerCase();

  const filteredFormulaFavorites = useMemo(() => {
    return formulaFavorites.filter((item) => {
      if (!normalizedFormulaFavoriteQuery) {
        return true;
      }
      return (
        item.alias.toLowerCase().includes(normalizedFormulaFavoriteQuery) ||
        item.tex.toLowerCase().includes(normalizedFormulaFavoriteQuery) ||
        item.sourceConversationTitle.toLowerCase().includes(normalizedFormulaFavoriteQuery)
      );
    });
  }, [formulaFavorites, normalizedFormulaFavoriteQuery]);

  const normalizedMermaidQuery = mermaidQuery.trim().toLowerCase();

  const mermaidFavoriteByKey = useMemo(() => {
    const map = new Map<string, MermaidFavorite>();
    for (const item of mermaidFavorites) {
      map.set(buildMermaidFavoriteKey(item.sourceConversationId, item.code), item);
    }
    return map;
  }, [mermaidFavorites]);

  const filteredMermaidItems = useMemo(() => {
    return mermaidItems.filter((item) => {
      if (!normalizedMermaidQuery) {
        return true;
      }
      return (
        item.preview.toLowerCase().includes(normalizedMermaidQuery) ||
        item.code.toLowerCase().includes(normalizedMermaidQuery)
      );
    });
  }, [mermaidItems, normalizedMermaidQuery]);

  const normalizedMermaidFavoriteQuery = mermaidFavoriteQuery.trim().toLowerCase();

  const filteredMermaidFavorites = useMemo(() => {
    return mermaidFavorites.filter((item) => {
      if (!normalizedMermaidFavoriteQuery) {
        return true;
      }
      return (
        item.alias.toLowerCase().includes(normalizedMermaidFavoriteQuery) ||
        item.code.toLowerCase().includes(normalizedMermaidFavoriteQuery) ||
        item.sourceConversationTitle.toLowerCase().includes(normalizedMermaidFavoriteQuery)
      );
    });
  }, [mermaidFavorites, normalizedMermaidFavoriteQuery]);

  const activeViewMeta = useMemo(() => {
    if (activeView === "conversations") {
      return {
        kicker: "Conversation Workspace",
        title: "会话工作台",
        description: "索引、分类、批量操作和时间线在一个面板中完成。"
      };
    }
    if (activeView === "prompts") {
      return {
        kicker: "Prompt Library",
        title: "提示词库",
        description: "模板变量、预设与导入导出，统一复用高质量提示词。"
      };
    }
    if (activeView === "guide") {
      return {
        kicker: "Guide",
        title: "使用说明",
        description: "快速理解核心流程，降低上手成本。"
      };
    }
    return {
      kicker: "Settings",
      title: "设置中心",
      description: "按你的偏好配置扫描、导出、快捷键与面板行为。"
    };
  }, [activeView]);

  return (
    <div className="gv-root">
      <button
        className={`gv-toggle ${collapsed ? "gv-visible" : ""}`}
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="展开 GPT Voyager 侧边栏"
      >
        GPT Voyager
      </button>

      <aside className={`gv-panel ${collapsed ? "gv-collapsed" : ""}`} style={panelStyle}>
        <div className="gv-resize" onPointerDown={startResize} />
        <div className="gv-panel-inner">
          <div className="gv-topbar">
            <header className="gv-header">
              <div>
                <h1>GPT Voyager</h1>
                <p>Workspace for ChatGPT</p>
              </div>
              <button
                className="gv-text-btn"
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="收起侧边栏"
              >
                收起
              </button>
            </header>

            <nav className="gv-nav" aria-label="功能分区">
              <button
                className={`gv-nav-btn ${activeView === "conversations" ? "gv-nav-btn-active" : ""}`}
                type="button"
                onClick={() => {
                  setActiveView("conversations");
                  setConversationWorkspace("home");
                }}
              >
                会话工作台
              </button>
              <button
                className={`gv-nav-btn ${activeView === "prompts" ? "gv-nav-btn-active" : ""}`}
                type="button"
                onClick={() => setActiveView("prompts")}
              >
                提示词库
              </button>
              <button
                className={`gv-nav-btn ${activeView === "guide" ? "gv-nav-btn-active" : ""}`}
                type="button"
                onClick={() => setActiveView("guide")}
              >
                使用说明
              </button>
              <button
                className={`gv-nav-btn ${activeView === "settings" ? "gv-nav-btn-active" : ""}`}
                type="button"
                onClick={() => setActiveView("settings")}
              >
                设置中心
              </button>
            </nav>

            {activeView !== "conversations" ? (
              <div className="gv-view-intro" aria-live="polite">
                <span className="gv-view-kicker">{activeViewMeta.kicker}</span>
                <h2>{activeViewMeta.title}</h2>
                <p>{activeViewMeta.description}</p>
              </div>
            ) : null}
          </div>

          {activeView === "conversations" ? (
            <>
          <section className="gv-section gv-workspace-hub">
            <div className="gv-section-title-row">
              <h2>工作台入口</h2>
              <div className="gv-actions-inline">
                {conversationWorkspace !== "home" ? (
                  <button className="gv-mini-btn" type="button" onClick={() => setConversationWorkspace("home")}>
                    返回入口
                  </button>
                ) : null}
              </div>
            </div>
            {conversationWorkspace === "home" ? (
              <>
                <p className="gv-metric">每个能力单独成卡片，点击进入对应子工作台，避免信息堆叠。</p>
                <div className="gv-workspace-grid">
                  {conversationWorkspaceCards.map((card) => (
                    <button
                      key={card.key}
                      className="gv-workspace-card"
                      type="button"
                      onClick={() => setConversationWorkspace(card.key)}
                    >
                      <span className="gv-workspace-card-title">{card.title}</span>
                      <span className="gv-workspace-card-metric">{card.metric}</span>
                      <span className="gv-workspace-card-desc">{card.description}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="gv-metric">{`当前模块：${activeConversationWorkspaceLabel}`}</p>
            )}
          </section>

          <div className={`gv-workspace-panels gv-workspace-mode-${conversationWorkspace}`}>
          <section className="gv-section gv-section-export" data-gv-workspace="export">
            <div className="gv-section-title-row">
              <h2>导出中心</h2>
              <div className="gv-actions-inline gv-actions-inline-export">
                <button className="gv-mini-btn" type="button" onClick={exportConversationDefault}>
                  快速导出
                </button>
                <button className="gv-mini-btn" type="button" onClick={exportConversationMarkdown}>
                  导出 MD
                </button>
                <button className="gv-mini-btn" type="button" onClick={exportConversationHtml}>
                  导出 HTML
                </button>
                <button className="gv-mini-btn" type="button" onClick={() => void exportConversationPdf()}>
                  导出 PDF
                </button>
              </div>
            </div>
            <p className="gv-metric">当前会话可一键导出 Markdown / HTML / PDF（PDF 为直接下载）。</p>
            {exportStatus ? <p className="gv-export-status">{exportStatus}</p> : null}
          </section>

          <section className="gv-section gv-section-highlight" data-gv-workspace="overview">
            <div className="gv-stat-grid">
              <div className="gv-stat-item">
                <span>当前可见</span>
                <strong>{visibleCount}</strong>
              </div>
              <div className="gv-stat-item">
                <span>已索引</span>
                <strong>{conversationIndex.length}</strong>
              </div>
              <div className="gv-stat-item">
                <span>文件夹</span>
                <strong>{classificationState.folders.length}</strong>
              </div>
              <div className="gv-stat-item">
                <span>标签</span>
                <strong>{classificationState.tags.length}</strong>
              </div>
            </div>
            <button
              className={`gv-stat-cta ${starredOnly ? "gv-stat-cta-active" : ""}`}
              type="button"
              onClick={() => {
                if (starredOnly) {
                  setStarredOnly(false);
                  return;
                }
                activateStarredOnly();
              }}
              aria-label={starredOnly ? "退出仅星标视图" : "进入仅星标视图"}
            >
              <span>星标会话 {starredCount} 条</span>
              <span>{starredOnly ? "退出仅星标" : "查看星标"}</span>
            </button>
          </section>

          <section className="gv-section" data-gv-workspace="starred">
            <div className="gv-section-title-row">
              <h2>星标会话</h2>
              <div className="gv-actions-inline">
                <button
                  className={`gv-mini-btn ${starredOnly ? "gv-mini-btn-active" : ""}`}
                  type="button"
                  onClick={() => {
                    if (starredOnly) {
                      setStarredOnly(false);
                      return;
                    }
                    activateStarredOnly();
                  }}
                >
                  {starredOnly ? "退出仅星标" : "进入仅星标"}
                </button>
              </div>
            </div>
            {starredConversations.length === 0 ? (
              <div className="gv-empty">暂无星标会话。先在会话卡片点击“☆ 星标”。</div>
            ) : (
              <div className="gv-starred-list">
                {starredConversations.slice(0, 8).map((item) => {
                  const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
                  return (
                    <div className="gv-starred-item" key={`starred_${item.id}`}>
                      <button className="gv-item-open" type="button" onClick={() => openConversation(item.url)} title={item.title}>
                        {item.title}
                      </button>
                      <div className="gv-starred-meta">
                        <span>{formatTime(item.lastSeenAt)}</span>
                        {meta.note ? <span>{meta.note}</span> : <span>无备注</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="gv-section" data-gv-workspace="timeline">
            <div className="gv-section-title-row">
              <h2>会话时间线</h2>
              <div className="gv-actions-inline">
                <button className="gv-mini-btn" type="button" onClick={refreshConversationTimeline}>
                  刷新时间线
                </button>
                <button className="gv-mini-btn" type="button" onClick={exportTimelineByDefault}>
                  快速导出时间线
                </button>
                <button className="gv-mini-btn" type="button" onClick={() => exportTimelineByNodes("markdown")}>
                  时间线 MD
                </button>
                <button className="gv-mini-btn" type="button" onClick={() => exportTimelineByNodes("html")}>
                  时间线 HTML
                </button>
              </div>
            </div>
            <p className="gv-metric">
              {activeConversationId
                ? `当前会话共 ${timelineItems.length} 条消息，可点击直接定位；高亮 ${highlightedTimelineCount} 条，标签标注 ${taggedTimelineCount} 条。`
                : "请先打开一个会话详情页（/c/...）再使用时间线。"}
            </p>
            {timelineStatus ? <p className="gv-export-status">{timelineStatus}</p> : null}

            {!activeConversationId ? (
              <div className="gv-empty">未检测到当前会话 ID。</div>
            ) : (
              <>
                <input
                  className="gv-input"
                  type="search"
                  value={timelineQuery}
                  onChange={(event) => setTimelineQuery(event.target.value)}
                  placeholder="搜索时间线（按消息内容关键词）"
                  aria-label="搜索时间线"
                />
                <div className="gv-filter-row">
                  <VoyagerSelect
                    value={timelineRoleFilter}
                    options={timelineRoleFilterOptions}
                    onChange={(nextValue) => setTimelineRoleFilter(nextValue)}
                    ariaLabel="筛选角色"
                  />
                  <VoyagerSelect
                    value={timelineTagFilter}
                    options={[
                      { value: "all", label: "全部标签" },
                      ...timelineTagOptions.map((tag) => ({ value: tag, label: tag }))
                    ]}
                    onChange={(nextValue) => setTimelineTagFilter(nextValue)}
                    ariaLabel="筛选时间线标签"
                  />
                  <button
                    className="gv-mini-btn"
                    type="button"
                    onClick={() => {
                      setTimelineQuery("");
                      setTimelineRoleFilter("all");
                      setTimelineTagFilter("all");
                    }}
                  >
                    清空筛选
                  </button>
                  <button className="gv-mini-btn gv-mini-btn-subtle" type="button" onClick={clearConversationTimelineAnnotations}>
                    清空标注
                  </button>
                </div>

                <div className="gv-timeline-list">
                  {filteredTimelineItems.length === 0 ? (
                    <div className="gv-empty">没有匹配的时间线节点。</div>
                  ) : (
                    filteredTimelineItems.map((item) => {
                      const annotation = timelineAnnotationByItemId.get(item.id);
                      const editorOpen = timelineTagEditorOpenId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`gv-timeline-item ${timelineActiveId === item.id ? "gv-timeline-item-active" : ""}`}
                        >
                          <button className="gv-timeline-jump" type="button" onClick={() => jumpToTimelineItem(item.id)}>
                            <span className="gv-timeline-head">
                              <span className={`gv-role-badge gv-role-${item.role}`}>{timelineRoleLabel(item.role)}</span>
                              <span>{`第 ${item.index} 条 · ${item.charCount} 字`}</span>
                              {annotation?.highlighted ? <span className="gv-timeline-highlight-badge">已高亮</span> : null}
                            </span>
                            <span className="gv-timeline-preview">{item.preview}</span>
                          </button>

                          {annotation && annotation.tags.length > 0 ? (
                            <div className="gv-timeline-tags">
                              {annotation.tags.map((tag) => (
                                <button
                                  key={`${item.id}_${tag}`}
                                  className={`gv-tag ${timelineTagFilter === tag ? "gv-tag-active" : ""}`}
                                  type="button"
                                  onClick={() => setTimelineTagFilter(tag)}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="gv-btn-row gv-timeline-actions">
                            <button className="gv-mini-btn" type="button" onClick={() => toggleTimelineHighlight(item)}>
                              {annotation?.highlighted ? "取消高亮" : "高亮标注"}
                            </button>
                            <button className="gv-mini-btn gv-mini-btn-subtle" type="button" onClick={() => toggleTimelineTagEditor(item)}>
                              {editorOpen ? "收起标签" : "标签标注"}
                            </button>
                          </div>

                          {editorOpen ? (
                            <div className="gv-timeline-tag-editor">
                              <input
                                className="gv-input"
                                type="text"
                                value={timelineTagDraftById[item.id] ?? ""}
                                onChange={(event) =>
                                  setTimelineTagDraftById((previous) => ({
                                    ...previous,
                                    [item.id]: event.target.value
                                  }))
                                }
                                placeholder="标签（逗号分隔）"
                                aria-label={`时间线标签 第${item.index}条`}
                              />
                              <div className="gv-btn-row">
                                <button className="gv-mini-btn" type="button" onClick={() => saveTimelineTags(item)}>
                                  保存标签
                                </button>
                                <button
                                  className="gv-mini-btn gv-mini-btn-subtle"
                                  type="button"
                                  onClick={() =>
                                    setTimelineTagDraftById((previous) => ({
                                      ...previous,
                                      [item.id]: ""
                                    }))
                                  }
                                >
                                  清空输入
                                </button>
                              </div>
                              {annotation && annotation.tags.length > 0 ? (
                                <div className="gv-timeline-tags">
                                  {annotation.tags.map((tag) => (
                                    <button
                                      key={`${item.id}_remove_${tag}`}
                                      className="gv-tag"
                                      type="button"
                                      onClick={() => removeTimelineTag(item, tag)}
                                    >
                                      {tag} ×
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </section>

          <section className="gv-section" data-gv-workspace="formula">
            <div className="gv-section-title-row">
              <h2>公式工作台</h2>
              <div className="gv-actions-inline">
                <button className="gv-mini-btn" type="button" onClick={refreshConversationFormulas}>
                  刷新公式
                </button>
              </div>
            </div>
            <p className="gv-metric">
              {activeConversationId
                ? `当前会话检测到 ${formulaItems.length} 个公式，可复制 LaTeX / Word 公式或定位。`
                : "请先打开一个会话详情页（/c/...）再使用公式工作台。"}
            </p>
            {settings.formulaClickCopyEnabled ? (
              <p className="gv-metric">已开启“点击页面公式自动复制（Word 优先，失败回退 LaTeX）”。</p>
            ) : null}
            {formulaStatus ? <p className="gv-export-status">{formulaStatus}</p> : null}
            {formulaCopiedTex ? (
              <div className="gv-formula-copied">
                <div className="gv-formula-copied-head">
                  <span>最近复制的 LaTeX</span>
                  <span>{formulaCopiedFrom}</span>
                </div>
                <code className="gv-formula-tex">{formulaCopiedTex}</code>
              </div>
            ) : null}

            {!activeConversationId ? (
              <div className="gv-empty">未检测到当前会话 ID。</div>
            ) : (
              <>
                <input
                  className="gv-input"
                  type="search"
                  value={formulaQuery}
                  onChange={(event) => setFormulaQuery(event.target.value)}
                  placeholder="搜索公式（按 TeX 内容）"
                  aria-label="搜索公式"
                />
                <div className="gv-filter-row gv-filter-row-compact">
                  <VoyagerSelect
                    value={formulaDisplayFilter}
                    options={formulaDisplayFilterOptions}
                    onChange={(nextValue) => setFormulaDisplayFilter(nextValue)}
                    ariaLabel="筛选公式类型"
                  />
                  <button
                    className="gv-mini-btn"
                    type="button"
                    onClick={() => {
                      setFormulaQuery("");
                      setFormulaDisplayFilter("all");
                    }}
                  >
                    清空筛选
                  </button>
                </div>

                <div className="gv-formula-list">
                  {filteredFormulaItems.length === 0 ? (
                    <div className="gv-empty">没有匹配的公式。</div>
                  ) : (
                    filteredFormulaItems.map((item) => {
                      const favorite =
                        activeConversationId
                          ? formulaFavoriteByKey.get(buildFormulaFavoriteKey(activeConversationId, item.displayMode, item.tex))
                          : undefined;
                      return (
                      <div
                        key={item.id}
                        className={`gv-formula-item ${formulaActiveId === item.id ? "gv-formula-item-active" : ""}`}
                      >
                        <div className="gv-formula-head">
                          <span className={`gv-formula-badge gv-formula-${item.displayMode}`}>{formulaDisplayLabel(item.displayMode)}</span>
                          <span className="gv-formula-meta">{`消息 ${item.messageIndex} · ${item.source}`}</span>
                          {favorite ? <span className="gv-formula-fav-tip">已收藏</span> : null}
                        </div>
                        <code className="gv-formula-tex">{item.tex}</code>
                        <div className="gv-btn-row">
                          <button className="gv-mini-btn" type="button" onClick={() => copyFormulaTex(item.tex, "公式工作台")}>
                            复制 TeX
                          </button>
                          <button
                            className="gv-mini-btn"
                            type="button"
                            onClick={() => copyFormulaWordSource(item.mathml, item.tex, "公式工作台")}
                          >
                            复制 Word
                          </button>
                          <button className="gv-mini-btn" type="button" onClick={() => jumpToFormulaItem(item.id)}>
                            定位消息
                          </button>
                          <button
                            className={`gv-mini-btn ${favorite ? "gv-mini-btn-active" : ""}`}
                            type="button"
                            onClick={() => toggleFormulaFavorite(item)}
                          >
                            {favorite ? "取消收藏" : "收藏公式"}
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>

                <div className="gv-formula-favorites">
                  <div className="gv-section-title-row">
                    <h3>公式收藏</h3>
                    <span className="gv-inline-empty">{`共 ${formulaFavorites.length} 条`}</span>
                  </div>
                  <input
                    className="gv-input"
                    type="search"
                    value={formulaFavoriteQuery}
                    onChange={(event) => setFormulaFavoriteQuery(event.target.value)}
                    placeholder="搜索别名 / TeX / 会话标题"
                    aria-label="搜索公式收藏"
                  />
                  <div className="gv-formula-fav-list">
                    {filteredFormulaFavorites.length === 0 ? (
                      <div className="gv-empty">暂无收藏公式，先在上方点击“收藏公式”。</div>
                    ) : (
                      filteredFormulaFavorites.map((favorite) => (
                        <div className="gv-formula-fav-item" key={favorite.id}>
                          <div className="gv-formula-fav-head">
                            <input
                              className="gv-input gv-formula-alias-input"
                              type="text"
                              value={favorite.alias}
                              onChange={(event) => updateFormulaFavoriteAlias(favorite.id, event.target.value)}
                              placeholder="公式别名"
                              aria-label={`公式别名 ${favorite.alias}`}
                            />
                            <span className="gv-formula-meta">{`${formulaDisplayLabel(favorite.displayMode)} · ${favorite.sourceConversationTitle}`}</span>
                          </div>
                          <code className="gv-formula-tex">{favorite.tex}</code>
                          <div className="gv-btn-row">
                            <button className="gv-mini-btn" type="button" onClick={() => copyFormulaTex(favorite.tex, "公式收藏")}>
                              复制 TeX
                            </button>
                            <button
                              className="gv-mini-btn"
                              type="button"
                              onClick={() => copyFormulaWordSource(favorite.mathml, favorite.tex, "公式收藏")}
                            >
                              复制 Word
                            </button>
                            <button className="gv-mini-btn" type="button" onClick={() => locateFormulaFavorite(favorite)}>
                              {favorite.sourceConversationId === activeConversationId ? "定位来源" : "打开来源会话"}
                            </button>
                            <button className="gv-mini-btn gv-danger-btn" type="button" onClick={() => removeFormulaFavorite(favorite.id)}>
                              删除收藏
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="gv-section" data-gv-workspace="mermaid">
            <div className="gv-section-title-row">
              <h2>Mermaid 工作台</h2>
              <div className="gv-actions-inline">
                <button className="gv-mini-btn" type="button" onClick={refreshConversationMermaid}>
                  刷新图表
                </button>
              </div>
            </div>
            <p className="gv-metric">
              {activeConversationId
                ? `当前会话检测到 ${mermaidItems.length} 个 Mermaid 图表，可预览、复制、收藏并导出。`
                : "请先打开一个会话详情页（/c/...）再使用 Mermaid 工作台。"}
            </p>
            {mermaidStatus ? <p className="gv-export-status">{mermaidStatus}</p> : null}

            {!activeConversationId ? (
              <div className="gv-empty">未检测到当前会话 ID。</div>
            ) : (
              <>
                <input
                  className="gv-input"
                  type="search"
                  value={mermaidQuery}
                  onChange={(event) => setMermaidQuery(event.target.value)}
                  placeholder="搜索 Mermaid（按首行或源码关键词）"
                  aria-label="搜索 Mermaid 图表"
                />
                <div className="gv-mermaid-list">
                  {filteredMermaidItems.length === 0 ? (
                    <div className="gv-empty">没有匹配的 Mermaid 图表。</div>
                  ) : (
                    filteredMermaidItems.map((item) => {
                      const svg = mermaidSvgById[item.id];
                      const errorText = mermaidErrorById[item.id];
                      const favorite =
                        activeConversationId
                          ? mermaidFavoriteByKey.get(buildMermaidFavoriteKey(activeConversationId, item.code))
                          : undefined;
                      const exportBaseName = `mermaid_${item.messageIndex}_${item.preview}`;
                      return (
                        <div
                          key={item.id}
                          className={`gv-mermaid-item ${mermaidActiveId === item.id ? "gv-mermaid-item-active" : ""}`}
                        >
                          <div className="gv-mermaid-head">
                            <span className="gv-formula-badge">Mermaid</span>
                            <span className="gv-formula-meta">{`消息 ${item.messageIndex} · ${item.preview}`}</span>
                            {favorite ? <span className="gv-formula-fav-tip">已收藏</span> : null}
                          </div>
                          <code className="gv-formula-tex">{item.code}</code>
                          <div className="gv-mermaid-canvas-wrap">
                            {svg ? (
                              <div
                                className="gv-mermaid-canvas"
                                dangerouslySetInnerHTML={{ __html: svg }}
                              />
                            ) : errorText ? (
                              <div className="gv-empty">{errorText}</div>
                            ) : (
                              <div className="gv-empty">图表渲染中...</div>
                            )}
                          </div>
                          <div className="gv-btn-row">
                            <button className="gv-mini-btn" type="button" onClick={() => copyMermaidCode(item.code)}>
                              复制源码
                            </button>
                            <button className="gv-mini-btn" type="button" onClick={() => exportMermaidSource(item.code, exportBaseName)}>
                              导出源码
                            </button>
                            <button className="gv-mini-btn" type="button" onClick={() => void exportMermaidSvg(item.code, exportBaseName, svg)}>
                              导出 SVG
                            </button>
                            <button className="gv-mini-btn" type="button" onClick={() => void exportMermaidHtml(item.code, exportBaseName, svg)}>
                              导出 HTML
                            </button>
                            <button className="gv-mini-btn" type="button" onClick={() => jumpToMermaidItem(item.id)}>
                              定位消息
                            </button>
                            <button
                              className={`gv-mini-btn ${favorite ? "gv-mini-btn-active" : ""}`}
                              type="button"
                              onClick={() => toggleMermaidFavorite(item)}
                            >
                              {favorite ? "取消收藏" : "收藏图表"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="gv-mermaid-favorites">
                  <div className="gv-section-title-row">
                    <h3>图表收藏</h3>
                    <span className="gv-inline-empty">{`共 ${mermaidFavorites.length} 条`}</span>
                  </div>
                  <input
                    className="gv-input"
                    type="search"
                    value={mermaidFavoriteQuery}
                    onChange={(event) => setMermaidFavoriteQuery(event.target.value)}
                    placeholder="搜索别名 / 源码 / 会话标题"
                    aria-label="搜索图表收藏"
                  />
                  <div className="gv-mermaid-fav-list">
                    {filteredMermaidFavorites.length === 0 ? (
                      <div className="gv-empty">暂无图表收藏，先在上方点击“收藏图表”。</div>
                    ) : (
                      filteredMermaidFavorites.map((favorite) => {
                        const normalizedFavoriteCode = normalizeMermaidCodeForMatch(favorite.code);
                        const matchedItem =
                          favorite.sourceConversationId === activeConversationId
                            ? mermaidItems.find((item) => normalizeMermaidCodeForMatch(item.code) === normalizedFavoriteCode)
                            : undefined;
                        const favoriteSvg = matchedItem ? mermaidSvgById[matchedItem.id] : undefined;
                        const exportBaseName = `mermaid_favorite_${favorite.alias || favorite.preview}`;
                        return (
                          <div className="gv-mermaid-fav-item" key={favorite.id}>
                            <div className="gv-mermaid-fav-head">
                              <input
                                className="gv-input gv-mermaid-alias-input"
                                type="text"
                                value={favorite.alias}
                                onChange={(event) => updateMermaidFavoriteAlias(favorite.id, event.target.value)}
                                placeholder="图表别名"
                                aria-label={`图表别名 ${favorite.alias}`}
                              />
                              <span className="gv-formula-meta">{`消息 ${favorite.sourceMessageIndex || "-"} · ${favorite.sourceConversationTitle}`}</span>
                            </div>
                            <code className="gv-formula-tex">{favorite.code}</code>
                            <div className="gv-btn-row">
                              <button className="gv-mini-btn" type="button" onClick={() => copyMermaidCode(favorite.code)}>
                                复制源码
                              </button>
                              <button className="gv-mini-btn" type="button" onClick={() => exportMermaidSource(favorite.code, exportBaseName)}>
                                导出源码
                              </button>
                              <button className="gv-mini-btn" type="button" onClick={() => void exportMermaidSvg(favorite.code, exportBaseName, favoriteSvg)}>
                                导出 SVG
                              </button>
                              <button className="gv-mini-btn" type="button" onClick={() => void exportMermaidHtml(favorite.code, exportBaseName, favoriteSvg)}>
                                导出 HTML
                              </button>
                              <button className="gv-mini-btn" type="button" onClick={() => locateMermaidFavorite(favorite)}>
                                {favorite.sourceConversationId === activeConversationId ? "定位来源" : "打开来源会话"}
                              </button>
                              <button className="gv-mini-btn gv-danger-btn" type="button" onClick={() => removeMermaidFavorite(favorite.id)}>
                                删除收藏
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
          <section className="gv-section" data-gv-workspace="classification">
            <h2>分类管理</h2>
            <p className="gv-metric">分类以单列列表展示，可直接进入对应会话列表。</p>
            <div className="gv-folder-card-grid">
              <div className={`gv-folder-card ${folderFilter === "all" && !starredOnly ? "gv-folder-card-active" : ""}`}>
                <div className="gv-folder-card-head">
                  <strong>全部会话</strong>
                  <span>{conversationIndex.length} 条</span>
                </div>
                <div className="gv-folder-card-actions">
                  <button className="gv-mini-btn" type="button" onClick={() => enterFolderFromClassification("all")}>
                    进入
                  </button>
                </div>
              </div>

              <div className={`gv-folder-card ${folderFilter === "uncategorized" && !starredOnly ? "gv-folder-card-active" : ""}`}>
                <div className="gv-folder-card-head">
                  <strong>未分类</strong>
                  <span>{uncategorizedConversationCount} 条</span>
                </div>
                <div className="gv-folder-card-actions">
                  <button className="gv-mini-btn" type="button" onClick={() => enterFolderFromClassification("uncategorized")}>
                    进入
                  </button>
                </div>
              </div>

              {classificationState.folders.map((folder) => (
                <div
                  className={`gv-folder-card ${folderFilter === folder.id && !starredOnly ? "gv-folder-card-active" : ""}`}
                  key={`classification_folder_card_${folder.id}`}
                >
                  <div className="gv-folder-card-head">
                    <strong>{folder.name}</strong>
                    <span>{folderConversationCountMap.get(folder.id) ?? 0} 条</span>
                  </div>
                  <div className="gv-folder-card-actions">
                    <button className="gv-mini-btn" type="button" onClick={() => enterFolderFromClassification(folder.id)}>
                      进入
                    </button>
                    <button
                      className="gv-mini-btn gv-danger-btn"
                      type="button"
                      onClick={() => removeFolder(folder.id)}
                      aria-label={`删除文件夹 ${folder.name}`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="gv-form-row">
              <input
                className="gv-input"
                type="text"
                value={folderDraft}
                onChange={(event) => setFolderDraft(event.target.value)}
                placeholder="新建文件夹"
                aria-label="新建文件夹"
              />
              <button className="gv-mini-btn" type="button" onClick={createFolder}>
                添加
              </button>
            </div>

            <div className="gv-form-row">
              <input
                className="gv-input"
                type="text"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="新建标签"
                aria-label="新建标签"
              />
              <button className="gv-mini-btn" type="button" onClick={createTag}>
                添加
              </button>
            </div>

            <div className="gv-chip-wrap">
              {classificationState.tags.length === 0 ? (
                <span className="gv-inline-empty">暂无标签</span>
              ) : (
                classificationState.tags.map((tag) => (
                  <span className="gv-chip gv-chip-tag" key={tag.id}>
                    <span>{tag.name}</span>
                    <button className="gv-chip-remove" type="button" onClick={() => removeTag(tag.id)} aria-label={`删除标签 ${tag.name}`}>
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>

          <section className="gv-section" data-gv-workspace="index">
            <div className="gv-section-title-row">
              <h2>会话索引</h2>
              <div className="gv-actions-inline">
                <button className="gv-mini-btn" type="button" onClick={refreshVisibleConversations}>
                  重新扫描
                </button>
              </div>
            </div>
            <p className="gv-metric">
              当前可见 <strong>{visibleCount}</strong> 条，已索引 <strong>{conversationIndex.length}</strong> 条
            </p>
            {conversationStatus ? <p className="gv-export-status">{conversationStatus}</p> : null}

            <input
              className="gv-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题 / 会话 ID / 备注"
              aria-label="搜索会话"
            />

            <div className="gv-folder-quick-wrap">
              <div className="gv-folder-quick-head">打开文件夹</div>
              <div className="gv-folder-quick-list">
                <button
                  className={`gv-folder-pill ${folderFilter === "all" && !starredOnly ? "gv-folder-pill-active" : ""}`}
                  type="button"
                  onClick={() => openFolderView("all")}
                >
                  <span>全部</span>
                  <span>{conversationIndex.length}</span>
                </button>
                <button
                  className={`gv-folder-pill ${folderFilter === "uncategorized" && !starredOnly ? "gv-folder-pill-active" : ""}`}
                  type="button"
                  onClick={() => openFolderView("uncategorized")}
                >
                  <span>未分类</span>
                  <span>{uncategorizedConversationCount}</span>
                </button>
                {classificationState.folders.map((folder) => (
                  <button
                    key={`folder_quick_${folder.id}`}
                    className={`gv-folder-pill ${folderFilter === folder.id && !starredOnly ? "gv-folder-pill-active" : ""}`}
                    type="button"
                    onClick={() => openFolderView(folder.id)}
                  >
                    <span>{folder.name}</span>
                    <span>{folderConversationCountMap.get(folder.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="gv-filter-simple-row">
              <button
                className={`gv-mini-btn ${starredOnly ? "gv-mini-btn-active" : ""}`}
                type="button"
                onClick={() => setStarredOnly((previous) => !previous)}
              >
                仅星标
              </button>
              <button
                className={`gv-mini-btn ${showAdvancedFilters ? "gv-mini-btn-active" : ""}`}
                type="button"
                onClick={() => setShowAdvancedFilters((previous) => !previous)}
              >
                {showAdvancedFilters ? "高级筛选 ▴" : "高级筛选 ▾"}
              </button>
              <button
                className="gv-mini-btn"
                type="button"
                onClick={() => {
                  setQuery("");
                  setFolderFilter("all");
                  setTagFilter("all");
                  setStarredOnly(false);
                  setShowAdvancedFilters(false);
                }}
              >
                清空筛选
              </button>
            </div>

            <div className="gv-order-density-row">
              <label className="gv-order-density-item">
                <span>排序</span>
                <VoyagerSelect
                  value={settings.conversationSortMode}
                  options={CONVERSATION_SORT_OPTIONS}
                  onChange={(nextValue) =>
                    setSettings((previous) => ({
                      ...previous,
                      conversationSortMode: nextValue
                    }))
                  }
                  ariaLabel="会话排序"
                />
              </label>
              <label className="gv-order-density-item">
                <span>卡片密度</span>
                <VoyagerSelect
                  value={settings.conversationCardDensity}
                  options={CONVERSATION_DENSITY_OPTIONS}
                  onChange={(nextValue) =>
                    setSettings((previous) => ({
                      ...previous,
                      conversationCardDensity: nextValue
                    }))
                  }
                  ariaLabel="会话卡片密度"
                />
              </label>
            </div>

            {showAdvancedFilters ? (
              <div className="gv-filter-advanced">
                <label className="gv-filter-advanced-item">
                  <span>文件夹</span>
                  <VoyagerSelect
                    value={folderFilter}
                    options={[
                      { value: "all", label: "全部文件夹" },
                      { value: "uncategorized", label: "未分类" },
                      ...classificationState.folders.map((folder) => ({ value: folder.id, label: folder.name }))
                    ]}
                    onChange={(nextValue) => setFolderFilter(nextValue)}
                    ariaLabel="按文件夹筛选会话"
                  />
                </label>

                <label className="gv-filter-advanced-item">
                  <span>标签</span>
                  <VoyagerSelect
                    value={tagFilter}
                    options={[
                      { value: "all", label: "全部标签" },
                      ...classificationState.tags.map((tag) => ({ value: tag.id, label: tag.name }))
                    ]}
                    onChange={(nextValue) => setTagFilter(nextValue)}
                    ariaLabel="按标签筛选会话"
                  />
                </label>
              </div>
            ) : null}

            <div className={`gv-batch-panel ${batchPanelExpanded ? "gv-batch-panel-expanded" : ""}`}>
              <div className="gv-batch-head">
                <div className="gv-batch-head-main">
                  <strong>批量操作</strong>
                  <span>{`已选择 ${selectedConversationCount} 条`}</span>
                </div>
                <div className="gv-actions-inline">
                  <button
                    className={`gv-mini-btn ${batchPanelExpanded ? "gv-mini-btn-active" : ""}`}
                    type="button"
                    onClick={() => setBatchPanelExpanded((previous) => !previous)}
                  >
                    {batchPanelExpanded ? "批量操作 ▴" : "批量操作 ▾"}
                  </button>
                </div>
              </div>

              {batchPanelExpanded ? (
                <div className="gv-batch-body">
                  <div className="gv-batch-quick">
                    <button className="gv-mini-btn" type="button" onClick={selectAllFilteredConversations}>
                      全选当前筛选
                    </button>
                    <button className="gv-mini-btn" type="button" onClick={clearConversationSelection}>
                      清空选择
                    </button>
                    <button
                      className="gv-mini-btn"
                      type="button"
                      onClick={undoLastBatchOperation}
                      disabled={!lastBatchUndo}
                      title={lastBatchUndo ? `${lastBatchUndo.actionLabel}（${lastBatchUndo.ids.length} 条）` : "暂无可撤销操作"}
                    >
                      撤销批量
                    </button>
                  </div>
                  <p className="gv-batch-hint">
                    {lastBatchUndo
                      ? `可撤销：${lastBatchUndo.actionLabel}（${lastBatchUndo.ids.length} 条，${formatTime(lastBatchUndo.createdAt)}） · Ctrl/⌘ + Shift + Z`
                      : "快捷键：Ctrl/⌘ + Shift + B 全选，Ctrl/⌘ + Shift + N 清空，Ctrl/⌘ + Shift + Z 撤销"}
                  </p>
                  <div className="gv-batch-grid">
                    <div className="gv-batch-block">
                      <span className="gv-batch-label">文件夹</span>
                      <div className="gv-batch-block-row">
                        <VoyagerSelect
                          value={batchFolderId}
                          options={[
                            { value: "", label: "未分类" },
                            ...classificationState.folders.map((folder) => ({ value: folder.id, label: folder.name }))
                          ]}
                          onChange={(nextValue) => setBatchFolderId(nextValue)}
                          ariaLabel="批量选择文件夹"
                          className="gv-select-shell-compact"
                        />
                        <button className="gv-mini-btn" type="button" onClick={applyBatchFolder}>
                          应用
                        </button>
                      </div>
                    </div>

                    <div className="gv-batch-block">
                      <span className="gv-batch-label">标签</span>
                      <div className="gv-batch-block-row">
                        <VoyagerSelect
                          value={batchTagId}
                          options={[
                            { value: "", label: "选择标签" },
                            ...classificationState.tags.map((tag) => ({ value: tag.id, label: tag.name }))
                          ]}
                          onChange={(nextValue) => setBatchTagId(nextValue)}
                          ariaLabel="批量选择标签"
                          className="gv-select-shell-compact"
                        />
                        <div className="gv-actions-inline">
                          <button className="gv-mini-btn" type="button" onClick={applyBatchAddTag}>
                            添加
                          </button>
                          <button className="gv-mini-btn" type="button" onClick={applyBatchRemoveTag}>
                            移除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="gv-batch-hint">默认收起，勾选会话后点击“批量操作 ▾”展开。</p>
              )}
            </div>

            <div
              className={`gv-list ${
                settings.conversationCardDensity === "compact"
                  ? "gv-list-compact"
                  : settings.conversationCardDensity === "minimal"
                    ? "gv-list-minimal"
                    : ""
              }`}
              ref={conversationListRef}
              onScroll={handleConversationListScroll}
            >
              {orderedConversations.length === 0 ? (
                <div className="gv-empty">
                  {conversationIndex.length === 0
                    ? "暂无会话索引。请打开左侧聊天列表后稍等自动采集。"
                    : starredOnly
                      ? "当前处于“仅星标”筛选，没有匹配结果。可退出仅星标后查看全部会话。"
                      : "没有匹配结果，试试其他关键词或分类筛选。"}
                </div>
              ) : (
                <>
                {conversationVirtualWindow.topSpacerHeight > 0 ? (
                  <div
                    className="gv-virtual-spacer"
                    style={{ height: `${conversationVirtualWindow.topSpacerHeight}px` }}
                    aria-hidden="true"
                  />
                ) : null}
                {conversationVirtualWindow.visibleConversations.map((item) => {
                  const isActive = item.id === activeConversationId;
                  const meta = classificationState.metaByConversationId[item.id] ?? EMPTY_META;
                  const selectedForBatch = selectedConversationIdSet.has(item.id);
                  const minimalMode = settings.conversationCardDensity === "minimal";
                  const minimalExpanded = minimalMode && minimalExpandedConversationId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`gv-item ${
                        settings.conversationCardDensity === "compact"
                          ? "gv-item-compact"
                          : settings.conversationCardDensity === "minimal"
                            ? "gv-item-minimal"
                            : ""
                      } ${isActive ? "gv-item-active" : ""} ${minimalExpanded ? "gv-item-minimal-expanded" : ""}`}
                      onClick={(event) => {
                        if (!minimalMode) {
                          return;
                        }
                        const target = event.target as HTMLElement;
                        if (
                          target.closest(
                            "button,input,textarea,label,a,.gv-select-shell,.gv-select-menu,.gv-tag,.gv-star-btn,.gv-check-wrap"
                          )
                        ) {
                          return;
                        }
                        setMinimalExpandedConversationId((previous) => (previous === item.id ? "" : item.id));
                      }}
                    >
                      <div className="gv-item-top">
                        <label className="gv-check-wrap">
                          <input
                            type="checkbox"
                            checked={selectedForBatch}
                            onChange={() => toggleConversationSelection(item.id)}
                            aria-label={`选择会话 ${item.title}`}
                          />
                          <span>{selectedForBatch ? "已选" : "选择"}</span>
                        </label>
                        <button className="gv-item-open" type="button" onClick={() => openConversation(item.url)} title={item.title}>
                          {item.title}
                        </button>
                      </div>
                      <span className="gv-item-meta">
                        <button
                          className={`gv-star-btn ${meta.starred ? "gv-star-btn-active" : ""}`}
                          type="button"
                          aria-label={meta.starred ? "取消星标" : "设为星标"}
                          onClick={() => toggleConversationStar(item.id)}
                        >
                          {meta.starred ? "★ 已星标" : "☆ 星标"}
                        </button>
                        <span>{item.id.slice(0, 8)}</span>
                        <span>{formatTime(item.lastSeenAt)}</span>
                      </span>

                      <div className="gv-item-controls">
                        <VoyagerSelect
                          value={meta.folderId ?? ""}
                          options={[
                            { value: "", label: "未分类" },
                            ...classificationState.folders.map((folder) => ({ value: folder.id, label: folder.name }))
                          ]}
                          onChange={(nextValue) => setConversationFolder(item.id, nextValue)}
                          ariaLabel={`会话文件夹 ${item.title}`}
                          className="gv-select-shell-compact"
                        />
                        <button className="gv-mini-btn gv-mini-btn-subtle" type="button" onClick={() => openConversationFolder(meta.folderId)}>
                          打开该文件夹
                        </button>
                      </div>

                      <div className="gv-tag-row">
                        {classificationState.tags.length === 0 ? (
                          <span className="gv-inline-empty">暂无标签</span>
                        ) : (
                          classificationState.tags.map((tag) => {
                            const selected = meta.tagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                className={`gv-tag ${selected ? "gv-tag-active" : ""}`}
                                type="button"
                                onClick={() => toggleConversationTag(item.id, tag.id)}
                              >
                                {tag.name}
                              </button>
                            );
                          })
                        )}
                      </div>

                      {minimalMode ? (
                        minimalExpanded ? (
                          <input
                            className="gv-input gv-item-note"
                            type="text"
                            value={meta.note ?? ""}
                            onChange={(event) => setConversationNote(item.id, event.target.value)}
                            placeholder="添加备注（最多 240 字）"
                            aria-label={`会话备注 ${item.title}`}
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : (
                          <div className="gv-item-note-collapsed" aria-hidden="true">
                            {meta.note ? `备注：${meta.note}` : "点击卡片空白区域展开备注"}
                          </div>
                        )
                      ) : (
                        <input
                          className="gv-input gv-item-note"
                          type="text"
                          value={meta.note ?? ""}
                          onChange={(event) => setConversationNote(item.id, event.target.value)}
                          placeholder="添加备注（最多 240 字）"
                          aria-label={`会话备注 ${item.title}`}
                        />
                      )}
                    </div>
                  );
                })}
                {conversationVirtualWindow.bottomSpacerHeight > 0 ? (
                  <div
                    className="gv-virtual-spacer"
                    style={{ height: `${conversationVirtualWindow.bottomSpacerHeight}px` }}
                    aria-hidden="true"
                  />
                ) : null}
                </>
              )}
            </div>
          </section>
          </div>
            </>
          ) : null}

          {activeView === "prompts" ? (
            <>
          <section className="gv-section gv-section-prompts">
            <div className="gv-section-title-row gv-section-title-row-prompts">
              <h2>提示词库</h2>
              <div className="gv-actions-inline">
                <button className="gv-mini-btn" type="button" onClick={openPromptTemplateImportPicker}>
                  导入共享模板
                </button>
                <button className="gv-mini-btn" type="button" onClick={exportSelectedPromptTemplates}>
                  批量导出
                </button>
                <input
                  ref={promptTemplateFileInputRef}
                  className="gv-hidden-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={importPromptTemplates}
                />
              </div>
            </div>

            <div className="gv-prompt-overview">
              当前共 <strong>{promptLibrary.length}</strong> 条模板，筛选后 <strong>{filteredPromptLibrary.length}</strong> 条，插入模式为
              <strong>{settings.promptInsertMode === "append" ? " 追加" : " 覆盖"}</strong>，已选择
              <strong>{` ${selectedPromptIds.length} `}</strong>条。
            </div>

            <div className="gv-prompt-filter-panel">
              <input
                className="gv-input"
                type="search"
                value={promptQuery}
                onChange={(event) => setPromptQuery(event.target.value)}
                placeholder="搜索标题 / 正文 / 标签"
                aria-label="搜索提示词"
              />
              <div className="gv-prompt-filter-grid">
                <VoyagerSelect
                  value={promptTagFilter}
                  options={[
                    { value: "all", label: "全部标签" },
                    ...promptTagOptions.map((tag) => ({ value: tag, label: tag }))
                  ]}
                  onChange={(nextValue) => setPromptTagFilter(nextValue)}
                  ariaLabel="提示词标签筛选"
                />
                <button
                  className="gv-mini-btn"
                  type="button"
                  onClick={() => {
                    setPromptQuery("");
                    setPromptTagFilter("all");
                  }}
                >
                  清空筛选
                </button>
                <button className="gv-mini-btn gv-mini-btn-subtle" type="button" onClick={() => selectAllFilteredPrompts(filteredPromptIds)}>
                  全选筛选结果
                </button>
                <button className="gv-mini-btn gv-mini-btn-subtle" type="button" onClick={clearPromptSelection}>
                  清空选择
                </button>
              </div>
            </div>

            <div className="gv-prompt-editor-panel">
              <div className="gv-form-row gv-form-row-prompt-title">
                <input
                  className="gv-input"
                  type="text"
                  value={promptTitleDraft}
                  onChange={(event) => setPromptTitleDraft(event.target.value)}
                  placeholder="提示词标题"
                  aria-label="提示词标题"
                />
                <button className="gv-mini-btn" type="button" onClick={savePrompt}>
                  {editingPromptId ? "更新" : "保存"}
                </button>
              </div>
              <input
                className="gv-input"
                type="text"
                value={promptTagsDraft}
                onChange={(event) => setPromptTagsDraft(event.target.value)}
                placeholder="标签（用逗号分隔，例如：写作, 学习, 代码）"
                aria-label="提示词标签"
              />
              <textarea
                className="gv-textarea"
                value={promptContentDraft}
                onChange={(event) => setPromptContentDraft(event.target.value)}
                placeholder="输入提示词正文..."
                aria-label="提示词正文"
              />
              <div className="gv-btn-row gv-prompt-editor-foot">
                {editingPromptId ? (
                  <button
                    className="gv-mini-btn"
                    type="button"
                    onClick={() => {
                      setEditingPromptId("");
                      setPromptTitleDraft("");
                      setPromptContentDraft("");
                      setPromptTagsDraft("");
                    }}
                  >
                    取消编辑
                  </button>
                ) : (
                  <span className="gv-inline-empty">
                    插入模式：{settings.promptInsertMode === "append" ? "追加到输入框" : "覆盖输入框"}
                  </span>
                )}
                <span className="gv-status">{promptStatus}</span>
              </div>
            </div>

            <div className="gv-prompt-list">
              {promptLibrary.length === 0 ? (
                <div className="gv-empty">暂无提示词。先新增一条常用模板。</div>
              ) : filteredPromptLibrary.length === 0 ? (
                <div className="gv-empty">没有匹配的提示词，试试更换关键词或标签。</div>
              ) : (
                filteredPromptLibrary.map((snippet) => {
                  const variables = extractPromptVariables(snippet.content);
                  const variableValues = promptVariableValues[snippet.id] ?? {};
                  const variablePanelOpen = promptVariableOpenId === snippet.id;
                  const selectedForBatch = selectedPromptIdSet.has(snippet.id);

                  return (
                    <div className="gv-prompt-item" key={snippet.id}>
                      <div className="gv-prompt-head">
                        <label className="gv-check-wrap">
                          <input
                            type="checkbox"
                            checked={selectedForBatch}
                            onChange={() => togglePromptSelection(snippet.id)}
                            aria-label={`选择模板 ${snippet.title}`}
                          />
                          <span>{selectedForBatch ? "已选" : "选择"}</span>
                        </label>
                        <div className="gv-prompt-title">{snippet.title}</div>
                      </div>
                      {snippet.tags.length > 0 ? (
                        <div className="gv-prompt-tags">
                          {snippet.tags.map((tag) => (
                            <button
                              key={`${snippet.id}_${tag}`}
                              className={`gv-tag ${promptTagFilter === tag ? "gv-tag-active" : ""}`}
                              type="button"
                              onClick={() => setPromptTagFilter(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="gv-prompt-content">{snippet.content}</div>
                      <div className="gv-btn-row">
                        <button className="gv-mini-btn" type="button" onClick={() => copyPrompt(snippet.content)}>
                          复制
                        </button>
                        <button className="gv-mini-btn" type="button" onClick={() => insertPrompt(snippet.content)}>
                          插入
                        </button>
                        <button className="gv-mini-btn" type="button" onClick={() => exportPromptTemplate(snippet)}>
                          导出模板
                        </button>
                        {variables.length > 0 ? (
                          <button
                            className={`gv-mini-btn ${variablePanelOpen ? "gv-mini-btn-active" : ""}`}
                            type="button"
                            onClick={() => {
                              setPromptVariableOpenId((previous) => (previous === snippet.id ? "" : snippet.id));
                            }}
                          >
                            变量({variables.length})
                          </button>
                        ) : null}
                        <button className="gv-mini-btn" type="button" onClick={() => editPrompt(snippet)}>
                          编辑
                        </button>
                        <button className="gv-mini-btn gv-danger-btn" type="button" onClick={() => deletePrompt(snippet.id)}>
                          删除
                        </button>
                      </div>

                      {variablePanelOpen ? (
                        <div className="gv-variable-panel">
                          <div className="gv-variable-grid">
                            {variables.map((variable) => (
                              <label className="gv-variable-item" key={`${snippet.id}_${variable}`}>
                                <span>{variable}</span>
                                <input
                                  className="gv-input"
                                  type="text"
                                  value={variableValues[variable] ?? ""}
                                  placeholder={`填写 ${variable}`}
                                  onChange={(event) => setPromptVariableValue(snippet.id, variable, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                          <div className="gv-preset-panel">
                            <div className="gv-preset-head">变量预设</div>
                            {snippet.variablePresets.length === 0 ? (
                              <p className="gv-inline-empty">暂无预设，填写变量后可保存为预设。</p>
                            ) : (
                              <div className="gv-preset-list">
                                {snippet.variablePresets.map((preset) => (
                                  <div className="gv-preset-item" key={preset.id}>
                                    <button
                                      className="gv-mini-btn gv-mini-btn-subtle"
                                      type="button"
                                      onClick={() => applyPromptVariablePreset(snippet.id, preset.id)}
                                    >
                                      套用：{preset.name}
                                    </button>
                                    <button
                                      className="gv-mini-btn gv-danger-btn"
                                      type="button"
                                      onClick={() => removePromptVariablePreset(snippet.id, preset.id)}
                                    >
                                      删除
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="gv-form-row gv-preset-create-row">
                              <input
                                className="gv-input"
                                type="text"
                                value={promptPresetNameDraftById[snippet.id] ?? ""}
                                placeholder="预设名称（可选）"
                                onChange={(event) =>
                                  setPromptPresetNameDraftById((previous) => ({
                                    ...previous,
                                    [snippet.id]: event.target.value
                                  }))
                                }
                              />
                              <button className="gv-mini-btn" type="button" onClick={() => savePromptVariablePreset(snippet)}>
                                保存预设
                              </button>
                            </div>
                          </div>
                          <div className="gv-btn-row">
                            <button className="gv-mini-btn" type="button" onClick={() => insertPromptWithVariables(snippet)}>
                              填充并插入
                            </button>
                            <button
                              className="gv-mini-btn"
                              type="button"
                              onClick={() =>
                                setPromptVariableValues((previous) => ({
                                  ...previous,
                                  [snippet.id]: {}
                                }))
                              }
                            >
                              清空变量值
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
            </>
          ) : null}

          {activeView === "guide" ? (
            <>
          <section className="gv-section gv-section-highlight">
            <h2>快速上手（1 分钟）</h2>
            <ol className="gv-guide-list">
              <li>打开 ChatGPT 任意页面后，右侧会出现 GPT Voyager 侧边栏入口。</li>
              <li>先在“会话工作台”点一次“重新扫描”，建立本地会话索引。</li>
              <li>通过搜索、文件夹、标签筛选找到会话，点击标题可直接打开。</li>
              <li>在“提示词库”保存常用模板，支持复制、插入、变量填充与批量导出。</li>
              <li>页面选中文本后会出现“引用回复”按钮，可一键带引用插入输入框。</li>
              <li>在“设置中心”按你的习惯调整扫描、导出格式和快捷键。</li>
            </ol>
          </section>

          <section className="gv-section">
            <h2>功能地图</h2>
            <div className="gv-guide-grid">
              <article className="gv-guide-card">
                <h3>会话工作台</h3>
                <p>会话搜索、星标、备注、分类筛选、批量操作、时间线跳转与标签高亮标注、公式复制与定位。</p>
              </article>
              <article className="gv-guide-card">
                <h3>提示词库</h3>
                <p>模板增删改查、标签筛选、变量模板（{"{{变量}}"}）填充、变量预设与共享模板导入导出。</p>
              </article>
              <article className="gv-guide-card">
                <h3>设置中心</h3>
                <p>自动扫描、导出格式、快捷键、聊天区宽度、点击公式复制开关与 JSON 备份恢复。</p>
              </article>
              <article className="gv-guide-card">
                <h3>导出能力</h3>
                <p>当前会话支持导出 Markdown / HTML / PDF（含图片），公式会尽量保留 LaTeX 可用形式。</p>
              </article>
            </div>
          </section>

          <section className="gv-section">
            <h2>快捷键速查</h2>
            <div className="gv-shortcut-list">
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + K</code>
                <span>展开/收起侧边栏</span>
              </div>
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + R</code>
                <span>重新扫描会话列表</span>
              </div>
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + E</code>
                <span>快速导出当前会话（按默认格式）</span>
              </div>
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + B</code>
                <span>全选当前筛选会话（批量）</span>
              </div>
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + N</code>
                <span>清空批量选择</span>
              </div>
              <div className="gv-shortcut-item">
                <code className="gv-kbd">Ctrl/⌘ + Shift + Z</code>
                <span>撤销上一次批量操作</span>
              </div>
            </div>
          </section>

          <section className="gv-section">
            <h2>常见问题</h2>
            <div className="gv-guide-faq">
              <article className="gv-guide-card">
                <h3>为什么提示词插入失败？</h3>
                <p>先确认当前页面焦点在 ChatGPT 对话页，且输入框已经渲染完成；必要时重新扫描后再试。</p>
              </article>
              <article className="gv-guide-card">
                <h3>为什么看不到会话？</h3>
                <p>ChatGPT 左侧会话列表需要先加载到页面。向下滚动列表后再点“重新扫描”。</p>
              </article>
              <article className="gv-guide-card">
                <h3>如何避免误操作批量修改？</h3>
                <p>先在筛选条件下预览结果，再执行批量动作。若误操作，可用“撤销上一次批量操作”。</p>
              </article>
            </div>
          </section>
            </>
          ) : null}

          {activeView === "settings" ? (
            <>
          <section className="gv-section">
            <h2>设置中心</h2>
            <div className="gv-settings-grid">
              <label className="gv-setting-item">
                <span>自动扫描会话</span>
                <input
                  type="checkbox"
                  checked={settings.autoScanEnabled}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      autoScanEnabled: event.target.checked
                    }))
                  }
                />
              </label>

              <label className="gv-setting-item">
                <span>扫描间隔（秒）</span>
                <VoyagerSelect
                  value={String(settings.scanIntervalSec)}
                  options={SCAN_INTERVAL_OPTIONS}
                  onChange={(nextValue) =>
                    setSettings((previous) => ({
                      ...previous,
                      scanIntervalSec: Number(nextValue)
                    }))
                  }
                  ariaLabel="自动扫描间隔"
                />
              </label>

              <label className="gv-setting-item">
                <span>提示词插入模式</span>
                <VoyagerSelect
                  value={settings.promptInsertMode}
                  options={PROMPT_INSERT_MODE_OPTIONS}
                  onChange={(nextValue) =>
                    setSettings((previous) => ({
                      ...previous,
                      promptInsertMode: nextValue
                    }))
                  }
                  ariaLabel="提示词插入模式"
                />
              </label>

              <label className="gv-setting-item">
                <span>默认导出格式</span>
                <VoyagerSelect
                  value={settings.defaultExportFormat}
                  options={DEFAULT_EXPORT_FORMAT_OPTIONS}
                  onChange={(nextValue) =>
                    setSettings((previous) => ({
                      ...previous,
                      defaultExportFormat: nextValue
                    }))
                  }
                  ariaLabel="默认导出格式"
                />
              </label>

              <label className="gv-setting-item">
                <span>启用快捷键（K/R/E/B/N/Z）</span>
                <input
                  type="checkbox"
                  checked={settings.enableShortcuts}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      enableShortcuts: event.target.checked
                    }))
                  }
                />
              </label>

              <label className="gv-setting-item">
                <span>点击页面公式自动复制（Word 优先，失败回退 LaTeX）</span>
                <input
                  type="checkbox"
                  checked={settings.formulaClickCopyEnabled}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      formulaClickCopyEnabled: event.target.checked
                    }))
                  }
                />
              </label>

              <label className="gv-setting-item">
                <span>选中文本一键引用回复</span>
                <input
                  type="checkbox"
                  checked={settings.quoteReplyEnabled}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      quoteReplyEnabled: event.target.checked
                    }))
                  }
                />
              </label>

              <label className="gv-setting-item">
                <span>账户隔离模式（按 ChatGPT 账号隔离索引/提示词/收藏）</span>
                <input
                  type="checkbox"
                  checked={settings.accountIsolationEnabled}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      accountIsolationEnabled: event.target.checked
                    }))
                  }
                />
              </label>

              <div className="gv-setting-item gv-setting-item-stack">
                <span>账户隔离手动标识（可选）</span>
                <input
                  className="gv-input"
                  type="text"
                  value={settings.accountIsolationManualScope}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      accountIsolationManualScope: event.target.value
                    }))
                  }
                  placeholder="例如：work_email 或 school_account"
                />
                <span className="gv-inline-empty">{`自动识别：${detectedAccountScope.label}（${detectedAccountScope.source}）`}</span>
                <span className="gv-inline-empty">{`当前数据作用域：${activeStorageScope}`}</span>
              </div>

              <div className="gv-setting-item gv-setting-item-stack">
                <span>{`聊天区宽度（${settings.chatContentWidthPercent}% 视口）`}</span>
                <input
                  className="gv-range"
                  type="range"
                  min={64}
                  max={96}
                  step={1}
                  value={settings.chatContentWidthPercent}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      chatContentWidthPercent: clampChatContentWidthPercent(Number(event.target.value))
                    }))
                  }
                />
                <div className="gv-btn-row">
                  <button
                    className="gv-mini-btn gv-mini-btn-subtle"
                    type="button"
                    onClick={() =>
                      setSettings((previous) => ({
                        ...previous,
                        chatContentWidthPercent: 78
                      }))
                    }
                  >
                    恢复默认
                  </button>
                  <button
                    className="gv-mini-btn gv-mini-btn-subtle"
                    type="button"
                    onClick={() =>
                      setSettings((previous) => ({
                        ...previous,
                        chatContentWidthPercent: 90
                      }))
                    }
                  >
                    一键加宽
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="gv-section">
            <h2>本地数据备份</h2>
            <p className="gv-metric">支持将当前索引、分类、提示词、公式收藏、图表收藏、时间线标注和设置导出为 JSON，并可在本地恢复。</p>
            <div className="gv-actions-inline">
              <button className="gv-mini-btn" type="button" onClick={exportJsonBackup}>
                导出 JSON 备份
              </button>
              <button className="gv-mini-btn" type="button" onClick={openImportBackupPicker}>
                导入 JSON 备份
              </button>
              <input
                ref={backupFileInputRef}
                className="gv-hidden-input"
                type="file"
                accept=".json,application/json"
                onChange={importJsonBackup}
              />
            </div>
            {backupStatus ? <p className="gv-export-status">{backupStatus}</p> : null}
          </section>

          <section className="gv-section">
            <h2>迭代路线图</h2>
            <ul>
              <li>P1：时间线标注快捷键</li>
              <li>P1：会话索引排序扩展（星标优先 / 备注优先）</li>
              <li>P1：提示词库拖拽排序</li>
            </ul>
          </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
