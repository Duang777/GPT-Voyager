import { normalizeStorageScope } from "./storageScope";

export type AccountScopeInfo = {
  scope: string;
  label: string;
  source: string;
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function pickEmail(text: string): string {
  const matched = text.match(EMAIL_REGEX);
  return matched?.[0]?.toLowerCase() ?? "";
}

function readFromNextData(doc: Document): AccountScopeInfo | null {
  const nextData = doc.getElementById("__NEXT_DATA__");
  const content = nextData?.textContent;
  if (!content) {
    return null;
  }
  const email = pickEmail(content);
  if (email) {
    return {
      scope: normalizeStorageScope(email),
      label: email,
      source: "next_data"
    };
  }
  return null;
}

function readFromDom(doc: Document): AccountScopeInfo | null {
  const selectors = [
    "a[href^='mailto:']",
    "button[aria-label*='@']",
    "button[title*='@']",
    "[data-testid*='user']",
    "[data-testid*='profile']",
    "[data-testid*='account']",
    "button[aria-haspopup='menu']"
  ];

  for (const selector of selectors) {
    const nodes = Array.from(doc.querySelectorAll<HTMLElement>(selector)).slice(0, 20);
    for (const node of nodes) {
      const text = `${node.textContent ?? ""} ${node.getAttribute("title") ?? ""} ${node.getAttribute("aria-label") ?? ""}`;
      const email = pickEmail(text);
      if (!email) {
        continue;
      }
      return {
        scope: normalizeStorageScope(email),
        label: email,
        source: "dom"
      };
    }
  }
  return null;
}

function readFromLocalStorage(): AccountScopeInfo | null {
  try {
    const maxChecks = Math.min(window.localStorage.length, 80);
    let checked = 0;
    for (let i = 0; i < window.localStorage.length && checked < maxChecks; i += 1) {
      const key = window.localStorage.key(i) ?? "";
      if (!/(user|account|auth|profile|session|openai|oai)/i.test(key)) {
        continue;
      }
      checked += 1;
      const value = window.localStorage.getItem(key);
      if (!value) {
        continue;
      }
      const email = pickEmail(value);
      if (!email) {
        continue;
      }
      return {
        scope: normalizeStorageScope(email),
        label: email,
        source: "local_storage"
      };
    }
  } catch {
    // Ignore localStorage access issues.
  }
  return null;
}

export function detectAccountScope(doc: Document = document): AccountScopeInfo {
  const fromNextData = readFromNextData(doc);
  if (fromNextData) {
    return fromNextData;
  }

  const fromDom = readFromDom(doc);
  if (fromDom) {
    return fromDom;
  }

  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    return fromStorage;
  }

  return {
    scope: "guest",
    label: "未识别账号（guest）",
    source: "fallback"
  };
}

