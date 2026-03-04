export type TimelineRole = "user" | "assistant" | "tool" | "unknown";

export type ConversationTimelineItem = {
  id: string;
  role: TimelineRole;
  index: number;
  preview: string;
  charCount: number;
};

export type ConversationTimelineNode = {
  item: ConversationTimelineItem;
  element: HTMLElement;
};

export type ObserveTimelineOptions = {
  intervalMs?: number;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function getRole(node: HTMLElement): TimelineRole {
  const role = normalizeText(node.getAttribute("data-message-author-role")).toLowerCase();
  if (role === "user" || role === "assistant" || role === "tool") {
    return role;
  }
  return "unknown";
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

function getPreview(node: HTMLElement): { text: string; charCount: number } {
  const root = pickMessageContentRoot(node);
  const text = normalizeText(root.innerText || root.textContent);
  if (!text) {
    return { text: "(空消息)", charCount: 0 };
  }
  const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text;
  return { text: preview, charCount: text.length };
}

function getNodeId(node: HTMLElement, index: number): string {
  const candidates = [
    node.getAttribute("data-message-id"),
    node.getAttribute("id"),
    node.closest<HTMLElement>("[id]")?.id
  ];
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return `gv_msg_${index + 1}`;
}

export function collectConversationTimelineNodes(doc: Document = document): ConversationTimelineNode[] {
  const roleNodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-message-author-role]"));
  const result: ConversationTimelineNode[] = [];
  const dedup = new Set<string>();

  for (let index = 0; index < roleNodes.length; index += 1) {
    const node = roleNodes[index];
    const role = getRole(node);
    const preview = getPreview(node);
    const rawId = getNodeId(node, index);
    const id = dedup.has(rawId) ? `${rawId}_${index + 1}` : rawId;
    dedup.add(id);

    result.push({
      item: {
        id,
        role,
        index: index + 1,
        preview: preview.text,
        charCount: preview.charCount
      },
      element: node
    });
  }

  return result;
}

export function observeConversationThread(
  listener: () => void,
  options: ObserveTimelineOptions = {}
): () => void {
  if (!document.body) {
    return () => {
      // no-op
    };
  }

  const intervalMs = Math.max(800, options.intervalMs ?? 1400);
  let rafId = 0;

  const trigger = () => {
    if (rafId !== 0) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      listener();
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        trigger();
        return;
      }
      if (mutation.type === "attributes") {
        const target = mutation.target as Element;
        if (target.closest("[data-message-author-role]")) {
          trigger();
          return;
        }
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-message-author-role"]
  });

  const onPopState = () => trigger();
  const onVisibility = () => {
    if (!document.hidden) {
      trigger();
    }
  };

  window.addEventListener("popstate", onPopState);
  document.addEventListener("visibilitychange", onVisibility);
  const backupTimer = window.setInterval(trigger, intervalMs);
  trigger();

  return () => {
    observer.disconnect();
    window.removeEventListener("popstate", onPopState);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(backupTimer);
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
    }
  };
}
