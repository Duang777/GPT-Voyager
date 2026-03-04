import mermaid from "mermaid";

let initialized = false;
let renderSeed = 0;

function ensureInit(): void {
  if (initialized) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    suppressErrorRendering: true
  });
  initialized = true;
}

function nextRenderId(): string {
  renderSeed += 1;
  return `gv_mermaid_${Date.now()}_${renderSeed}`;
}

export type MermaidRenderResult =
  | { ok: true; svg: string }
  | { ok: false; reason: string };

export async function renderMermaidSvg(code: string): Promise<MermaidRenderResult> {
  const normalized = code.trim();
  if (!normalized) {
    return { ok: false, reason: "图表源码为空" };
  }

  try {
    ensureInit();
    const renderId = nextRenderId();
    const rendered = await mermaid.render(renderId, normalized);
    const svg = rendered.svg?.trim();
    if (!svg) {
      return { ok: false, reason: "未生成 SVG 结果" };
    }
    return { ok: true, svg };
  } catch {
    return { ok: false, reason: "Mermaid 渲染失败，请检查语法" };
  }
}
