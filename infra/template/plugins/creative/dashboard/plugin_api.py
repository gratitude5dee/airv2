"""Creative backend plugin (goal-creative.md CM1).

A typed HTTP surface at /api/plugins/creative/* replacing stdout parsing of
box commands. The plugin owns job lifecycle, asset bookkeeping, and a stable
contract; the genmedia skills (commercial, marketing, ugc, cinematography)
own the craft — jobs shell out to the Hermes CLI, they never reimplement
prompting.

Jobs are durable in a local SQLite table, not in memory (CM1 task 2): a box
that stops mid-render resumes to a `running` job with a dead process, which
startup reconciliation fails with a retriable reason.
"""

import hashlib
import json
import os
import shlex
import shutil
import signal
import sqlite3
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

router = APIRouter()

HOME = Path(os.environ.get("HOME", "/home/user"))
CREATIVE_DIR = HOME / ".hermes" / "creative"
ASSETS_DIR = CREATIVE_DIR / "assets"
JOBS_DIR = CREATIVE_DIR / "jobs"
DB_PATH = CREATIVE_DIR / "creative.db"
HERMES_BIN = os.environ.get(
    "CREATIVE_HERMES_BIN", str(HOME / ".hermes-venv" / "bin" / "hermes")
)
PLUGIN_VERSION = "0.1.0"

JOB_KINDS = {"commercial", "marketing", "ugc", "cinematography"}

# Coarse pre-run spend estimates in USD by job kind (CM1 task 4). The control
# plane enforces the cap; these make enforcement possible by being stated
# before work starts. Actuals are recorded from the skill run when available.
COST_ESTIMATES_USD = {
    "commercial": 4.0,
    "marketing": 1.5,
    "ugc": 2.0,
    "cinematography": 6.0,
}

MEDIA_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".gif", ".mp3", ".wav"}


def _db() -> sqlite3.Connection:
    CREATIVE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """create table if not exists jobs (
             id text primary key,
             kind text not null,
             brief text not null,
             spec_id text,
             brand_rev integer,
             inputs text not null default '[]',
             state text not null default 'queued',
             progress real not null default 0,
             cost_estimate real,
             cost_actual real,
             error text,
             retriable integer not null default 0,
             pid integer,
             created_at real not null,
             updated_at real not null
           )"""
    )
    conn.execute(
        """create table if not exists assets (
             id text primary key,
             job_id text,
             kind text not null,
             path text not null,
             w integer,
             h integer,
             duration real,
             bytes integer not null,
             sha256 text not null,
             spec_conformance text not null default '[]',
             created_at real not null
           )"""
    )
    conn.execute(
        """create table if not exists packages (
             id text primary key,
             caption text,
             hashtags text not null default '[]',
             media_asset_ids text not null default '[]',
             platform_settings text not null default '{}',
             created_at real not null
           )"""
    )
    return conn


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _reconcile_on_startup() -> None:
    """Fail `running` jobs whose process died while the box slept (CM1 task 2)."""
    conn = _db()
    try:
        rows = conn.execute("select id, pid from jobs where state = 'running'").fetchall()
        for row in rows:
            pid = row["pid"]
            if pid is None or not _pid_alive(pid):
                conn.execute(
                    "update jobs set state='failed', retriable=1, "
                    "error='render process lost across a box stop/resume — retry', "
                    "updated_at=? where id=?",
                    (time.time(), row["id"]),
                )
        conn.commit()
    finally:
        conn.close()


_reconcile_on_startup()


class JobRequest(BaseModel):
    kind: str
    brief: str = Field(min_length=1, max_length=8000)
    spec_id: str | None = None
    brand_rev: int | None = None
    inputs: list[str] = Field(default_factory=list, max_length=32)


class VariantRequest(BaseModel):
    """Ratio/duration variants a spec demands, derived from one master."""

    ratios: list[str] = Field(default_factory=list)  # e.g. ["1:1", "9:16"]


