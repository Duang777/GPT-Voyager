import TurndownService from "turndown";

export type ConversationMessage = {
  role: string;
  content: string;
};

type ConversationHtmlMessage = {
  role: string;
  html: string;
};

export type ConversationExportResult =
  | { ok: true; fileName: string; messageCount: number }
  | { ok: false; reason: string };

const markdownConverter = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  bulletListMarker: "-"
});

markdownConverter.addRule("fencedCodeBlock", {
  filter: (node) => {
    return node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE";
  },
  replacement: (_content, node) => {
    const pre = node as HTMLPreElement;
    const code = pre.querySelector("code");
    const className = code?.className ?? "";
    const language = className.match(/language-([a-zA-Z0-9_-]+)/)?.[1] ?? "";
    const codeText = (code?.textContent ?? pre.textContent ?? "").replace(/\n+$/, "");
    return `\n\n\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
  }
});

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  const compact = base.replace(/\s+/g, "_");
  if (!compact) {
    return "chatgpt-conversation";
  }
  return compact.slice(0, 80);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentConversationTitle(): string {
  const activeLink = document.querySelector<HTMLAnchorElement>('a[href^="/c/"][aria-current="page"]');
  if (activeLink) {
    const fromLink = normalizeText(activeLink.textContent);
    if (fromLink) {
      return fromLink;
    }
  }

  const titleFromDocument = normalizeText(document.title).replace(/\s*-\s*ChatGPT\s*$/i, "");
  if (titleFromDocument) {
    return titleFromDocument;
  }

  return "未命名会话";
}

function getCurrentConversationUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function roleLabel(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized === "user") {
    return "用户";
  }
  if (normalized === "assistant") {
    return "助手";
  }
  if (normalized === "tool") {
    return "工具";
  }
  return role;
}

function pickMessageContentRoot(node: HTMLElement): HTMLElement {
  const candidates = [
    ".markdown",
    "[data-message-content]",
    ".whitespace-pre-wrap",
    '[class*="prose"]'
  ];

  for (const selector of candidates) {
    const found = node.querySelector<HTMLElement>(selector);
    if (found) {
      return found;
    }
  }

  return node;
}

function cleanupMessageClone(root: HTMLElement): void {
  const removableSelectors = [
    "button",
    "textarea",
    "input",
    "select",
    "form",
    "svg",
    "style",
    "script"
  ];
  for (const selector of removableSelectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      node.remove();
    }
  }
}

function cloneMessageContent(node: HTMLElement): HTMLElement {
  const contentRoot = pickMessageContentRoot(node);
  const clone = contentRoot.cloneNode(true) as HTMLElement;
  cleanupMessageClone(clone);
  return clone;
}

function replaceMathWithTokens(root: HTMLElement): Map<string, string> {
  const tokenMap = new Map<string, string>();
  let index = 0;

  const toToken = (tex: string, isDisplay: boolean): string => {
    const token = `GVMATHTOKEN${index++}END`;
    const wrapped = isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
    tokenMap.set(token, wrapped);
    return token;
  };

  const katexNodes = Array.from(root.querySelectorAll<HTMLElement>(".katex"));
  for (const node of katexNodes) {
    const annotation = node.querySelector("annotation");
    const tex = normalizeText(annotation?.textContent);
    if (!tex) {
      continue;
    }
    const display = Boolean(node.closest(".katex-display"));
    const token = toToken(tex, display);
    node.replaceWith(root.ownerDocument.createTextNode(token));
  }

  const mathJaxNodes = Array.from(root.querySelectorAll<HTMLElement>("mjx-container"));
  for (const node of mathJaxNodes) {
    const annotation = node.querySelector("annotation");
    const tex = normalizeText(annotation?.textContent);
    if (!tex) {
      continue;
    }
    const display = node.getAttribute("display") === "true";
    const token = toToken(tex, display);
    node.replaceWith(root.ownerDocument.createTextNode(token));
  }

  return tokenMap;
}

function restoreTokens(markdown: string, tokenMap: Map<string, string>): string {
  let output = markdown;
  for (const [token, value] of tokenMap.entries()) {
    output = output.split(token).join(value);
  }
  return output;
}

function splitByCodeBlocks(input: string): string[] {
  return input.split(/(```[\s\S]*?```)/g);
}

function normalizeLatexDelimiters(segment: string): string {
  const normalizeMathBody = (value: string): string => {
    return value
      .replace(/\\\\(?=[A-Za-z{}\[\]()])/g, "\\")
      .replace(/\\_/g, "_")
      .trim();
  };

  let output = segment;
  output = output.replace(/\\{1,2}\[((?:[\s\S]*?)?)\\{1,2}\]/g, (_matched, expr: string) => {
    const body = normalizeMathBody(expr);
    if (!body) {
      return "";
    }
    return `\n\n$$\n${body}\n$$\n\n`;
  });

  output = output.replace(/\\{1,2}\(((?:[\s\S]*?)?)\\{1,2}\)/g, (_matched, expr: string) => {
    const body = normalizeMathBody(expr);
    if (!body) {
      return "";
    }
    return `$${body}$`;
  });
  return output;
}

function normalizeMarkdownOutput(markdown: string): string {
  const chunks = splitByCodeBlocks(markdown);
  const transformed = chunks.map((chunk, index) => {
    if (index % 2 === 1) {
      return chunk;
    }
    return normalizeLatexDelimiters(chunk);
  });

  return transformed
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractMessageMarkdown(node: HTMLElement): string {
  const clone = cloneMessageContent(node);
  const tokenMap = replaceMathWithTokens(clone);
  const rawMarkdown = markdownConverter.turndown(clone.innerHTML);
  const restored = restoreTokens(rawMarkdown, tokenMap);
  return normalizeMarkdownOutput(restored);
}

function extractMessageHtml(node: HTMLElement): string {
  const clone = cloneMessageContent(node);
  return clone.innerHTML.trim();
}

export function extractMessageMarkdownFromNode(node: HTMLElement): string {
  return extractMessageMarkdown(node);
}

export function extractMessageHtmlFromNode(node: HTMLElement): string {
  return extractMessageHtml(node);
}

export function collectConversationMessages(doc: Document = document): ConversationMessage[] {
  const roleNodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  if (roleNodes.length === 0) {
    return [];
  }

  const result: ConversationMessage[] = [];
  for (const node of roleNodes) {
    const role = normalizeText(node.getAttribute("data-message-author-role")) || "unknown";
    const content = extractMessageMarkdown(node);
    if (!content) {
      continue;
    }
    result.push({ role, content });
  }

  return result;
}

function collectConversationHtmlMessages(doc: Document = document): ConversationHtmlMessage[] {
  const roleNodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  if (roleNodes.length === 0) {
    return [];
  }

  const result: ConversationHtmlMessage[] = [];
  for (const node of roleNodes) {
    const role = normalizeText(node.getAttribute("data-message-author-role")) || "unknown";
    const html = extractMessageHtml(node);
    if (!html) {
      continue;
    }
    result.push({ role, html });
  }

  return result;
}

export function buildConversationMarkdown(title: string, url: string, messages: ConversationMessage[]): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- 导出时间：${exportedAt}`);
  lines.push(`- 会话链接：${url}`);
  lines.push(`- 消息数量：${messages.length}`);
  lines.push("");

  for (const message of messages) {
    lines.push(`## ${roleLabel(message.role)}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
  }

  return lines.join("\n");
}

function buildConversationHtml(title: string, url: string, messages: ConversationHtmlMessage[]): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const body = messages
    .map((message) => {
      return `
<section class="msg msg-${escapeHtml(message.role)}">
  <h2>${escapeHtml(roleLabel(message.role))}</h2>
  <div class="msg-content">${message.html}</div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
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
    .msg {
      border-top: 1px solid #e8edf6;
      padding-top: 16px;
      margin-top: 16px;
    }
    .msg h2 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.35;
    }
    .msg-content pre {
      overflow-x: auto;
      background: #0e1420;
      color: #e7ecf9;
      padding: 10px 12px;
      border-radius: 8px;
    }
    .msg-content code {
      font-family: "Consolas", "SFMono-Regular", Menlo, monospace;
      font-size: 0.95em;
    }
    .msg-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    .msg-content th, .msg-content td {
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
    <h1>${escapeHtml(title)}</h1>
    <ul class="meta">
      <li>导出时间：${escapeHtml(exportedAt)}</li>
      <li>会话链接：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>
      <li>消息数量：${messages.length}</li>
    </ul>
    ${body}
  </main>
</body>
</html>`;
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

export function exportCurrentConversationToMarkdown(): ConversationExportResult {
  const matched = window.location.pathname.match(/^\/c\/([a-zA-Z0-9-]+)/);
  if (!matched) {
    return { ok: false, reason: "当前页面不是会话详情页" };
  }

  const messages = collectConversationMessages(document);
  if (messages.length === 0) {
    return { ok: false, reason: "未检测到可导出的会话内容" };
  }

  const title = getCurrentConversationTitle();
  const url = getCurrentConversationUrl();
  const markdown = buildConversationMarkdown(title, url, messages);
  const fileName = `${sanitizeFileName(title)}.md`;
  downloadTextFile(fileName, markdown, "text/markdown;charset=utf-8");

  return {
    ok: true,
    fileName,
    messageCount: messages.length
  };
}

export function exportCurrentConversationToHtml(): ConversationExportResult {
  const matched = window.location.pathname.match(/^\/c\/([a-zA-Z0-9-]+)/);
  if (!matched) {
    return { ok: false, reason: "当前页面不是会话详情页" };
  }

  const messages = collectConversationHtmlMessages(document);
  if (messages.length === 0) {
    return { ok: false, reason: "未检测到可导出的会话内容" };
  }

  const title = getCurrentConversationTitle();
  const url = getCurrentConversationUrl();
  const html = buildConversationHtml(title, url, messages);
  const fileName = `${sanitizeFileName(title)}.html`;
  downloadTextFile(fileName, html, "text/html;charset=utf-8");

  return {
    ok: true,
    fileName,
    messageCount: messages.length
  };
}
