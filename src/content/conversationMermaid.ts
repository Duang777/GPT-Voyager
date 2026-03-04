export type ConversationMermaidItem = {
  id: string;
  code: string;
  preview: string;
  messageIndex: number;
};

export type ConversationMermaidNode = {
  item: ConversationMermaidItem;
  element: HTMLElement;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();
}

function createMermaidId(messageIndex: number, blockIndex: number): string {
  return `mermaid_${messageIndex}_${blockIndex}`;
}

function getPreview(code: string): string {
  const firstLine = code.split("\n")[0]?.trim() ?? "";
  if (!firstLine) {
    return "(空图表)";
  }
  return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine;
}

export function collectConversationMermaidNodes(doc: Document = document): ConversationMermaidNode[] {
  const messageNodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  const result: ConversationMermaidNode[] = [];

  for (let messageIndex = 0; messageIndex < messageNodes.length; messageIndex += 1) {
    const messageNode = messageNodes[messageIndex];
    let blockIndex = 0;
    const codeNodes = Array.from(
      messageNode.querySelectorAll<HTMLElement>("pre code.language-mermaid, pre code[class*='language-mermaid']")
    );

    for (const codeNode of codeNodes) {
      const code = normalizeText(codeNode.textContent);
      if (!code) {
        continue;
      }
      blockIndex += 1;
      result.push({
        item: {
          id: createMermaidId(messageIndex + 1, blockIndex),
          code,
          preview: getPreview(code),
          messageIndex: messageIndex + 1
        },
        element: messageNode
      });
    }
  }

  return result;
}
