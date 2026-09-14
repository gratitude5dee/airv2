import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { shellQuote } from "../box/shell";

/** An operator must enqueue one request for this exact box. It is consumed
 * atomically before running; a failed recovery never loops on every message. */
export async function maybeRecoverStateDatabase(
  supabase: SupabaseClient, boxId: string
): Promise<void> {
  const key = `hermes_state_recovery/${boxId}`;
  try {
    const { data } = await supabase.from("platform_settings").select("value,updated_at")
      .eq("key", key).maybeSingle();
    if (!data) return;
    const operation = data.value?.operation_id as unknown;
    if (typeof operation !== "string" || !/^[a-z0-9-]{8,64}$/.test(operation)) return;
    const { data: claimed, error } = await supabase.from("platform_settings").delete()
      .eq("key", key).eq("updated_at", data.updated_at).select("key");
    if (error || !claimed?.length) return;
    const result = await command(boxId,
      `/home/user/.hermes-venv/bin/python - ${shellQuote(operation)} <<'PY'\n${STATE_RECOVERY_SCRIPT}\nPY`, 300);
    console.error(JSON.stringify({msg: "hermes state recovery", box_id: boxId,
      exit_code: result.exitCode, report: result.stdout.slice(-12000)}));
  } catch {
    console.error(JSON.stringify({msg: "hermes state recovery unavailable", box_id: boxId}));
  }
}

