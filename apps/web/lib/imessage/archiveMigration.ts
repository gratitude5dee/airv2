import type { ArchiveMessage } from "./archive";

export interface KnownArchiveThread {
  id: string;
  label: string;
}

/** Resolve legacy display labels only with a complete, unambiguous thread
 * catalogue from the owner. Labels alone are not stable identifiers. This
 * preflight performs no writes; callers must resolve every reported label
 * before merging old history into identified thread partitions. */
export function resolveLegacyThreads(
  messages: ArchiveMessage[],
  catalogue: KnownArchiveThread[]
): { messages: ArchiveMessage[]; unresolved: Array<{ label: string; candidates: string[] }> } {
  const byLabel = new Map<string, Set<string>>();
  for (const thread of catalogue) {
    if (!thread.id) throw new Error("Missing catalogue thread ID");
    const ids = byLabel.get(thread.label) ?? new Set<string>();
    ids.add(thread.id);
    byLabel.set(thread.label, ids);
  }
  const unresolved = new Map<string, string[]>();
  const resolved = messages.map((message) => {
    if (message.chat_id) return { ...message };
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
