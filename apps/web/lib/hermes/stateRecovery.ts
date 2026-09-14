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
    const restoreOperation = data.value?.restore_operation_id as unknown;
    if (restoreOperation !== undefined && (
      data.value?.accept_partial_history !== true ||
      typeof restoreOperation !== "string" || !/^[a-z0-9-]{8,64}$/.test(restoreOperation)
    )) return;
    const { data: claimed, error } = await supabase.from("platform_settings").delete()
      .eq("key", key).eq("updated_at", data.updated_at).select("key");
    if (error || !claimed?.length) return;
    const result = await command(boxId,
      `/home/user/.hermes-venv/bin/python - ${shellQuote(operation)} ${shellQuote(typeof restoreOperation === "string" ? restoreOperation : "")} <<'PY'\n${STATE_RECOVERY_SCRIPT}\nPY`, 300);
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
import contextlib, fcntl, hashlib, io, json, os, pathlib, platform, shutil, signal, sqlite3, subprocess, sys, time, urllib.request, zipfile

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def canonical(conn):
    # PRAGMA table_list initializes virtual tables, so damaged FTS can hide
    # otherwise-readable canonical rows. Enumerate the schema directly.
    tables = conn.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
    virtual = [name for name, sql in tables if (sql or '').lstrip().upper().startswith('CREATE VIRTUAL TABLE')]
    if any(not name.startswith('messages_fts') for name in virtual):
        raise RuntimeError('unsupported virtual table')
    derived = {root + suffix for root in ('messages_fts', 'messages_fts_trigram', 'messages_fts_cjk')
               for suffix in ('', '_data', '_idx', '_content', '_docsize', '_config')}
    names = sorted(name for name, sql in tables if name not in derived)
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
def exclusive(db, damaged=False):
    conn = sqlite3.connect(db, timeout=0, isolation_level=None)
    try:
        try:
            conn.execute('PRAGMA synchronous=FULL')
        except sqlite3.DatabaseError:
            # A damaged sqlite_master may reject pragmas that parse schema.
            # Python SQLite's default remains FULL; locking statements and
            # backup can still operate without parsing the damaged schema.
            if not damaged:
                raise
        conn.execute('PRAGMA locking_mode=EXCLUSIVE')
        conn.execute('BEGIN EXCLUSIVE')
        conn.execute('ROLLBACK')
        # EXCLUSIVE mode retains writer exclusion while transaction-free,
        # as required by SQLite's transactional backup destination API.
        yield conn
    finally:
        conn.close()

def inspect_copy(path):
    result = {}
    with contextlib.closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as conn:
        # Connection-only tolerance for malformed schema: this does not
        # change the image and is diagnostic, never proof for promotion.
        for tolerant in (False, True):
            label = 'tolerant' if tolerant else 'normal'
            if tolerant:
                conn.execute('PRAGMA writable_schema=ON')
            item = {}
            result[label] = item
            try:
                item['schema'] = conn.execute("SELECT name,type,rootpage FROM sqlite_master LIMIT 100").fetchall()
            except sqlite3.Error as error:
                item['schema_error'] = str(error)[:300]
            for name in ('sessions', 'messages', 'lost_and_found'):
                try:
                    item[name] = conn.execute('SELECT COUNT(*) FROM ' + quote(name) + ' NOT INDEXED').fetchone()[0]
                except sqlite3.Error as error:
                    item[name] = {'error': str(error)[:300]}
    return result

