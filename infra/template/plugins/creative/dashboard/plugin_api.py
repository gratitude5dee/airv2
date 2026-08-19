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
EXPORTS_DIR = CREATIVE_DIR / "exports"
DB_PATH = CREATIVE_DIR / "creative.db"


def _default_hermes_bin() -> str:
    candidates = [
        HOME / ".hermes-venv" / "bin" / "hermes",
        HOME / "hermes-agent" / ".venv" / "bin" / "hermes",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return "hermes"


HERMES_BIN = os.environ.get("CREATIVE_HERMES_BIN") or _default_hermes_bin()
PLUGIN_VERSION = "0.3.0"

JOB_KINDS = {
    "commercial",
    "marketing",
    "ugc",
    "cinematography",
    "ad_asset_group",
    "video_render",
}

# Coarse pre-run spend estimates in USD by job kind (CM1 task 4). The control
# plane enforces the cap; these make enforcement possible by being stated
# before work starts. Actuals are recorded from the skill run when available.
COST_ESTIMATES_USD = {
    "commercial": 4.0,
    "marketing": 1.5,
    "ugc": 2.0,
    "cinematography": 6.0,
    # One concept fully built plus two alternates at hero ratio (CM5 task 6).
    "ad_asset_group": 8.0,
    # Deterministic ffmpeg timeline assembly (MA7 #7) — compute only, no
    # provider spend, but still metered through the same job/cost ledgers.
    "video_render": 0.1,
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
        """create table if not exists ad_groups (
             job_id text primary key,
             spec_id text not null,
             brand_rev integer,
             headlines text not null default '[]',
             long_headlines text not null default '[]',
             descriptions text not null default '[]',
             final_url text,
             image_asset_ids text not null default '[]',
             logo_asset_ids text not null default '[]',
             video_asset_ids text not null default '[]',
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
    # The full machine-readable spec for the placement (control plane's
    # AD_SPECS entry) — the generator must know the exact ratios, counts, and
    # character limits it is being graded against.
    spec: dict | None = None
    brand_rev: int | None = None
    inputs: list[str] = Field(default_factory=list, max_length=32)
    # video_render only: {clips: [{asset_id, trim_start, trim_end, caption}],
    # audio_asset_id} — asset ids are resolved to box paths at submit time.
    timeline: dict | None = None


class VariantRequest(BaseModel):
    """Ratio/duration variants a spec demands, derived from one master."""

    ratios: list[str] = Field(default_factory=list)  # e.g. ["1:1", "9:16"]


RENDER_VIDEO_SCRIPT = Path(__file__).with_name("render_video.py")

MAX_TIMELINE_CLIPS = 50


def _resolve_timeline(conn: sqlite3.Connection, timeline: dict) -> dict:
    """Validate a video_render timeline and resolve asset ids to box paths.

    Raises HTTPException(400) on any malformed or unknown reference — a
    render never starts against assets that don't exist.
    """
    clips = timeline.get("clips")
    if not isinstance(clips, list) or not clips:
        raise HTTPException(400, "timeline requires at least one clip")
    if len(clips) > MAX_TIMELINE_CLIPS:
        raise HTTPException(400, f"timeline exceeds {MAX_TIMELINE_CLIPS} clips")

    def asset_path(asset_id: object) -> str:
        if not isinstance(asset_id, str) or not asset_id:
            raise HTTPException(400, "timeline asset id malformed")
        row = conn.execute(
            "select path from assets where id=?", (asset_id,)
        ).fetchone()
        if not row or not Path(row["path"]).is_file():
            raise HTTPException(400, f"timeline references unknown asset {asset_id!r}")
        return row["path"]

    resolved_clips = []
    for clip in clips:
        if not isinstance(clip, dict):
            raise HTTPException(400, "timeline clip malformed")
        trim_start = clip.get("trim_start", 0)
        trim_end = clip.get("trim_end", 0)
        if not isinstance(trim_start, (int, float)) or not isinstance(
            trim_end, (int, float)
        ) or trim_start < 0 or trim_end < 0:
            raise HTTPException(400, "timeline trims malformed")
        caption = clip.get("caption", "")
        if not isinstance(caption, str) or len(caption) > 200:
            raise HTTPException(400, "timeline caption malformed")
        resolved_clips.append(
            {
                "path": asset_path(clip.get("asset_id")),
                "trim_start": float(trim_start),
                "trim_end": float(trim_end),
                "caption": caption,
            }
        )
    resolved: dict = {"clips": resolved_clips}
    audio_asset_id = timeline.get("audio_asset_id")
    if audio_asset_id is not None:
        resolved["audio_path"] = asset_path(audio_asset_id)
    return resolved


def _launch_video_render(job_id: str, resolved_timeline: dict) -> int:
    """Run the deterministic ffmpeg timeline renderer (MA7 #7) in the box.

    Same exit_code convention as skill jobs so _refresh_job_state treats it
    identically; output lands in the job dir and is registered as an asset.
    """
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "timeline.json").write_text(json.dumps(resolved_timeline))
    log_path = job_dir / "job.log"
    exit_path = job_dir / "exit_code"
    script = (
        f"python3 {shlex.quote(str(RENDER_VIDEO_SCRIPT))} "
        f"{shlex.quote(str(job_dir))}; "
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


def _launch(
    job_id: str,
    kind: str,
    brief: str,
    inputs: list[str],
    spec_id: str | None = None,
    spec: dict | None = None,
) -> int:
    """Shell the genmedia skill via the Hermes CLI (CM1 task 3)."""
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    if kind == "ad_asset_group":
        # CM5: one job, one complete asset group. Master-and-derive — render
        # the hero at highest fidelity, then recompose (reframe, don't
        # center-crop) into the other ratios. group.json is the contract; a
        # missing or partial file fails the job rather than shipping a
        # partial group.
        prompt = (
            f"Use the marketing genmedia skill to build a complete ad asset "
            f"group. Write every rendered file into {job_dir}. Render one "
            f"hero master at the highest fidelity, then derive the other "
            f"required ratios by intentional recomposition — reframe the "
            f"subject, never center-crop. Also write {job_dir}/group.json "
            f"with keys: headlines, long_headlines, descriptions (arrays of "
            f"strings), final_url (string), image_files, logo_files, "
            f"video_files (arrays of output filenames relative to the job "
            f"directory). Offer/brief: {brief}"
        )
        if spec_id:
            prompt += f" Target placement spec: {spec_id}."
        if spec:
            prompt += (
                f" The group must satisfy every constraint in this spec "
                f"(ratios, asset counts, text counts, character limits): "
                f"{json.dumps(spec)}"
            )
    else:
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
    if outputs and exit_code == 0 and row["kind"] == "ad_asset_group":
        error = _register_ad_group(conn, row)
        if error:
            conn.execute(
                "update jobs set state='failed', retriable=1, error=?, "
                "updated_at=? where id=?",
                (error, time.time(), row["id"]),
            )
            conn.commit()
            return conn.execute(
                "select * from jobs where id=?", (row["id"],)
            ).fetchone()
        conn.execute(
            "update jobs set state='done', progress=1, updated_at=? where id=?",
            (time.time(), row["id"]),
        )
    elif outputs and exit_code == 0:
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


def _resolve_group_files(
    conn: sqlite3.Connection, job_id: str, names: list
) -> list[str] | None:
    """Map group.json filenames to registered asset ids by stored name."""
    if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
        return None
    rows = conn.execute(
        "select id, path from assets where job_id=?", (job_id,)
    ).fetchall()
    by_name = {Path(r["path"]).name: r["id"] for r in rows}
    ids = []
    for name in names:
        asset_id = by_name.get(Path(name).name)
        if asset_id is None:
            return None
        ids.append(asset_id)
    return ids


def _register_ad_group(conn: sqlite3.Connection, row: sqlite3.Row) -> str | None:
    """Parse group.json into ad_groups. Any missing piece is a job failure
    (CM5 task 2), never a partial success discovered at upload."""
    group_path = JOBS_DIR / row["id"] / "group.json"
    if not group_path.is_file():
        return "asset group incomplete: group.json missing — retry"
    try:
        group = json.loads(group_path.read_text())
    except ValueError:
        return "asset group incomplete: group.json unparseable — retry"
    text_fields = {}
    for key in ("headlines", "long_headlines", "descriptions"):
        values = group.get(key, [])
        if not isinstance(values, list) or not all(
            isinstance(v, str) for v in values
        ):
            return f"asset group incomplete: {key} malformed — retry"
        text_fields[key] = values
    if not text_fields["headlines"] or not text_fields["descriptions"]:
        return "asset group incomplete: headlines/descriptions empty — retry"
    resolved = {}
    for key in ("image_files", "logo_files", "video_files"):
        ids = _resolve_group_files(conn, row["id"], group.get(key, []))
        if ids is None:
            return f"asset group incomplete: {key} references unknown files — retry"
        resolved[key] = ids
    if not resolved["image_files"] and not resolved["video_files"]:
        return "asset group incomplete: no media — retry"
    final_url = group.get("final_url")
    if final_url is not None and not isinstance(final_url, str):
        return "asset group incomplete: final_url malformed — retry"
    conn.execute(
        "insert or replace into ad_groups (job_id, spec_id, brand_rev, "
        "headlines, long_headlines, descriptions, final_url, image_asset_ids, "
        "logo_asset_ids, video_asset_ids, created_at) "
        "values (?,?,?,?,?,?,?,?,?,?,?)",
        (
            row["id"],
            row["spec_id"] or "",
            row["brand_rev"],
            json.dumps(text_fields["headlines"]),
            json.dumps(text_fields["long_headlines"]),
            json.dumps(text_fields["descriptions"]),
            final_url,
            json.dumps(resolved["image_files"]),
            json.dumps(resolved["logo_files"]),
            json.dumps(resolved["video_files"]),
            time.time(),
        ),
    )
    return None


@router.post("/jobs")
def submit_job(body: JobRequest) -> dict:
    if body.kind not in JOB_KINDS:
        raise HTTPException(400, f"unknown job kind {body.kind!r}")
    if body.kind == "ad_asset_group" and not body.spec_id:
        raise HTTPException(400, "ad_asset_group requires spec_id")
    if body.kind == "video_render" and body.timeline is None:
        raise HTTPException(400, "video_render requires a timeline")
    job_id = uuid.uuid4().hex
    now = time.time()
    conn = _db()
    try:
        if body.kind == "video_render":
            assert body.timeline is not None
            resolved = _resolve_timeline(conn, body.timeline)
            pid = _launch_video_render(job_id, resolved)
        else:
            pid = _launch(
                job_id, body.kind, body.brief, body.inputs, body.spec_id, body.spec
            )
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


# Formats where a metadata-stripping stream copy is reliable; anything image
# shaped is re-encoded instead (EXIF/XMP segments survive naive edits).
_COPY_SAFE_EXTENSIONS = {".mp4", ".mov", ".mp3", ".wav"}


def _export_path(asset_id: str, source: Path) -> Path:
    return EXPORTS_DIR / asset_id / source.name


@router.post("/assets/{asset_id}/export")
def export_asset(asset_id: str) -> dict:
    """Produce a metadata-stripped copy of the master (CC4): EXIF, GPS, XMP,
    and container metadata are removed before the bytes ever leave the box.
    Images are re-encoded; av containers get a stream copy with metadata and
    chapters dropped. Idempotent per asset — re-export overwrites."""
    conn = _db()
    try:
        row = conn.execute(
            "select path from assets where id=?", (asset_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row or not Path(row["path"]).is_file():
        raise HTTPException(404, "asset not found")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(503, "ffmpeg unavailable")
    source = Path(row["path"])
    out_path = _export_path(asset_id, source)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    args = [ffmpeg, "-y", "-i", str(source), "-map_metadata", "-1"]
    if source.suffix.lower() in _COPY_SAFE_EXTENSIONS:
        args += ["-map_chapters", "-1", "-c", "copy"]
    args += ["-fflags", "+bitexact", str(out_path)]
    result = subprocess.run(args, capture_output=True, timeout=600)
    if result.returncode != 0 or not out_path.is_file():
        raise HTTPException(502, "export failed")
    return {
        "asset_id": asset_id,
        "sha256": hashlib.sha256(out_path.read_bytes()).hexdigest(),
        "bytes": out_path.stat().st_size,
        "ext": out_path.suffix.lstrip(".").lower(),
    }


@router.get("/assets/{asset_id}/export/bytes")
def export_bytes(asset_id: str) -> FileResponse:
    """Streamed stripped bytes. Only ever called server-to-server by the
    control plane's lib/assets (C3, C16) — not in the browser proxy
    allowlist."""
    conn = _db()
    try:
        row = conn.execute(
            "select path from assets where id=?", (asset_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "asset not found")
    out_path = _export_path(asset_id, Path(row["path"]))
    if not out_path.is_file():
        raise HTTPException(404, "export not found — POST export first")
    return FileResponse(out_path)


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
                    # A blind center crop can't know where the subject is —
                    # every crop-derived variant is flagged for human review
                    # (CM5 task 3) rather than trusted into a group.
                    json.dumps(
                        [{"slot": ratio, "method": "center-crop", "review": True}]
                    ),
                    time.time(),
                ),
            )
            created.append({"id": variant_id, "ratio": ratio, "review": True})
        conn.commit()
        return {"variants": created}
    finally:
        conn.close()


@router.get("/ad-groups/{job_id}")
def get_ad_group(job_id: str) -> dict:
    """The completed asset group for a job: linted text plus asset ids by
    role. Conformance against the placement spec is computed control-plane
    side, where the spec registry lives."""
    conn = _db()
    try:
        row = conn.execute(
            "select * from ad_groups where job_id=?", (job_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "ad group not found")
        asset_ids = (
            json.loads(row["image_asset_ids"])
            + json.loads(row["logo_asset_ids"])
            + json.loads(row["video_asset_ids"])
        )
        assets = []
        for asset_id in asset_ids:
            asset = conn.execute(
                "select id, kind, w, h, duration, bytes, sha256 from assets "
                "where id=?",
                (asset_id,),
            ).fetchone()
            if asset:
                assets.append(dict(asset))
        return {
            "job_id": row["job_id"],
            "spec_id": row["spec_id"],
            "brand_rev": row["brand_rev"],
            "headlines": json.loads(row["headlines"]),
            "long_headlines": json.loads(row["long_headlines"]),
            "descriptions": json.loads(row["descriptions"]),
            "final_url": row["final_url"],
            "image_asset_ids": json.loads(row["image_asset_ids"]),
            "logo_asset_ids": json.loads(row["logo_asset_ids"]),
            "video_asset_ids": json.loads(row["video_asset_ids"]),
            "assets": assets,
        }
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