def _launch(job_id: str, kind: str, brief: str, inputs: list[str]) -> int:
    """Shell the genmedia skill via the Hermes CLI (CM1 task 3)."""
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    prompt = (
        f"Use the {kind} genmedia skill. Write every rendered output file into "
        f"{job_dir}. Brief: {brief}"
    )
    if inputs:
        prompt += f" Input references: {json.dumps(inputs)}"
    log_path = job_dir / "job.log"
    exit_path = job_dir / "exit_code"
    # A thin sh wrapper records the render's exit status to exit_code so
    # _refresh_job_state can distinguish a successful run from a crash that
    # left partial output behind.
    script = (
        f"{shlex.quote(HERMES_BIN)} run {shlex.quote(prompt)}; "
        f"echo $? > {shlex.quote(str(exit_path))}"
    )
    with open(log_path, "ab") as log:
        process = subprocess.Popen(
            ["/bin/sh", "-c", script],
            stdout=log,
            stderr=log,
            cwd=str(job_dir),
            start_new_session=True,
        )
    return process.pid


def _register_outputs(conn: sqlite3.Connection, job_id: str) -> list[str]:
    job_dir = JOBS_DIR / job_id
    asset_ids: list[str] = []
    if not job_dir.is_dir():
        return asset_ids
    for path in sorted(job_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in MEDIA_EXTENSIONS:
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        existing = conn.execute(
            "select id from assets where sha256=? and job_id=?", (digest, job_id)
        ).fetchone()
        if existing:
            asset_ids.append(existing["id"])
            continue
        asset_id = uuid.uuid4().hex
        stored = ASSETS_DIR / asset_id / path.name
        stored.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, stored)
        width, height, duration = _probe(stored)
        conn.execute(
            "insert into assets (id, job_id, kind, path, w, h, duration, bytes, "
            "sha256, spec_conformance, created_at) values (?,?,?,?,?,?,?,?,?,?,?)",
            (
                asset_id,
                job_id,
                stored.suffix.lstrip(".").lower(),
                str(stored),
                width,
                height,
                duration,
                stored.stat().st_size,
                digest,
                "[]",
                time.time(),
            ),
        )
        asset_ids.append(asset_id)
    return asset_ids


def _probe(path: Path) -> tuple[int | None, int | None, float | None]:
    """Best-effort dimensions/duration via ffprobe; media stays usable without."""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None, None, None
    try:
        out = subprocess.run(
            [
                ffprobe,
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                "-show_format",
                str(path),
            ],
            capture_output=True,
            timeout=30,
            check=True,
        )
        info = json.loads(out.stdout)
        stream = next(
            (s for s in info.get("streams", []) if s.get("width")), None
        )
        duration_raw = info.get("format", {}).get("duration")
        duration = float(duration_raw) if duration_raw else None
        if stream:
            return int(stream["width"]), int(stream["height"]), duration
        return None, None, duration
    except (subprocess.SubprocessError, ValueError, KeyError):
        return None, None, None


def _refresh_job_state(conn: sqlite3.Connection, row: sqlite3.Row) -> sqlite3.Row:
    """Poll the render process: done when it exits 0, failed otherwise."""
    if row["state"] != "running":
        return row
    pid = row["pid"]
    if pid is not None and _pid_alive(pid):
        return row
    job_dir = JOBS_DIR / row["id"]
    exit_path = job_dir / "exit_code"
    exit_code = None
    if exit_path.is_file():
        try:
            exit_code = int(exit_path.read_text().strip())
        except ValueError:
            exit_code = None
    outputs = _register_outputs(conn, row["id"])
    if outputs and exit_code == 0:
        conn.execute(
            "update jobs set state='done', progress=1, updated_at=? where id=?",
            (time.time(), row["id"]),
        )
    else:
        conn.execute(
            "update jobs set state='failed', retriable=1, "
            "error='render exited unsuccessfully — retry', "
            "updated_at=? where id=?",
            (time.time(), row["id"]),
        )
    conn.commit()
    return conn.execute("select * from jobs where id=?", (row["id"],)).fetchone()


