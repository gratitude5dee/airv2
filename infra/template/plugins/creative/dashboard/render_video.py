"""Deterministic timeline renderer for `video_render` jobs (V9 MA7 #7).

Reads `<job_dir>/timeline.json` (written by plugin_api.submit_job with asset
ids already resolved to box-local paths), normalizes every clip to 1080p30
with ffmpeg, concatenates, and muxes the optional audio track. The output
lands as `<job_dir>/out.mp4` so plugin_api._register_outputs picks it up —
render bytes never leave the box except through the existing export lane.

Runs as a plain subprocess (same exit_code convention as skill jobs); any
failure exits non-zero with the reason on stderr, which plugin_api surfaces
as an honest, retriable job error.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

WIDTH, HEIGHT, FPS = 1920, 1080, 30

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _font() -> str | None:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).is_file():
            return candidate
    return None


def _run(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, timeout=1800)
    if result.returncode != 0:
        tail = result.stderr.decode(errors="replace")[-2000:]
        raise RuntimeError(f"ffmpeg failed ({result.returncode}): {tail}")


def main(job_dir: Path) -> int:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("ffmpeg is not installed in this box", file=sys.stderr)
        return 2
    timeline = json.loads((job_dir / "timeline.json").read_text())
    clips = timeline.get("clips", [])
    if not clips:
        print("timeline has no clips", file=sys.stderr)
        return 2
    font = _font()
    work = job_dir / "work"
    work.mkdir(exist_ok=True)
    parts: list[Path] = []
    for index, clip in enumerate(clips):
        src = Path(clip["path"])
        if not src.is_file():
            print(f"clip source missing: {src}", file=sys.stderr)
            return 2
        part = work / f"part{index:03d}.mp4"
        filters = (
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2,fps={FPS},format=yuv420p"
        )
        caption = str(clip.get("caption") or "")
        if caption and font:
            # Caption text must only ever reach ffmpeg via textfile= — the
            # filter graph string contains fixed internal paths, never user
            # text, so captions cannot alter the filter structure.
            text_file = work / f"caption{index:03d}.txt"
            text_file.write_text(caption)
            filters += (
                f",drawtext=fontfile={font}:textfile={text_file}"
                f":fontsize=56:fontcolor=white:borderw=3:bordercolor=black"
                f":x=(w-text_w)/2:y=h-th-80"
            )
        args = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
        trim_start = float(clip.get("trim_start") or 0)
        trim_end = float(clip.get("trim_end") or 0)
        if trim_start > 0:
            args += ["-ss", str(trim_start)]
        if trim_end > trim_start:
            args += ["-to", str(trim_end)]
        args += [
            "-i", str(src),
            "-vf", filters,
            "-an",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "20",
            str(part),
        ]
        _run(args)
        parts.append(part)
    concat_list = work / "concat.txt"
    concat_list.write_text(
        "".join(f"file '{p.as_posix()}'\n" for p in parts)
    )
    silent = work / "silent.mp4"
    _run(
        [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c", "copy", str(silent),
        ]
    )
    out = job_dir / "out.mp4"
    audio = timeline.get("audio_path")
    if audio and Path(audio).is_file():
        _run(
            [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(silent), "-i", str(audio),
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy", "-c:a", "aac", "-shortest",
                str(out),
            ]
        )
    else:
        shutil.move(str(silent), str(out))
    shutil.rmtree(work, ignore_errors=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(Path(sys.argv[1])))
    except Exception as exc:  # noqa: BLE001 — exit_code file is the contract
        print(f"video render failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