// The original DB is backed up as raw bytes before SQLite opens it. Only
// promote a repaired copy when every canonical table has identical rows.
// No transcript content leaves the box. Unsupported/deeper corruption fails
// closed with the untouched original and staged forensic copy retained.
export const STATE_RECOVERY_SCRIPT = String.raw`
import contextlib, fcntl, hashlib, json, os, pathlib, shutil, signal, sqlite3, subprocess, sys, time

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def canonical(conn):
    tables = conn.execute('PRAGMA table_list').fetchall()
    virtual = [row[1] for row in tables if row[2] == 'virtual']
    if any(not name.startswith('messages_fts') for name in virtual):
        raise RuntimeError('unsupported virtual table')
    names = sorted(row[1] for row in tables if row[0] == 'main' and row[2] == 'table' and not row[1].startswith('sqlite_'))
    if not {'sessions', 'messages'}.issubset(names):
        raise RuntimeError('canonical session tables missing')
    result = {}
    for name in names:
        digest = hashlib.sha256()
        total = 0
        # NOT INDEXED proves table data readable even if a secondary index is damaged.
        columns = conn.execute('PRAGMA table_info(' + quote(name) + ')').fetchall()
        order = ','.join(quote(col[1]) for col in columns)
        for row in conn.execute('SELECT * FROM ' + quote(name) + ' NOT INDEXED ORDER BY ' + order):
            digest.update(repr(row).encode('utf-8', errors='surrogatepass'))
            digest.update(b'\n')
            total += 1
        result[name] = {'rows': total, 'sha256': digest.hexdigest()}
    return result

def validate(conn):
    check = conn.execute('PRAGMA integrity_check').fetchall()
    if check != [('ok',)]:
        raise RuntimeError('integrity_check failed: ' + repr(check[:5]))
    # Exercise the FTS write triggers inside a rolled-back transaction.
    conn.execute('SAVEPOINT air_recovery_probe')
    try:
        conn.execute('UPDATE messages SET content=content WHERE rowid=(SELECT rowid FROM messages LIMIT 1)')
    finally:
        conn.execute('ROLLBACK TO air_recovery_probe')
        conn.execute('RELEASE air_recovery_probe')

def holders(paths):
    result = subprocess.run(['sudo', 'fuser', *map(str, paths)], capture_output=True, timeout=10)
    if result.returncode not in (0, 1):
        raise RuntimeError('could not verify exclusive database ownership')
    return bool(result.stdout.strip())

def copy_snapshot(source, destination):
    deadline = time.monotonic() + 30
    def progress(*args):
        if time.monotonic() > deadline:
            raise TimeoutError('snapshot timed out')
    source.backup(destination, pages=128, progress=progress)

@contextlib.contextmanager
def exclusive(db):
    conn = sqlite3.connect(db, timeout=0, isolation_level=None)
    try:
        conn.execute('PRAGMA synchronous=FULL')
        conn.execute('PRAGMA locking_mode=EXCLUSIVE')
        conn.execute('BEGIN EXCLUSIVE')
        conn.execute('ROLLBACK')
        # EXCLUSIVE mode retains writer exclusion while transaction-free,
        # as required by SQLite's transactional backup destination API.
        yield conn
    finally:
        conn.close()

def recover(root, operation):
    db = root / 'state.db'
    folder = root / 'state-recovery' / operation
    if folder.exists():
        raise RuntimeError('recovery operation already exists; inspect retained artifacts')
    folder.mkdir(parents=True, mode=0o700)
    os.chmod(folder.parent, 0o700)
    report = {'operation': operation, 'backup_path': str(folder), 'applied': False, 'sqlite_version': sqlite3.sqlite_version}
    services = ['hermes-gateway.service', 'hermes-dashboard.service']
    try:
        subprocess.run(['sudo', 'systemctl', 'stop', *services], check=True, capture_output=True, timeout=35)
        paths = [pathlib.Path(str(db) + suffix) for suffix in ('', '-wal', '-shm', '-journal')]
        paths = [path for path in paths if path.exists()]
        if holders(paths):
            raise RuntimeError('another process still holds state.db')
        if shutil.disk_usage(root).free < sum(p.stat().st_size for p in paths) * 4 + 100_000_000:
            raise RuntimeError('insufficient backup headroom')
        for path in paths:
            shutil.copy2(path, folder / path.name)
            with (folder / path.name).open('rb') as backup:
                os.fsync(backup.fileno())
        report['backup_bytes'] = sum(p.stat().st_size for p in paths)
        candidate = folder / 'candidate.db'
        before = None
        with contextlib.closing(sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=5)) as source:
            try:
                before = canonical(source)
                report['source_counts'] = {name: value['rows'] for name, value in before.items()}
            except Exception as error:
                report['source_error'] = str(error)[:500]
            try:
                with contextlib.closing(sqlite3.connect(candidate)) as dest:
                    copy_snapshot(source, dest)
            except sqlite3.DatabaseError as error:
                # Retain a raw offline candidate when corruption prevents
                # SQLite backup. This is never itself proof of safe recovery.
                report['snapshot_error'] = str(error)[:500]
                candidate = folder / 'raw-candidate.db'
                for suffix in ('', '-wal', '-shm', '-journal'):
                    raw = folder / ('state.db' + suffix)
                    if raw.exists():
                        shutil.copy2(raw, pathlib.Path(str(candidate) + suffix))
        # Repair only the scratch copy using the installed Hermes repair API.
        sys.path.insert(0, '/home/user/hermes-agent')
        from hermes_state import repair_state_db_schema
        native = repair_state_db_schema(candidate, backup=True)
        report['native'] = {key: native.get(key) for key in ('repaired', 'strategy', 'error')}
        with contextlib.closing(sqlite3.connect(candidate)) as conn:
            validate(conn)
            after = canonical(conn)
            report['candidate_counts'] = {name: value['rows'] for name, value in after.items()}
            report['canonical_equal'] = before is not None and before == after
            if not report['canonical_equal']:
                raise RuntimeError('canonical rows could not be proven identical; candidate retained only')
            conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            conn.execute('PRAGMA journal_mode=DELETE')
        # Retain SQLite's exclusive lock across the final comparison and
        # transactional promotion. Never replace an inode under open handles
        # or remove WAL files; an interrupted backup rolls itself back.
        with exclusive(db) as live:
            if canonical(live) != before:
                raise RuntimeError('live canonical data changed during recovery')
            with contextlib.closing(sqlite3.connect(candidate)) as repaired:
                copy_snapshot(repaired, live)
        report['applied'] = True
    except Exception as error:
        report['error'] = str(error)[:800]
    finally:
        try:
            restarted = subprocess.run(['sudo', 'systemctl', 'start', *services], capture_output=True, timeout=35)
            report['services_restart_code'] = restarted.returncode
        except Exception as error:
            report['services_restart_error'] = str(error)[:300]
        (folder / 'report.json').write_text(json.dumps(report))
    return report

if __name__ == '__main__':
    def expired(*args):
        raise TimeoutError('recovery exceeded time budget')
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(240)
    root = pathlib.Path('/home/user/.hermes')
    with (root / '.air-state-recovery.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        print(json.dumps(recover(root, sys.argv[1])))
`;