def _job_payload(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    outputs = [
        dict(r)
        for r in conn.execute(
            "select id, kind, w, h, duration, bytes, sha256 from assets where job_id=?",
            (row["id"],),
        ).fetchall()
    ]
    return {
        "job_id": row["id"],
        "kind": row["kind"],
        "state": row["state"],
        "progress": row["progress"],
        "cost_estimate": row["cost_estimate"],
        "cost_actual": row["cost_actual"],
        "outputs": outputs,
        "error": row["error"],
        "retriable": bool(row["retriable"]),
    }


@router.post("/jobs")
def submit_job(body: JobRequest) -> dict:
    if body.kind not in JOB_KINDS:
        raise HTTPException(400, f"unknown job kind {body.kind!r}")
    job_id = uuid.uuid4().hex
    now = time.time()
    conn = _db()
    try:
        pid = _launch(job_id, body.kind, body.brief, body.inputs)
        conn.execute(
            "insert into jobs (id, kind, brief, spec_id, brand_rev, inputs, state, "
            "progress, cost_estimate, pid, created_at, updated_at) "
            "values (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                job_id,
                body.kind,
                body.brief,
                body.spec_id,
                body.brand_rev,
                json.dumps(body.inputs),
                "running",
                0.0,
                COST_ESTIMATES_USD[body.kind],
                pid,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"job_id": job_id, "cost_estimate": COST_ESTIMATES_USD[body.kind]}


@router.get("/jobs")
def list_jobs(stats: int = 0) -> dict:
    conn = _db()
    try:
        if stats:
            counts = {
                row["state"]: row["n"]
                for row in conn.execute(
                    "select state, count(*) as n from jobs group by state"
                ).fetchall()
            }
            last_error = conn.execute(
                "select error from jobs where error is not null "
                "order by updated_at desc limit 1"
            ).fetchone()
            usage = shutil.disk_usage(str(HOME))
            return {
                "queued": counts.get("queued", 0),
                "running": counts.get("running", 0),
                "done": counts.get("done", 0),
                "failed": counts.get("failed", 0),
                "cancelled": counts.get("cancelled", 0),
                "disk_free_gb": round(usage.free / 1e9, 1),
                "last_error": last_error["error"] if last_error else None,
                "plugin_version": PLUGIN_VERSION,
            }
        rows = conn.execute(
            "select * from jobs order by created_at desc limit 100"
        ).fetchall()
        return {"jobs": [_job_payload(conn, row) for row in rows]}
    finally:
        conn.close()


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    conn = _db()
    try:
        row = conn.execute("select * from jobs where id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "job not found")
        row = _refresh_job_state(conn, row)
        return _job_payload(conn, row)
    finally:
        conn.close()


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict:
    conn = _db()
    try:
        row = conn.execute("select * from jobs where id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "job not found")
        if row["state"] in ("done", "failed", "cancelled"):
            return {"job_id": job_id, "state": row["state"]}
        pid = row["pid"]
        if pid is not None and _pid_alive(pid):
            # The whole render process group: renders are the most expensive
            # thing the box does.
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        conn.execute(
            "update jobs set state='cancelled', updated_at=? where id=?",
            (time.time(), job_id),
        )
        conn.commit()
        return {"job_id": job_id, "state": "cancelled"}
    finally:
        conn.close()


@router.get("/assets")
def list_assets(offset: int = 0, limit: int = 50) -> dict:
    limit = max(1, min(limit, 200))
    conn = _db()
    try:
        rows = conn.execute(
            "select id, kind, w, h, duration, bytes, sha256, spec_conformance "
            "from assets order by created_at desc limit ? offset ?",
            (limit, offset),
        ).fetchall()
        assets = []
        for row in rows:
            item = dict(row)
            item["spec_conformance"] = json.loads(item["spec_conformance"])
            assets.append(item)
        total = conn.execute("select count(*) as n from assets").fetchone()["n"]
        return {"assets": assets, "total": total, "offset": offset, "limit": limit}
    finally:
        conn.close()


@router.get("/assets/{asset_id}/bytes")
def asset_bytes(asset_id: str) -> FileResponse:
    """Streamed master bytes. Only ever called server-to-server by the
    control plane's lib/assets (C3, C16) — this path is deliberately not in
    the browser-facing proxy allowlist."""
    conn = _db()
    try:
        row = conn.execute(
            "select path from assets where id=?", (asset_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row or not Path(row["path"]).is_file():
        raise HTTPException(404, "asset not found")
    return FileResponse(row["path"])


@router.post("/assets/{asset_id}/variants")
def derive_variants(asset_id: str, body: VariantRequest) -> dict:
    conn = _db()
    try:
        row = conn.execute("select * from assets where id=?", (asset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "asset not found")
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise HTTPException(503, "ffmpeg unavailable")
        created = []
        for ratio in body.ratios:
            try:
                w_part, h_part = ratio.split(":")
                ratio_w, ratio_h = int(w_part), int(h_part)
            except ValueError:
                raise HTTPException(400, f"bad ratio {ratio!r}") from None
            if not (1 <= ratio_w <= 32 and 1 <= ratio_h <= 32):
                raise HTTPException(400, f"ratio out of range {ratio!r}")
            source = Path(row["path"])
            variant_id = uuid.uuid4().hex
            out_path = ASSETS_DIR / variant_id / source.name
            out_path.parent.mkdir(parents=True, exist_ok=True)
            crop = (
                f"crop=min(iw\\,ih*{ratio_w}/{ratio_h}):"
                f"min(ih\\,iw*{ratio_h}/{ratio_w})"
            )
            result = subprocess.run(
                [ffmpeg, "-y", "-i", str(source), "-vf", crop, str(out_path)],
                capture_output=True,
                timeout=600,
            )
            if result.returncode != 0 or not out_path.is_file():
                raise HTTPException(502, f"variant render failed for {ratio}")
            width, height, duration = _probe(out_path)
            conn.execute(
                "insert into assets (id, job_id, kind, path, w, h, duration, bytes, "
                "sha256, spec_conformance, created_at) values (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    variant_id,
                    row["job_id"],
                    row["kind"],
                    str(out_path),
                    width,
                    height,
                    duration,
                    out_path.stat().st_size,
                    hashlib.sha256(out_path.read_bytes()).hexdigest(),
                    "[]",
                    time.time(),
                ),
            )
            created.append({"id": variant_id, "ratio": ratio})
        conn.commit()
        return {"variants": created}
    finally:
        conn.close()


@router.get("/packages/{package_id}")
def get_package(package_id: str) -> dict:
    conn = _db()
    try:
        row = conn.execute(
            "select * from packages where id=?", (package_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "package not found")
        return {
            "id": row["id"],
            "caption": row["caption"],
            "hashtags": json.loads(row["hashtags"]),
            "media_asset_ids": json.loads(row["media_asset_ids"]),
            "platform_settings": json.loads(row["platform_settings"]),
        }
    finally:
        conn.close()


@router.get("/brand")
def get_brand() -> dict:
    """The compiled brand this box currently holds (CM0 mirror artifacts)."""
    themes_dir = HOME / ".hermes" / "dashboard-themes"
    brand_md = HOME / "BRAND.md"
    themes = []
    if themes_dir.is_dir():
        for theme in sorted(themes_dir.glob("*.yaml")):
            themes.append(
                {
                    "name": theme.stem,
                    "sha256": hashlib.sha256(theme.read_bytes()).hexdigest(),
                    "updated_at": theme.stat().st_mtime,
                }
            )
    return {
        "themes": themes,
        "brand_md_sha256": (
            hashlib.sha256(brand_md.read_bytes()).hexdigest()
            if brand_md.is_file()
            else None
        ),
        "brand_md_updated_at": brand_md.stat().st_mtime if brand_md.is_file() else None,
        "plugin_version": PLUGIN_VERSION,
    }
