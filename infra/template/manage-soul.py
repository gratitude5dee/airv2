#!/usr/bin/env python3
"""Reconcile only template-owned instructions; preserve custom SOUL content."""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import tempfile

ROOT = Path(__file__).resolve().parent
START = "<!-- air:managed-soul:start -->"
END = "<!-- air:managed-soul:end -->"


def managed_block():
    return START + "\n" + (ROOT / "soul-managed.md").read_text().strip() + "\n" + END


def reconcile(source):
    starts, ends = source.count(START), source.count(END)
    if starts != ends or starts > 1:
        raise ValueError("malformed managed SOUL boundaries; repair before syncing")
    if starts:
        before, rest = source.split(START, 1)
        if END not in rest:
            raise ValueError("managed SOUL end precedes start")
        _, after = rest.split(END, 1)
        return before + managed_block() + after

    # Match complete historical template text only. Owner-edited sections
    # are deliberately retained rather than guessed at from their headings.
    legacy = json.loads((ROOT / "soul-legacy.json").read_text())
    remainder = source
    for block in sorted(legacy, key=len, reverse=True):
        remainder = re.sub(r"(?m)^" + re.escape(block.strip()) + r"(?=\n|$)", "", remainder)
    return managed_block() + "\n\n" + remainder


def apply(path, check=False):
    if path.is_symlink():
        raise ValueError("refusing to replace a symlinked SOUL file")
    source = path.read_text() if path.exists() else ""
    if check:
        if source.count(START) != 1 or source.count(END) != 1 or managed_block() not in source:
            raise ValueError("managed SOUL is missing or out of date")
        return
    result = reconcile(source)
    if result == source:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o600
    # Keep the exact pre-migration file locally; never persist its contents
    # in the control-plane database or logs.
    backup = path.with_name(path.name + ".before-air-managed")
    if source and START not in source and not backup.exists():
        with backup.open("x") as file:
            os.chmod(backup, 0o600)
            file.write(source)
            file.flush()
            os.fsync(file.fileno())
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as file:
            temporary = Path(file.name)
            os.chmod(temporary, mode)
            file.write(result)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    apply(args.path, args.check)
