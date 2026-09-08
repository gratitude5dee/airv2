import { createHash } from "node:crypto";
import { BoxApiError, command, readFile } from "../box/client";
import { shellQuote } from "../box/shell";
import { deepMemoryForget, OV_IMESSAGE_URI } from "../memory/deep";
import { parseChunk } from "./ingest";
import { resolveLegacyThreads, type KnownArchiveThread } from "./archiveMigration";
import { storeArchiveMessages } from "./archiveStore";
import { writeArchiveFile } from "./archiveWrite";

const HISTORY = ".hermes/context/imessage-history";
const BACKUP = ".hermes/context/imessage-archive-state/legacy";
const MARKER = ".hermes/context/imessage-archive-state/migration.json";

export class ArchiveMigrationError extends Error {}

const LIST = `import json, pathlib, re
roots = [pathlib.Path("${HISTORY}"), pathlib.Path("${BACKUP}")]
names = set()
for root in roots:
    if root.exists():
        for item in root.iterdir():
            if re.fullmatch(r"chunk-[0-9]+\\.json", item.name):
                if item.is_symlink() or not item.is_file():
                    raise RuntimeError("invalid legacy archive file")
                names.add(item.name)
print(json.dumps(sorted(names)))
`;

/** Caller holds the archive lease. Two passes ensure ambiguous or corrupt
 * legacy chunks cause no writes. Backups participate on retries, including
 * a crash after moving the last original but before writing the marker. */
export async function migrateLegacyArchive(
  boxId: string, catalogue: KnownArchiveThread[], renew: () => Promise<void>
): Promise<void> {
  try {
    const marker: unknown = JSON.parse(await readFile(boxId, MARKER));
    if (typeof marker !== "object" || marker === null || !("schema" in marker) || marker.schema !== 1) {
      throw new ArchiveMigrationError("Invalid archive migration marker");
    }
    return;
  } catch (error) {
    if (!(error instanceof BoxApiError && error.status === 404)) throw error;
  }
  const listed = await command(boxId, `python3 -c ${shellQuote(LIST)}`, 30);
  if (listed.exitCode !== 0) throw new ArchiveMigrationError("Could not inspect legacy archive");
  const names: unknown = JSON.parse(listed.stdout);
  if (!Array.isArray(names) || names.some((name: unknown) => typeof name !== "string" || !/^chunk-\d+\.json$/.test(name))) {
    throw new ArchiveMigrationError("Invalid legacy archive inventory");
  }
  async function load(name: string) {
    let text: string;
    try { text = await readFile(boxId, `${HISTORY}/${name}`); }
    catch (error) {
      if (!(error instanceof BoxApiError && error.status === 404)) throw error;
      text = await readFile(boxId, `${BACKUP}/${name}`);
    }
    const chunk = parseChunk({ messages: JSON.parse(text) });
    const resolved = resolveLegacyThreads(chunk.messages, catalogue);
    if (resolved.unresolved.length) {
      // Labels and content stay box-side/in memory, never in errors or logs.
      throw new ArchiveMigrationError("Legacy chat identities need resolution before migration");
    }
    return { messages: resolved.messages, hash: createHash("sha256").update(text).digest("hex") };
  }
  const hashes = new Map<string, string>();
  for (const name of names as string[]) {
    await renew();
    hashes.set(name, (await load(name)).hash);
  }
  for (const name of names as string[]) {
    await renew();
    const source = await load(name);
    if (source.hash !== hashes.get(name)) throw new ArchiveMigrationError("Legacy archive changed during migration");
    await storeArchiveMessages(boxId, source.messages, renew);
    await renew();
    if (!await deepMemoryForget(boxId, `${OV_IMESSAGE_URI}/${name.slice(0, -5)}`)) {
      throw new ArchiveMigrationError("Legacy memory index cleanup failed; retry migration");
    }
    await renew();
    const moveScript = `import pathlib, sys
source, backup = map(pathlib.Path, sys.argv[1:])
backup.parent.mkdir(parents=True, exist_ok=True)
if source.exists():
    if backup.exists():
        if source.read_bytes() != backup.read_bytes():
            raise RuntimeError("conflicting legacy backup")
        source.unlink()
    else:
        source.rename(backup)
`;
    const move = await command(boxId,
      `python3 -c ${shellQuote(moveScript)} ${shellQuote(`${HISTORY}/${name}`)} ${shellQuote(`${BACKUP}/${name}`)}`, 30);
    if (move.exitCode !== 0) throw new ArchiveMigrationError("Legacy archive backup failed");
  }
  await writeArchiveFile(boxId, MARKER, JSON.stringify({ schema: 1, legacy_chunks: names.length }), renew);
}
