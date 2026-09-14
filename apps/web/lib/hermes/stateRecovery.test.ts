import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { STATE_RECOVERY_SCRIPT } from "./stateRecovery";

vi.mock("../box/client", () => ({ command: vi.fn() }));

function fixture(check: string) {
  const harness = `
import tempfile, types
root = pathlib.Path(tempfile.mkdtemp(prefix='air-recovery-test-'))
events = []
def run(args, **kwargs):
    events.append(args)
    return types.SimpleNamespace(returncode=1 if 'fuser' in args else 0, stdout=b'')
subprocess.run = run
native = types.ModuleType('hermes_state')
def repair(path, backup=True):
    with sqlite3.connect(path) as conn:
        conn.execute('REINDEX')
    return {'repaired': True, 'strategy': 'reindex_btree'}
native.repair_state_db_schema = repair
sys.modules['hermes_state'] = native
try:
    db = root / 'state.db'
    with sqlite3.connect(db) as conn:
        conn.executescript('''
          CREATE TABLE sessions(id TEXT PRIMARY KEY);
          CREATE TABLE messages(id INTEGER PRIMARY KEY, session_id TEXT, content TEXT);
          CREATE INDEX message_content ON messages(content);
          INSERT INTO sessions VALUES ('session-one');
          INSERT INTO messages VALUES (1, 'session-one', 'private fixture text');
          CREATE VIRTUAL TABLE messages_fts USING fts5(content, content=messages, content_rowid=id);
          INSERT INTO messages_fts(messages_fts) VALUES ('rebuild');
          CREATE TRIGGER messages_update AFTER UPDATE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts,rowid,content) VALUES ('delete',old.id,old.content);
            INSERT INTO messages_fts(rowid,content) VALUES (new.id,new.content);
          END;
        ''')
    ${check.replaceAll("\n", "\n    ")}
    print(json.dumps(report))
finally:
    shutil.rmtree(root)
`;
  const script = `${STATE_RECOVERY_SCRIPT}\n${harness}`;
  const output = execFileSync("python3", ["-c",
    `exec(${JSON.stringify(script)}, {'__name__': 'air_recovery_test'})`],
  { encoding: "utf8", timeout: 15_000 });
  expect(output).not.toContain("private fixture text");
  return JSON.parse(output);
}

describe("offline state recovery", () => {
  it("backs up and transactionally promotes identical canonical data", () => {
    const report = fixture(`
original = db.read_bytes()
report = recover(root, 'test-healthy')
assert (root / 'state-recovery/test-healthy/state.db').read_bytes() == original
with sqlite3.connect(db) as conn:
    validate(conn)
assert events[-1][2] == 'start'
`);
    expect(report).toMatchObject({ applied: true, canonical_equal: true, services_restart_code: 0 });
    expect(report.source_counts).toEqual({ messages: 1, sessions: 1 });
  });

  it("repairs a real stale secondary index without losing messages", () => {
    const report = fixture(`
with sqlite3.connect(db) as conn:
    index = conn.execute("SELECT * FROM sqlite_master WHERE name='message_content'").fetchone()
    conn.execute('PRAGMA writable_schema=ON')
    conn.execute("DELETE FROM sqlite_master WHERE name='message_content'")
    conn.execute('PRAGMA schema_version=100')
with sqlite3.connect(db) as conn:
    conn.execute("INSERT INTO messages VALUES (2, 'session-one', 'another fixture')")
with sqlite3.connect(db) as conn:
    conn.execute('PRAGMA writable_schema=ON')
    conn.execute('INSERT INTO sqlite_master VALUES (?, ?, ?, ?, ?)', index)
    conn.execute('PRAGMA schema_version=101')
with sqlite3.connect(db) as conn:
    assert conn.execute('PRAGMA integrity_check').fetchall() != [('ok',)]
report = recover(root, 'test-corrupt-index')
with sqlite3.connect(db) as conn:
    validate(conn)
    assert conn.execute('SELECT count(*) FROM messages').fetchone() == (2,)
`);
    expect(report).toMatchObject({ applied: true, canonical_equal: true });
  });

  it("rejects a repair that changes conversation data", () => {
    const report = fixture(`
def destructive(path, backup=True):
    with sqlite3.connect(path) as conn:
        conn.execute("UPDATE messages SET content='changed'")
    return {'repaired': True}
native.repair_state_db_schema = destructive
original = db.read_bytes()
report = recover(root, 'test-unsafe')
assert db.read_bytes() == original
assert events[-1][2] == 'start'
`);
    expect(report.applied).toBe(false);
    expect(report.canonical_equal).toBe(false);
    expect(report.error).toContain("could not be proven identical");
  });

  it("rejects promotion when a new live message arrives during repair", () => {
    const report = fixture(`
def concurrent(path, backup=True):
    with sqlite3.connect(db) as conn:
        conn.execute("INSERT INTO messages VALUES (2, 'session-one', 'new message')")
    return {'repaired': True}
native.repair_state_db_schema = concurrent
report = recover(root, 'test-concurrent')
with sqlite3.connect(db) as conn:
    assert conn.execute('SELECT count(*) FROM messages').fetchone() == (2,)
`);
    expect(report.applied).toBe(false);
    expect(report.error).toContain("changed during recovery");
  });

  it("backs up unrecoverable bytes and restarts services without replacement", () => {
    const report = fixture(`
db.write_bytes(b'invalid sqlite header')
original = db.read_bytes()
report = recover(root, 'test-unreadable')
assert db.read_bytes() == original
assert (root / 'state-recovery/test-unreadable/state.db').read_bytes() == original
assert events[-1][2] == 'start'
`);
    expect(report.applied).toBe(false);
    expect(report.services_restart_code).toBe(0);
  });
});
