import type { ArchiveMessage } from "./archive";

export interface KnownArchiveThread {
  id: string;
  label: string;
}

/** Owner-supplied mapping for a label the catalogue could not settle.
 * `id: null` keeps that label as its own legacy-label thread. */
export interface ThreadResolution {
  label: string;
  id: string | null;
}

export interface UnresolvedThread {
  label: string;
  candidates: string[];
}

/** Resolve legacy display labels only with a complete, unambiguous thread
 * catalogue from the owner, or an explicit owner resolution per label.
 * Labels alone are not stable identifiers. This preflight performs no
 * writes; callers must resolve every reported label before merging old
 * history into identified thread partitions. */
export function resolveLegacyThreads(
  messages: ArchiveMessage[],
  catalogue: KnownArchiveThread[],
  resolutions: ThreadResolution[] = []
): { messages: ArchiveMessage[]; unresolved: UnresolvedThread[] } {
  const byLabel = new Map<string, Set<string>>();
  for (const thread of catalogue) {
    if (!thread.id) throw new Error("Missing catalogue thread ID");
    const ids = byLabel.get(thread.label) ?? new Set<string>();
    ids.add(thread.id);
    byLabel.set(thread.label, ids);
  }
  const owner = new Map<string, string | null>();
  for (const resolution of resolutions) {
    if (resolution.id === "") throw new Error("Empty resolution thread ID");
    owner.set(resolution.label, resolution.id);
  }
  const unresolved = new Map<string, string[]>();
  const resolved = messages.map((message) => {
    if (message.chat_id) return { ...message };
    if (owner.has(message.chat)) {
      const id = owner.get(message.chat);
      return id ? { ...message, chat_id: id } : { ...message };
    }
    const candidates = [...(byLabel.get(message.chat) ?? [])].sort();
    if (candidates.length !== 1) {
      unresolved.set(message.chat, candidates);
      return { ...message };
    }
    return { ...message, chat_id: candidates[0]! };
  });
  return { messages: resolved, unresolved: [...unresolved]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, candidates]) => ({ label, candidates })) };
}
