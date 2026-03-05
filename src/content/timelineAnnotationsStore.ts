import { buildScopedStorageKey, normalizeStorageScope } from "./storageScope";

export type TimelineNodeAnnotation = {
  id: string;
  conversationId: string;
  timelineItemId: string;
  tags: string[];
  highlighted: boolean;
  createdAt: number;
  updatedAt: number;
};

export const TIMELINE_ANNOTATIONS_STORAGE_KEY = "gpt_voyager_timeline_annotations_v1";

function normalizeCompactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTimelineTag(value: string): string {
  return normalizeCompactText(value).slice(0, 24);
}

export function normalizeTimelineAnnotationTags(value: unknown): string[] {
  const source =
    typeof value === "string"
      ? value.split(/[,，;\n]+/g)
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];

  const deduplicated = new Map<string, string>();
  for (const rawTag of source) {
    const tag = normalizeTimelineTag(rawTag);
    if (!tag) {
      continue;
    }
    const key = tag.toLocaleLowerCase();
    if (!deduplicated.has(key)) {
      deduplicated.set(key, tag);
    }
    if (deduplicated.size >= 8) {
      break;
    }
  }
  return Array.from(deduplicated.values());
}

export function buildTimelineAnnotationKey(conversationId: string, timelineItemId: string): string {
  return `${conversationId}::${timelineItemId}`;
}

export function createTimelineAnnotationId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `timeline_anno_${Date.now().toString(36)}_${random}`;
}

export function sanitizeTimelineAnnotations(raw: unknown): TimelineNodeAnnotation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const deduplicated = new Map<string, TimelineNodeAnnotation>();
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const typed = item as Partial<TimelineNodeAnnotation>;
    const conversationId = normalizeCompactText(typeof typed.conversationId === "string" ? typed.conversationId : "");
    const timelineItemId = normalizeCompactText(typeof typed.timelineItemId === "string" ? typed.timelineItemId : "");
    if (!conversationId || !timelineItemId) {
      continue;
    }

    const tags = normalizeTimelineAnnotationTags(typed.tags);
    const highlighted = Boolean(typed.highlighted);
    if (!highlighted && tags.length === 0) {
      continue;
    }

    const now = Date.now();
    const createdAt = typeof typed.createdAt === "number" ? typed.createdAt : now;
    const updatedAt = typeof typed.updatedAt === "number" ? typed.updatedAt : createdAt;
    const id =
      typeof typed.id === "string" && typed.id.trim()
        ? typed.id.trim()
        : createTimelineAnnotationId();

    const normalized: TimelineNodeAnnotation = {
      id,
      conversationId,
      timelineItemId,
      tags,
      highlighted,
      createdAt,
      updatedAt
    };

    const dedupeKey = buildTimelineAnnotationKey(conversationId, timelineItemId);
    const existing = deduplicated.get(dedupeKey);
    if (!existing || existing.updatedAt < normalized.updatedAt) {
      deduplicated.set(dedupeKey, normalized);
    }
    if (deduplicated.size >= 5000) {
      break;
    }
  }

  return Array.from(deduplicated.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadTimelineAnnotations(): Promise<TimelineNodeAnnotation[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const storageKey = buildScopedStorageKey(TIMELINE_ANNOTATIONS_STORAGE_KEY);
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      resolve(sanitizeTimelineAnnotations(result?.[storageKey]));
    });
  });
}

export async function loadTimelineAnnotationsByScope(scope?: string): Promise<TimelineNodeAnnotation[]> {
  if (!chrome?.storage?.local) {
    return [];
  }

  const normalizedScope = normalizeStorageScope(scope);
  const scopedStorageKey = buildScopedStorageKey(TIMELINE_ANNOTATIONS_STORAGE_KEY, normalizedScope);
  if (scopedStorageKey === TIMELINE_ANNOTATIONS_STORAGE_KEY) {
    return loadTimelineAnnotations();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([scopedStorageKey, TIMELINE_ANNOTATIONS_STORAGE_KEY], (result) => {
      const scopedValue = result?.[scopedStorageKey];
      if (scopedValue !== undefined) {
        resolve(sanitizeTimelineAnnotations(scopedValue));
        return;
      }
      resolve(sanitizeTimelineAnnotations(result?.[TIMELINE_ANNOTATIONS_STORAGE_KEY]));
    });
  });
}

export async function saveTimelineAnnotations(items: TimelineNodeAnnotation[], scope?: string): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  const storageKey = buildScopedStorageKey(TIMELINE_ANNOTATIONS_STORAGE_KEY, scope);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [storageKey]: sanitizeTimelineAnnotations(items) }, () => resolve());
  });
}
