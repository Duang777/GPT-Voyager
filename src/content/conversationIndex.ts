import { buildScopedStorageKey, normalizeStorageScope } from "./storageScope";

export type ConversationEntry = {
  id: string;
  url: string;
  title: string;
  lastSeenAt: number;
};

export type ConversationIndexListener = (visibleConversations: ConversationEntry[]) => void;
export type ObserveConversationOptions = {
  intervalMs?: number;
};

export const CONVERSATION_INDEX_STORAGE_KEY = "gpt_voyager_conversation_index_v1";

const UNKNOWN_TITLE = "未命名会话";
const CONVERSATION_PATH_REGEX = /^\/c\/([a-zA-Z0-9-]+)/;

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function getConversationFromHref(rawHref: string): { id: string; url: string } | null {
  try {
    const url = new URL(rawHref, window.location.origin);
    const matched = url.pathname.match(CONVERSATION_PATH_REGEX);
    if (!matched) {
      return null;
    }
    const id = matched[1];
    return {
      id,
      url: `${url.origin}/c/${id}`
    };
  } catch {
    return null;
  }
}

function getConversationTitle(anchor: HTMLAnchorElement): string {
  const fromAria = normalizeText(anchor.getAttribute("aria-label"));
  if (fromAria) {
    return fromAria;
  }
  const fromTitle = normalizeText(anchor.getAttribute("title"));
  if (fromTitle) {
    return fromTitle;
  }
  const fromText = normalizeText(anchor.textContent);
  if (fromText) {
    return fromText;
  }
  return UNKNOWN_TITLE;
}

function isElementVisible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = window.getComputedStyle(htmlElement);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return htmlElement.getClientRects().length > 0;
}

export function collectVisibleConversations(doc: Document = document): ConversationEntry[] {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const result = new Map<string, ConversationEntry>();
  const now = Date.now();

  for (const anchor of anchors) {
    if (!isElementVisible(anchor)) {
      continue;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    const parsed = getConversationFromHref(href);
    if (!parsed) {
      continue;
    }

    const title = getConversationTitle(anchor);
    const existing = result.get(parsed.id);
    if (!existing) {
      result.set(parsed.id, {
        id: parsed.id,
        url: parsed.url,
        title,
        lastSeenAt: now
      });
      continue;
    }

    const betterTitle = existing.title === UNKNOWN_TITLE && title !== UNKNOWN_TITLE ? title : existing.title;
    result.set(parsed.id, {
      ...existing,
      title: betterTitle,
      lastSeenAt: now
    });
  }

  return Array.from(result.values());
}

export function mergeConversationIndex(
  existing: ConversationEntry[],
  incoming: ConversationEntry[]
): ConversationEntry[] {
  const map = new Map<string, ConversationEntry>();

  for (const item of existing) {
    map.set(item.id, item);
  }

  for (const item of incoming) {
    const previous = map.get(item.id);
    if (!previous) {
      map.set(item.id, item);
      continue;
    }

    const shouldReplaceTitle = previous.title === UNKNOWN_TITLE && item.title !== UNKNOWN_TITLE;
    map.set(item.id, {
      ...previous,
      title: shouldReplaceTitle ? item.title : previous.title,
      url: item.url || previous.url,
      lastSeenAt: Math.max(previous.lastSeenAt, item.lastSeenAt)
    });
  }

  return Array.from(map.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function loadConversationIndex(): Promise<ConversationEntry[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const storageKey = buildScopedStorageKey(CONVERSATION_INDEX_STORAGE_KEY);
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      resolve(sanitizeConversationIndex(result?.[storageKey]));
    });
  });
}

export function sanitizeConversationIndex(raw: unknown): ConversationEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is ConversationEntry => {
      return (
        typeof item?.id === "string" &&
        typeof item?.url === "string" &&
        typeof item?.title === "string" &&
        typeof item?.lastSeenAt === "number"
      );
    })
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function loadConversationIndexByScope(scope?: string): Promise<ConversationEntry[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const normalizedScope = normalizeStorageScope(scope);
  const scopedStorageKey = buildScopedStorageKey(CONVERSATION_INDEX_STORAGE_KEY, normalizedScope);
  if (scopedStorageKey === CONVERSATION_INDEX_STORAGE_KEY) {
    return loadConversationIndex();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([scopedStorageKey, CONVERSATION_INDEX_STORAGE_KEY], (result) => {
      const scopedValue = result?.[scopedStorageKey];
      if (scopedValue !== undefined) {
        resolve(sanitizeConversationIndex(scopedValue));
        return;
      }
      resolve(sanitizeConversationIndex(result?.[CONVERSATION_INDEX_STORAGE_KEY]));
    });
  });
}

export async function saveConversationIndex(entries: ConversationEntry[], scope?: string): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  const storageKey = buildScopedStorageKey(CONVERSATION_INDEX_STORAGE_KEY, scope);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [storageKey]: entries }, () => resolve());
  });
}

export function observeConversationList(
  listener: ConversationIndexListener,
  options: ObserveConversationOptions = {}
): () => void {
  if (!document.body) {
    return () => {
      // No-op cleanup.
    };
  }

  const intervalMs = Math.max(1000, options.intervalMs ?? 5000);

  let rafId = 0;
  const trigger = () => {
    if (rafId !== 0) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      listener(collectVisibleConversations(document));
    });
  };

  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        trigger();
        return;
      }
      if (mutation.type === "attributes") {
        const target = mutation.target as Element;
        if (target.tagName === "A" || target.closest("a[href]")) {
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
    attributeFilter: ["href", "title", "aria-label", "class"]
  });

  const onPopState = () => trigger();
  const onVisibilityChange = () => {
    if (!document.hidden) {
      trigger();
    }
  };

  window.addEventListener("popstate", onPopState);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const backupInterval = window.setInterval(trigger, intervalMs);
  trigger();

  return () => {
    observer.disconnect();
    window.removeEventListener("popstate", onPopState);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.clearInterval(backupInterval);
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
    }
  };
}
