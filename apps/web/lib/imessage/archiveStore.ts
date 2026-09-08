import { BoxApiError, readFile } from "../box/client";
import { writeArchiveFile } from "./archiveWrite";
import { deepMemoryIndex, OV_IMESSAGE_URI } from "../memory/deep";
import { archiveContentHash, archivePartition, mergeThreadArchive, renderThreadArchive, type ArchiveMessage, type ThreadArchive } from "./archive";

const STATE = ".hermes/context/imessage-archive-state";
const HISTORY = ".hermes/context/imessage-history/threads";

interface PartitionReceipt {
  hash: string;
  messages: number;
  from: string;
  to: string;
  indexedHash?: string;
}
interface Manifest {
  schema: 1;
  partitions: Record<string, PartitionReceipt>;
}

async function readJson<T>(boxId: string, path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(boxId, path)) as T;
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return null;
    throw error;
  }
}

/** Caller must hold the user's archive lease. Source records live outside
 * the indexed tree. A retry repairs markdown and receipts from durable source
 * records, so a failure between writes cannot double-count a message. */
export async function storeArchiveMessages(
  boxId: string,
  messages: ArchiveMessage[],
  renew: () => Promise<void>
): Promise<{ messages: number; partitions: number; from: string; to: string }> {
  const groups = new Map<string, ArchiveMessage[]>();
  for (const message of messages) {
    const partition = archivePartition(message);
    const group = groups.get(partition) ?? [];
    group.push(message);
    groups.set(partition, group);
  }
  const manifestPath = `${STATE}/manifest.json`;
  const manifest = await readJson<Manifest>(boxId, manifestPath) ?? { schema: 1, partitions: {} };
  if (manifest.schema !== 1 || !manifest.partitions || typeof manifest.partitions !== "object") {
    throw new Error("Invalid archive manifest");
  }
  for (const [partition, incoming] of groups) {
    const sourcePath = `${STATE}/${partition}.json`;
    const markdownPath = `${HISTORY}/${partition}.md`;
    const previous = await readJson<ThreadArchive>(boxId, sourcePath);
    const merged = mergeThreadArchive(previous, incoming);
    const hash = archiveContentHash(merged);
    const receipt = manifest.partitions[partition];
    if (!previous || archiveContentHash(previous) !== hash) {
      await renew();
      await writeArchiveFile(boxId, sourcePath, JSON.stringify(merged), renew);
    }
    // Even an unchanged source may have been saved just before a crash.
    if (receipt?.hash !== hash) {
      await renew();
      await writeArchiveFile(boxId, markdownPath, renderThreadArchive(merged), renew);
      manifest.partitions[partition] = {
        hash, messages: merged.messages.length,
        from: merged.messages[0]!.ts, to: merged.messages.at(-1)!.ts,
      };
      await renew();
      await writeArchiveFile(boxId, manifestPath, JSON.stringify(manifest), renew);
    }
    if (manifest.partitions[partition]!.indexedHash !== hash) {
      await renew();
      if (await deepMemoryIndex(boxId, markdownPath, `${OV_IMESSAGE_URI}/threads/${partition}`)) {
        manifest.partitions[partition]!.indexedHash = hash;
        await renew();
        await writeArchiveFile(boxId, manifestPath, JSON.stringify(manifest), renew);
      }
    }
  }
  const receipts = Object.values(manifest.partitions);
  return {
    messages: receipts.reduce((sum, receipt) => sum + receipt.messages, 0),
    partitions: receipts.length,
    from: receipts.map((receipt) => receipt.from).sort()[0] ?? "",
    to: receipts.map((receipt) => receipt.to).sort().at(-1) ?? "",
  };
}
