"""ExperienceLedger: the transactional Box-local store (goal.md §4, §7).

SQLite in WAL mode with foreign keys, migrations, idempotency keys, and an
append-only lineage event stream. HUD spans and Harbor job directories are
diagnostics; this database is the source of truth.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

LEARNING_HOME = Path(os.environ.get("AIR_LEARNING_HOME", str(Path.home() / ".hermes" / "learning")))
DB_PATH = LEARNING_HOME / "learning.db"

MIGRATIONS: list[str] = [
    # 001: core tables
    """
    create table if not exists episodes (
      episode_id   text primary key,
      trace_id     text not null unique,
      session_id   text,
      source       text not null check (source in ('production','evaluation')),
      status       text not null default 'collected'
                   check (status in ('collected','reconciled','qualified','expired')),
      outcome      text not null default 'unknown',
      trace_path   text,
      created_at   real not null,
      reconciled_at real
    );
    create index if not exists episodes_created on episodes (created_at desc);

    create table if not exists feedback (
      id          text primary key,
      trace_id    text not null,
      reason      text not null,
      rating      integer,
      correction_path text,
      confirmed   integer not null default 0,
      created_at  real not null
    );

    create table if not exists tasks (
      task_id     text primary key,
      revision    integer not null default 1,
      family      text not null,
      split       text check (split in ('train','dev','holdout')),
      state       text not null default 'draft'
                  check (state in ('draft','sanitized','oracle_verified','qualified',
                                   'train','dev','holdout','retired','quarantined')),
      quarantine_reason text,
      source_episode_id text references episodes(episode_id),
      created_at  real not null
    );

    create table if not exists candidates (
      candidate_id text primary key,
      parent_profile_id text,
      state       text not null default 'draft'
                  check (state in ('draft','schema_valid','shadowed','evaluated','proposed',
                                   'approved','canary','active','rejected','inconclusive',
                                   'quarantined','incompatible','rolled_back','superseded')),
      manifest_path text not null,
      summary     text,
      created_at  real not null,
      updated_at  real not null
    );

    create table if not exists experiments (
      experiment_id text primary key,
      candidate_id  text references candidates(candidate_id),
      backend       text check (backend in ('native','hud','harbor')),
      status        text not null default 'queued'
                    check (status in ('queued','running','passed','failed','inconclusive','cancelled')),
      spec_path     text,
      result_path   text,
      created_at    real not null,
      finished_at   real
    );

    create table if not exists profiles (
      profile_id  text primary key,
      parent_profile_id text,
      candidate_id text references candidates(candidate_id),
      status      text not null default 'inactive'
                  check (status in ('inactive','active','rolled_back','superseded')),
      dir_path    text not null,
      activated_at real,
      rolled_back_at real
    );

    create table if not exists lineage_events (
      seq          integer primary key autoincrement,
      idempotency_key text not null unique,
      event_type   text not null,
      subject_id   text,
      detail_json  text not null default '{}',
      occurred_at  real not null
    );

    create table if not exists receipts_outbox (
      seq          integer primary key autoincrement,
      idempotency_key text not null unique,
      receipt_json text not null,
      drained      integer not null default 0,
      created_at   real not null
    );

    create table if not exists settings (
      key   text primary key,
      value text not null
    );
    """,
]

DEFAULT_SETTINGS = {
    "mode": "observe",  # off | observe | suggest | auto_safe
    "daily_budget_usd": "1.00",
    "retention_raw_days": "30",
    "retention_derived_days": "180",
    "schedule": "idle_only",
    "collection_kill_switch": "0",
    "evaluation_kill_switch": "0",
}


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    conn = sqlite3.connect(str(path), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma journal_mode=wal")
    conn.execute("pragma foreign_keys=on")
    _migrate(conn)
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    conn.execute("create table if not exists _migrations (id integer primary key, applied_at real)")
    applied = {row["id"] for row in conn.execute("select id from _migrations")}
    for index, statement in enumerate(MIGRATIONS, start=1):
        if index in applied:
            continue
        with conn:
            conn.executescript(statement)
            conn.execute("insert into _migrations (id, applied_at) values (?, ?)", (index, time.time()))
    with conn:
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute("insert or ignore into settings (key, value) values (?, ?)", (key, value))


def get_settings(conn: sqlite3.Connection) -> dict[str, str]:
    return {row["key"]: row["value"] for row in conn.execute("select key, value from settings")}


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    if key not in DEFAULT_SETTINGS:
        raise ValueError(f"unknown setting: {key}")
    with conn:
        conn.execute(
            "insert into settings (key, value) values (?, ?) "
            "on conflict (key) do update set value = excluded.value",
            (key, value),
        )


def append_event(
    conn: sqlite3.Connection,
    event_type: str,
    subject_id: str | None = None,
    detail: dict | None = None,
    idempotency_key: str | None = None,
) -> None:
    """Append-only lineage; duplicate idempotency keys are silently dropped."""
    key = idempotency_key or uuid.uuid4().hex
    with conn:
        conn.execute(
            "insert or ignore into lineage_events "
            "(idempotency_key, event_type, subject_id, detail_json, occurred_at) values (?, ?, ?, ?, ?)",
            (key, event_type, subject_id, json.dumps(detail or {}), time.time()),
        )


def enqueue_receipt(conn: sqlite3.Connection, receipt: dict) -> None:
    with conn:
        conn.execute(
            "insert or ignore into receipts_outbox (idempotency_key, receipt_json, created_at) values (?, ?, ?)",
            (receipt["idempotency_key"], json.dumps(receipt), time.time()),
        )


def drain_receipts(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    """Peek at undrained receipts without marking them.

    Rows stay in the outbox until ack_receipts confirms the central write,
    so delivery is at-least-once and the idempotency key deduplicates.
    """
    rows = conn.execute(
        "select receipt_json from receipts_outbox where drained = 0 order by seq limit ?",
        (limit,),
    ).fetchall()
    return [json.loads(row["receipt_json"]) for row in rows]


def ack_receipts(conn: sqlite3.Connection, idempotency_keys: list[str]) -> int:
    """Mark receipts drained after the control plane confirms the central upsert."""
    acked = 0
    with conn:
        for key in idempotency_keys:
            cursor = conn.execute(
                "update receipts_outbox set drained = 1 where idempotency_key = ? and drained = 0",
                (key,),
            )
            acked += cursor.rowcount
    return acked


def counts(conn: sqlite3.Connection) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in ("episodes", "feedback", "tasks", "candidates", "experiments", "profiles"):
        out[table] = conn.execute(f"select count(*) as n from {table}").fetchone()["n"]
    out["receipts_pending"] = conn.execute(
        "select count(*) as n from receipts_outbox where drained = 0"
    ).fetchone()["n"]
    return out
