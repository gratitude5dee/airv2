import { command } from "../box/client";
import { log } from "../log";

/** Only inspect storage after SQLite itself reports corruption. Never log rows. */
export function isStateDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /database disk image is malformed|file is not a database/i.test(message);
}

export const STATE_HEALTH_PROBE = `python3 - <<'PY'
import json, pathlib, shutil, sqlite3
root = pathlib.Path('/home/user/.hermes')
result = {'sqlite_version': sqlite3.sqlite_version, 'sqlite_cli': shutil.which('sqlite3'), 'free_bytes': shutil.disk_usage(root).free, 'databases': []}
for name in ('state.db',):
    path = root / name
    item = {'name': name, 'exists': path.is_file()}
    result['databases'].append(item)
    if not path.is_file():
        continue
    item['files'] = []
    for suffix in ('', '-wal', '-shm'):
        file = root / (name + suffix)
        if file.is_file():
            stat = file.stat()
            item['files'].append({'name': file.name, 'bytes': stat.st_size, 'uid': stat.st_uid, 'mode': oct(stat.st_mode & 0o777)})
    conn = None
    try:
        conn = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3)
        item['quick_check'] = conn.execute('PRAGMA quick_check').fetchmany(12)
        item['schema'] = conn.execute("SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchmany(60)
        item['counts'] = {}
        for table in ('sessions', 'messages'):
            try:
                item['counts'][table] = conn.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
            except sqlite3.Error as error:
                item['counts'][table] = {'error': str(error)[:300]}
    except sqlite3.Error as error:
        item['error'] = str(error)[:300]
    finally:
        if conn is not None:
            conn.close()
print(json.dumps(result))
PY`;

export async function logStateDatabaseHealth(boxId: string): Promise<void> {
  try {
    const result = await command(boxId, STATE_HEALTH_PROBE, 20);
    // The fixed probe only emits file metadata, schema names and row counts.
    const health: unknown = result.exitCode === 0 ? JSON.parse(result.stdout) : null;
    log.error("hermes state database health", {box_id: boxId,
      exit_code: result.exitCode, health,});
  } catch {
    log.error("hermes state database probe unavailable", {box_id: boxId});
  }
}