def official_recovery_cli(folder):
    # Isolated recovery dependency, not a system or Hermes runtime upgrade.
    # URL and SHA3-256 are pinned to SQLite's official download manifest.
    if platform.machine() != 'x86_64':
        raise RuntimeError('official recovery tool requires Linux x86_64')
    url = 'https://www.sqlite.org/2026/sqlite-tools-linux-x64-3530400.zip'
    expected = '6eeb57e8f2aef7687f9f016a980992cf2799c8c07a87c5e21495530f91915047'
    with urllib.request.urlopen(url, timeout=25) as response:
        archive = response.read(16_000_001)
    if len(archive) > 16_000_000 or hashlib.sha3_256(archive).hexdigest() != expected:
        raise RuntimeError('official SQLite archive checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        members = [info for info in bundle.infolist() if pathlib.PurePosixPath(info.filename).name == 'sqlite3']
        if len(members) != 1 or members[0].file_size > 20_000_000:
            raise RuntimeError('unexpected SQLite archive layout')
        binary = folder / 'sqlite3-recovery'
        binary.write_bytes(bundle.read(members[0]))
        binary.chmod(0o700)
    return str(binary)

def stage_salvage(folder, cli='sqlite3'):
    # Work only from the retained pre-repair bytes, never from a failed native
    # repair's output. Recovered SQL and transcript content stay on this box.
    forensic = folder / 'forensic.db'
    for suffix in ('', '-wal', '-shm', '-journal'):
        raw = folder / ('state.db' + suffix)
        if raw.exists():
            shutil.copy2(raw, pathlib.Path(str(forensic) + suffix))
    report = {'source': inspect_copy(forensic)}
    sql = folder / 'recovered.sql'
    with sql.open('wb') as output:
        recover = subprocess.run([cli, str(forensic), '.recover --ignore-freelist'],
                                 stdout=output, stderr=subprocess.DEVNULL, timeout=70)
    report['recover_exit_code'] = recover.returncode
    report['sql_bytes'] = sql.stat().st_size
    recovered = folder / 'recovered.db'
    with sql.open('rb') as source:
        restore = subprocess.run([cli, str(recovered)], stdin=source,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=70)
    report['restore_exit_code'] = restore.returncode
    if recovered.exists():
        report['recovered'] = inspect_copy(recovered)
        with contextlib.closing(sqlite3.connect(recovered)) as conn:
            try:
                report['integrity'] = conn.execute('PRAGMA integrity_check').fetchmany(8)
            except sqlite3.Error as error:
                report['integrity_error'] = str(error)[:300]
    # SQLite salvage can omit/change data; it is NEVER auto-promoted.
    return report

def restore_staged(root, operation, source_operation):
    folder = root / 'state-recovery' / operation
    folder.mkdir(mode=0o700)  # Refuse to overwrite any earlier recovery.
    recovered = root / 'state-recovery' / source_operation / 'recovered.db'
    report = {'operation': operation, 'source_operation': source_operation,
              'backup_path': str(folder), 'accepted_partial_history': True, 'applied': False}
    services = ['hermes-gateway.service', 'hermes-dashboard.service']
    stopped = False
    try:
        prior_report = recovered.parent / 'report.json'
        if prior_report.exists():
            report['salvage'] = json.loads(prior_report.read_text()).get('salvage', {})
        if report.get('salvage', {}).get('recover_exit_code') not in (None, 0):
            # Some system sqlite3 builds expose .recover but cannot execute
            # it. Retry on raw backup bytes with the pinned official shell.
            retry = folder / 'salvage'
            retry.mkdir(mode=0o700)
            for suffix in ('', '-wal', '-shm', '-journal'):
                raw = recovered.parent / ('state.db' + suffix)
                if raw.exists():
                    shutil.copy2(raw, retry / raw.name)
            report['salvage'] = stage_salvage(retry, official_recovery_cli(folder))
            recovered = retry / 'recovered.db'
        candidate = folder / 'candidate.db'
        with contextlib.closing(sqlite3.connect(recovered.as_uri() + '?mode=ro', uri=True)) as source:
            # This must be a real recovered history, never an empty reset.
            recovered_rows = canonical(source)
            if not recovered_rows['sessions']['rows'] or not recovered_rows['messages']['rows']:
                raise RuntimeError('no recovered conversation history; refusing empty reset')
            with contextlib.closing(sqlite3.connect(candidate)) as dest:
                copy_snapshot(source, dest)
        sys.path.insert(0, '/home/user/hermes-agent')
        from hermes_state import SessionDB, _db_opens_cleanly
        session_db = SessionDB(db_path=candidate)
        session_db.close()
        health = _db_opens_cleanly(candidate)
        if health is not None:
            raise RuntimeError('Hermes recovered-store read/write probe failed: ' + health)
        with contextlib.closing(sqlite3.connect(candidate)) as conn:
            counts = canonical(conn)
            report['restored_counts'] = {name: value['rows'] for name, value in counts.items()}
            # Schema initialization must not rewrite recovered messages.
            for table in ('sessions', 'messages'):
                if counts[table] != recovered_rows[table]:
                    raise RuntimeError('Hermes initialization changed recovered ' + table)
        subprocess.run(['sudo', 'systemctl', 'stop', *services], check=True, capture_output=True, timeout=35)
        stopped = True
        db = root / 'state.db'
        paths = [pathlib.Path(str(db) + suffix) for suffix in ('', '-wal', '-shm', '-journal')]
        paths = [path for path in paths if path.exists()]
        if holders(paths):
            raise RuntimeError('another process still holds state.db')
        if shutil.disk_usage(root).free < sum(p.stat().st_size for p in paths) * 3 + 100_000_000:
            raise RuntimeError('insufficient backup headroom')
        fingerprints = {}
        for path in paths:
            backup = folder / path.name
            shutil.copy2(path, backup)
            with backup.open('rb') as saved:
                os.fsync(saved.fileno())
            if not path.name.endswith('-shm'):
                fingerprints[path] = hashlib.sha256(backup.read_bytes()).digest()
        report['backup_bytes'] = sum((folder / path.name).stat().st_size for path in paths)
        with exclusive(db, damaged=True) as live:
            for path, expected in fingerprints.items():
                if not path.exists() or hashlib.sha256(path.read_bytes()).digest() != expected:
                    raise RuntimeError('live files changed before exclusive ownership')
            with contextlib.closing(sqlite3.connect(candidate)) as source:
                copy_snapshot(source, live)
            report['applied'] = True
        report['post_restore_health'] = _db_opens_cleanly(db)
    except Exception as error:
        report['error'] = str(error)[:800]
    finally:
        if stopped:
            try:
                restarted = subprocess.run(['sudo', 'systemctl', 'start', *services], capture_output=True, timeout=35)
                report['services_restart_code'] = restarted.returncode
            except Exception as error:
                report['services_restart_error'] = str(error)[:300]
        (folder / 'report.json').write_text(json.dumps(report))
    return report

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
        if report.get('source_error') and report.get('backup_bytes'):
            try:
                report['salvage'] = stage_salvage(folder)
            except Exception as diagnostic_error:
                report['salvage_error'] = str(diagnostic_error)[:500]
    finally:
        try:
            restarted = subprocess.run(['sudo', 'systemctl', 'start', *services], capture_output=True, timeout=35)
            report['services_restart_code'] = restarted.returncode
        except Exception as error:
            report['services_restart_error'] = str(error)[:300]
        (folder / 'report.json').write_text(json.dumps(report))
    return report

def public_report(report):
    # Keep complete diagnostics on the box; logs need only statuses/counts.
    result = json.loads(json.dumps(report))
    for phase in result.get('salvage', {}).values():
        if isinstance(phase, dict):
            for mode in phase.values():
                if isinstance(mode, dict):
                    mode.pop('schema', None)
    return result

if __name__ == '__main__':
    def expired(*args):
        raise TimeoutError('recovery exceeded time budget')
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(240)
    root = pathlib.Path('/home/user/.hermes')
    with (root / '.air-state-recovery.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if len(sys.argv) > 2 and sys.argv[2]:
            print(json.dumps(public_report(restore_staged(root, sys.argv[1], sys.argv[2]))))
        else:
            print(json.dumps(public_report(recover(root, sys.argv[1]))))
`;
