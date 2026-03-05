import TurndownService from "turndown";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export type ConversationMessage = {
  role: string;
  content: string;
};

type ConversationHtmlMessage = {
  role: string;
  html: string;
};

export type ConversationExportResult =
  | { ok: true; fileName: string; messageCount: number; mode?: "download" | "print_fallback"; warning?: string }
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

function isLikelyVisibleMessageNode(node: HTMLElement): boolean {
  if (node.closest('[aria-hidden="true"]')) {
    return false;
  }
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return node.getClientRects().length > 0;
}

function toMessageSignature(role: string, content: string): string {
  const normalized = normalizeText(content).replace(/\s+/g, " ").toLowerCase();
  return `${role}::${normalized.slice(0, 400)}::${normalized.length}`;
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
  let lastSignature = "";
  for (const node of roleNodes) {
    if (!isLikelyVisibleMessageNode(node)) {
      continue;
    }
    const role = normalizeText(node.getAttribute("data-message-author-role")) || "unknown";
    const content = extractMessageMarkdown(node);
    if (!content) {
      continue;
    }
    const signature = toMessageSignature(role, content);
    if (signature === lastSignature) {
      continue;
    }
    lastSignature = signature;
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
  let lastSignature = "";
  for (const node of roleNodes) {
    if (!isLikelyVisibleMessageNode(node)) {
      continue;
    }
    const role = normalizeText(node.getAttribute("data-message-author-role")) || "unknown";
    const html = extractMessageHtml(node);
    if (!html) {
      continue;
    }
    const signature = toMessageSignature(role, (node.textContent ?? "").trim());
    if (signature === lastSignature) {
      continue;
    }
    lastSignature = signature;
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
    .msg-content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid #e5e8ef;
      box-sizing: border-box;
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

function buildConversationPdfPrintDocument(title: string, url: string, messages: ConversationHtmlMessage[]): string {
  const html = buildConversationHtml(title, url, messages);
  const printStyle = `
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .container {
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      a {
        color: #111 !important;
        text-decoration: none !important;
      }
    }
  </style>`;
  const printScript = `
  <script>
    (function () {
      function waitForImages() {
        var images = Array.prototype.slice.call(document.images || []);
        if (images.length === 0) {
          return Promise.resolve();
        }
        return Promise.all(images.map(function (img) {
          if (img.complete) {
            return Promise.resolve();
          }
          return new Promise(function (resolve) {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        }));
      }
      window.addEventListener("load", function () {
        waitForImages().finally(function () {
          setTimeout(function () {
            try {
              window.focus();
              window.print();
            } catch (err) {
              // ignore
            }
          }, 180);
        });
      });
    })();
  </script>`;

  return html.replace("</head>", `${printStyle}</head>`).replace("</body>", `${printScript}</body>`);
}

function buildPdfContainerHtml(title: string, url: string, messages: ConversationHtmlMessage[]): string {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const body = messages
    .map((message) => {
      return `
<section class="gv-pdf-msg gv-pdf-msg-${escapeHtml(message.role)}">
  <h2>${escapeHtml(roleLabel(message.role))}</h2>
  <div class="gv-pdf-msg-content">${message.html}</div>
</section>`;
    })
    .join("\n");

  return `
<main class="gv-pdf-container">
  <h1>${escapeHtml(title)}</h1>
  <ul class="gv-pdf-meta">
    <li>导出时间：${escapeHtml(exportedAt)}</li>
    <li>会话链接：<a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>
    <li>消息数量：${messages.length}</li>
  </ul>
  ${body}
</main>`;
}

const PDF_CAPTURE_STYLE = `
.gv-pdf-capture-root {
  position: fixed;
  left: 0;
  top: 0;
  width: 794px;
  opacity: 1;
  pointer-events: none;
  z-index: -2147483647;
  contain: layout style paint;
}

.gv-pdf-capture-root .gv-pdf-container {
  width: 794px;
  box-sizing: border-box;
  margin: 0;
  padding: 26px 28px;
  color: #111;
  background: #fff;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.65;
}

.gv-pdf-capture-root h1 {
  margin: 0 0 10px;
  font-size: 28px;
  line-height: 1.35;
}

.gv-pdf-capture-root .gv-pdf-meta {
  margin: 0 0 18px;
  padding-left: 20px;
  color: #3d4c6a;
  font-size: 14px;
}

.gv-pdf-capture-root .gv-pdf-msg {
  border-top: 1px solid #e8edf6;
  padding-top: 16px;
  margin-top: 16px;
}

.gv-pdf-capture-root .gv-pdf-msg h2 {
  margin: 0 0 10px;
  font-size: 17px;
}

.gv-pdf-capture-root .gv-pdf-msg-content > :first-child {
  margin-top: 0;
}

.gv-pdf-capture-root .gv-pdf-msg-content > :last-child {
  margin-bottom: 0;
}

.gv-pdf-capture-root .gv-pdf-msg-content pre {
  background: #f4f6fa;
  border: 1px solid #e0e6f2;
  border-radius: 10px;
  padding: 10px 12px;
  overflow: auto;
  white-space: pre-wrap;
}

.gv-pdf-capture-root .gv-pdf-msg-content code {
  font-family: "JetBrains Mono", "Consolas", "Courier New", monospace;
  font-size: 0.92em;
}

.gv-pdf-capture-root .gv-pdf-msg-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.gv-pdf-capture-root .gv-pdf-msg-content th,
.gv-pdf-capture-root .gv-pdf-msg-content td {
  border: 1px solid #d9e1ef;
  padding: 6px 8px;
  text-align: left;
}

.gv-pdf-capture-root .gv-pdf-msg-content .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 0;
}

.gv-pdf-capture-root .gv-pdf-msg-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #e5e8ef;
  box-sizing: border-box;
}

.gv-pdf-capture-root a {
  color: #0f172a;
  text-decoration: none;
}
`;

const KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
const KATEX_ASSET_BASE_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
let pdfKatexStylePromise: Promise<void> | null = null;

function absolutizeKatexCssUrls(cssText: string): string {
  return cssText.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)/g, (_matched, quote: string, path: string) => {
    return `url(${quote}${KATEX_ASSET_BASE_URL}${path}${quote})`;
  });
}

async function ensurePdfKatexStyles(): Promise<void> {
  if (document.querySelector('style[data-gv-pdf-katex="1"]')) {
    return;
  }
  if (!pdfKatexStylePromise) {
    pdfKatexStylePromise = (async () => {
      try {
        const response = await fetch(KATEX_CSS_URL, { cache: "force-cache" });
        if (!response.ok) {
          return;
        }
        const cssText = await response.text();
        const style = document.createElement("style");
        style.setAttribute("data-gv-pdf-katex", "1");
        style.textContent = absolutizeKatexCssUrls(cssText);
        document.head.appendChild(style);
      } catch {
        // ignore stylesheet loading failure and fallback to existing page styles
      }
    })();
  }
  await pdfKatexStylePromise;
}

function waitForImagesInNode(root: HTMLElement, timeoutMs: number = 12000): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  if (images.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let pending = 0;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    const finishOne = () => {
      pending -= 1;
      if (pending <= 0) {
        done();
      }
    };

    const timer = window.setTimeout(done, timeoutMs);
    const clear = () => {
      window.clearTimeout(timer);
      done();
    };

    for (const image of images) {
      if (image.complete) {
        continue;
      }
      pending += 1;
      const onDone = () => {
        image.removeEventListener("load", onDone);
        image.removeEventListener("error", onDone);
        finishOne();
      };
      image.addEventListener("load", onDone, { once: true });
      image.addEventListener("error", onDone, { once: true });
    }

    if (pending === 0) {
      clear();
    }
  });
}

