export type FormulaSource = "katex" | "mathjax";
export type FormulaDisplayMode = "inline" | "display";

export type ConversationFormulaItem = {
  id: string;
  tex: string;
  mathml?: string;
  source: FormulaSource;
  displayMode: FormulaDisplayMode;
  messageIndex: number;
};

export type ConversationFormulaNode = {
  item: ConversationFormulaItem;
  element: HTMLElement;
};

export type ExtractedFormula = {
  tex: string;
  mathml?: string;
  source: FormulaSource;
  displayMode: FormulaDisplayMode;
  element: HTMLElement;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function createFormulaId(
  source: FormulaSource,
  messageIndex: number,
  formulaIndex: number
): string {
  return `formula_${source}_${messageIndex}_${formulaIndex}`;
}

function normalizeMathml(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function extractMathmlFromNode(root: HTMLElement): string {
  const mathNode = root.querySelector<HTMLElement>(".katex-mathml math, mjx-assistive-mml math, math");
  return normalizeMathml(mathNode?.outerHTML);
}

function readFromKatexNode(katexNode: HTMLElement): ExtractedFormula | null {
  const annotation = katexNode.querySelector("annotation");
  const tex = normalizeText(annotation?.textContent);
  if (!tex) {
    return null;
  }
  return {
    tex,
    mathml: extractMathmlFromNode(katexNode) || undefined,
    source: "katex",
    displayMode: katexNode.closest(".katex-display") ? "display" : "inline",
    element: katexNode
  };
}

function readFromMathJaxNode(mathJaxNode: HTMLElement): ExtractedFormula | null {
  const annotation = mathJaxNode.querySelector("annotation");
  const tex = normalizeText(annotation?.textContent);
  if (!tex) {
    return null;
  }
  return {
    tex,
    mathml: extractMathmlFromNode(mathJaxNode) || undefined,
    source: "mathjax",
    displayMode: mathJaxNode.getAttribute("display") === "true" ? "display" : "inline",
    element: mathJaxNode
  };
}

export function extractFormulaFromTarget(target: EventTarget | null): ExtractedFormula | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const katexNode = target.closest<HTMLElement>(".katex");
  if (katexNode) {
    return readFromKatexNode(katexNode);
  }

  const mathJaxNode = target.closest<HTMLElement>("mjx-container");
  if (mathJaxNode) {
    return readFromMathJaxNode(mathJaxNode);
  }

  return null;
}

export function collectConversationFormulaNodes(doc: Document = document): ConversationFormulaNode[] {
  const messageNodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  const result: ConversationFormulaNode[] = [];

  for (let messageIndex = 0; messageIndex < messageNodes.length; messageIndex += 1) {
    const messageNode = messageNodes[messageIndex];
    let formulaIndex = 0;

    const katexNodes = Array.from(messageNode.querySelectorAll<HTMLElement>(".katex"));
    for (const katexNode of katexNodes) {
      const extracted = readFromKatexNode(katexNode);
      if (!extracted) {
        continue;
      }
      result.push({
        item: {
          id: createFormulaId("katex", messageIndex + 1, formulaIndex + 1),
          tex: extracted.tex,
          mathml: extracted.mathml,
          source: extracted.source,
          displayMode: extracted.displayMode,
          messageIndex: messageIndex + 1
        },
        element: extracted.element
      });
      formulaIndex += 1;
    }

    const mathJaxNodes = Array.from(messageNode.querySelectorAll<HTMLElement>("mjx-container"));
    for (const mathJaxNode of mathJaxNodes) {
      const extracted = readFromMathJaxNode(mathJaxNode);
      if (!extracted) {
        continue;
      }
      result.push({
        item: {
          id: createFormulaId("mathjax", messageIndex + 1, formulaIndex + 1),
          tex: extracted.tex,
          mathml: extracted.mathml,
          source: extracted.source,
          displayMode: extracted.displayMode,
          messageIndex: messageIndex + 1
        },
        element: extracted.element
      });
      formulaIndex += 1;
    }
  }

  return result;
}
