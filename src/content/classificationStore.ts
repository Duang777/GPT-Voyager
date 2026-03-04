export type Folder = {
  id: string;
  name: string;
  createdAt: number;
};

export type Tag = {
  id: string;
  name: string;
  createdAt: number;
};

export type ConversationClassificationMeta = {
  folderId?: string;
  tagIds: string[];
  starred?: boolean;
  note?: string;
};

export type ClassificationState = {
  version: 1;
  folders: Folder[];
  tags: Tag[];
  metaByConversationId: Record<string, ConversationClassificationMeta>;
};

export const CLASSIFICATION_STORAGE_KEY = "gpt_voyager_classification_v1";

export function createEmptyClassificationState(): ClassificationState {
  return {
    version: 1,
    folders: [],
    tags: [],
    metaByConversationId: {}
  };
}

function normalizeNote(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function sanitizeClassificationState(raw: unknown): ClassificationState {
  const empty = createEmptyClassificationState();
  if (!raw || typeof raw !== "object") {
    return empty;
  }

  const source = raw as Partial<ClassificationState>;
  const folders = Array.isArray(source.folders)
    ? source.folders.filter((item): item is Folder => {
        return (
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          item.name.trim().length > 0 &&
          typeof item?.createdAt === "number"
        );
      })
    : [];

  const tags = Array.isArray(source.tags)
    ? source.tags.filter((item): item is Tag => {
        return (
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          item.name.trim().length > 0 &&
          typeof item?.createdAt === "number"
        );
      })
    : [];

  const folderIdSet = new Set(folders.map((item) => item.id));
  const tagIdSet = new Set(tags.map((item) => item.id));

  const metaByConversationId: Record<string, ConversationClassificationMeta> = {};
  if (source.metaByConversationId && typeof source.metaByConversationId === "object") {
    for (const [conversationId, meta] of Object.entries(source.metaByConversationId)) {
      if (!meta || typeof meta !== "object") {
        continue;
      }
      const typedMeta = meta as Partial<ConversationClassificationMeta>;
      const tagIds = Array.isArray(typedMeta.tagIds)
        ? typedMeta.tagIds.filter((tagId): tagId is string => typeof tagId === "string" && tagIdSet.has(tagId))
        : [];
      const folderId =
        typeof typedMeta.folderId === "string" && folderIdSet.has(typedMeta.folderId) ? typedMeta.folderId : undefined;
      const note = normalizeNote(typedMeta.note);
      const starred = Boolean(typedMeta.starred);

      if (!folderId && tagIds.length === 0 && !note && !starred) {
        continue;
      }

      metaByConversationId[conversationId] = {
        folderId,
        tagIds: Array.from(new Set(tagIds)),
        starred,
        note: note || undefined
      };
    }
  }

  return {
    version: 1,
    folders: folders.sort((a, b) => a.createdAt - b.createdAt),
    tags: tags.sort((a, b) => a.createdAt - b.createdAt),
    metaByConversationId
  };
}

export async function loadClassificationState(): Promise<ClassificationState> {
  if (!chrome?.storage?.local) {
    return createEmptyClassificationState();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(CLASSIFICATION_STORAGE_KEY, (result) => {
      const raw = result?.[CLASSIFICATION_STORAGE_KEY];
      resolve(sanitizeClassificationState(raw));
    });
  });
}

export async function saveClassificationState(state: ClassificationState): Promise<void> {
  if (!chrome?.storage?.local) {
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [CLASSIFICATION_STORAGE_KEY]: state }, () => resolve());
  });
}

export function createEntityId(prefix: "folder" | "tag"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function isDuplicateName(list: Array<{ name: string }>, name: string): boolean {
  const normalized = normalizeName(name).toLowerCase();
  if (!normalized) {
    return true;
  }
  return list.some((item) => normalizeName(item.name).toLowerCase() === normalized);
}