async function buildPdfFromMessages(
  title: string,
  url: string,
  messages: ConversationHtmlMessage[]
): Promise<{ fileName: string; messageCount: number }> {
  await ensurePdfKatexStyles();

  const root = document.createElement("div");
  root.className = "gv-pdf-capture-root";
  root.innerHTML = `<style>${PDF_CAPTURE_STYLE}</style>${buildPdfContainerHtml(title, url, messages)}`;
  document.body.appendChild(root);

  const container = root.querySelector<HTMLElement>(".gv-pdf-container");
  if (!container) {
    root.remove();
    throw new Error("PDF 导出容器构建失败");
  }

  try {
    if (container.scrollHeight > 22000) {
      throw new Error("会话内容过长，已切换打印模式导出");
    }

    const fontsReady = document.fonts?.ready?.catch(() => undefined);
    await Promise.all([waitForImagesInNode(container), fontsReady]);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
      compress: false
    });

    const htmlMethod = (pdf as jsPDF & { html?: unknown }).html;
    if (typeof htmlMethod === "function") {
      const renderScale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      await new Promise<void>((resolve, reject) => {
        try {
          (htmlMethod as (source: HTMLElement, options: Record<string, unknown>) => void)(container, {
            callback: () => resolve(),
            margin: [24, 24, 24, 24],
            autoPaging: "text",
            windowWidth: container.scrollWidth,
            html2canvas: {
              backgroundColor: "#ffffff",
              useCORS: true,
              allowTaint: false,
              foreignObjectRendering: false,
              scale: renderScale,
              imageTimeout: 15000,
              logging: false
            }
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("PDF html 渲染失败"));
        }
      });
    } else {
      const scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        scale,
        imageTimeout: 15000,
        logging: false
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const pxPerPt = canvas.width / printableWidth;
      const pageHeightPx = Math.max(1, Math.floor(printableHeight * pxPerPt));

      let pageStartPx = 0;
      let pageIndex = 0;
      while (pageStartPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - pageStartPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("PDF 分页画布构建失败");
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, pageStartPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        const imageData = pageCanvas.toDataURL("image/png");
        const sliceHeightPt = sliceHeightPx / pxPerPt;
        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(imageData, "PNG", margin, margin, printableWidth, sliceHeightPt);

        pageStartPx += sliceHeightPx;
        pageIndex += 1;
      }
    }

    const fileName = `${sanitizeFileName(title)}.pdf`;
    pdf.save(fileName);
    return {
      fileName,
      messageCount: messages.length
    };
  } finally {
    root.remove();
  }
}

function openHtmlInNewTab(html: string): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, "_blank");
  if (!opened) {
    URL.revokeObjectURL(objectUrl);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
  return true;
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

export async function exportCurrentConversationToPdf(): Promise<ConversationExportResult> {
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
  const fileName = `${sanitizeFileName(title)}.pdf`;
  try {
    const result = await buildPdfFromMessages(title, url, messages);
    return {
      ok: true,
      fileName: result.fileName,
      messageCount: result.messageCount,
      mode: "download"
    };
  } catch (error) {
    const rawReason = error instanceof Error ? error.message : "未知错误";
    const printable = buildConversationPdfPrintDocument(title, url, messages);
    const opened = openHtmlInNewTab(printable);
    if (opened) {
      return {
        ok: true,
        fileName,
        messageCount: messages.length,
        mode: "print_fallback",
        warning: `直接下载失败，已打开打印页（${rawReason}）`
      };
    }
    return { ok: false, reason: `PDF 导出失败：${rawReason}` };
  }
}
