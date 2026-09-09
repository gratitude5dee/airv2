import { createHash, randomUUID } from "node:crypto";
import { command, writeFile } from "../box/client";
import { shellQuote } from "../box/shell";

const COMMIT = `import hashlib, os, pathlib, sys
source, destination = map(pathlib.Path, sys.argv[1:3])
if source.is_symlink() or destination.is_symlink():
    raise RuntimeError("archive path is a symlink")
with source.open("rb") as staged:
    digest = hashlib.sha256()
    for chunk in iter(lambda: staged.read(1048576), b""):
        digest.update(chunk)
    if digest.hexdigest() != sys.argv[3]:
        raise RuntimeError("archive upload checksum mismatch")
    os.fsync(staged.fileno())
os.chmod(source, 0o600)
os.replace(source, destination)
directory = os.open(destination.parent, os.O_RDONLY)
try:
    os.fsync(directory)
finally:
    os.close(directory)
`;

/** Stage next to the destination and verify its bytes before atomic replace.
 * A failed upload or expired lease leaves the previous document intact. */
export async function writeArchiveFile(
  boxId: string, path: string, content: string, renew: () => Promise<void>
): Promise<void> {
  const staging = `${path}.pending-${randomUUID()}`;
  const digest = createHash("sha256").update(content).digest("hex");
  try {
    await renew();
    await writeFile(boxId, staging, content);
    await renew();
    const result = await command(boxId,
      `python3 -c ${shellQuote(COMMIT)} ${shellQuote(staging)} ${shellQuote(path)} ${shellQuote(digest)}`, 30);
    if (result.exitCode !== 0) throw new Error("Archive commit failed");
  } finally {
    // Only this invocation's random staging path; never the saved archive.
    await command(boxId, `rm -f -- ${shellQuote(staging)}`, 15).catch(() => undefined);
  }
}
