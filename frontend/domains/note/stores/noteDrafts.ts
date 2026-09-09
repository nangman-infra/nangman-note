const PREFIX = 'transnote_offline_note_';

export interface NoteDraft {
  key: string;
  content: string;
  baseRevision: number | null;
  savedAt: number;
}

export function newDraftKey(meetingId: string): string {
  // Each editor session owns its backup: another tab cannot erase its edits.
  return `${PREFIX}${meetingId}:${crypto.randomUUID()}`;
}

export function readDrafts(meetingId: string): NoteDraft[] {
  const prefix = `${PREFIX}${meetingId}`;
  try {
    const drafts: NoteDraft[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || (key !== prefix && !key.startsWith(`${prefix}:`))) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<NoteDraft> | null;
        if (!parsed || typeof parsed.content !== 'string') continue;
        drafts.push({
          key,
          content: parsed.content,
          baseRevision: Number.isInteger(parsed.baseRevision) && (parsed.baseRevision ?? -1) >= 0
            ? parsed.baseRevision! : null,
          savedAt: typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt)
            ? parsed.savedAt : 0,
        });
      } catch {
        // The original single-key backup format was plain Markdown.
        if (key === prefix) drafts.push({ key, content: raw, baseRevision: null, savedAt: 0 });
      }
    }
    return drafts.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function writeDraft(draft: NoteDraft): boolean {
  try {
    localStorage.setItem(draft.key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(draft: NoteDraft): void {
  try {
    const raw = localStorage.getItem(draft.key);
    if (raw === null) return;
    let current: Partial<NoteDraft>;
    try {
      current = JSON.parse(raw) as Partial<NoteDraft>;
    } catch {
      current = { content: raw, savedAt: 0 };
    }
    // Do not delete a backup updated by another session since it was read.
    if (current?.content === draft.content && (current.savedAt ?? 0) === draft.savedAt) {
      localStorage.removeItem(draft.key);
    }
  } catch {
    // A failed cleanup leaves an extra recoverable copy, never a lost draft.
  }
}
