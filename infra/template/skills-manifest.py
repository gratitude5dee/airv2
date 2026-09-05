#!/usr/bin/env python3
"""Write ~/.hermes/.template-skills: the base skills that are really on disk.

Usage: skills-manifest.py HOME_DIR BASE_SKILLS_FILE

`hermes skills install` exits 0 whether or not anything landed (no exact match,
hub fetch rate-limited, quarantined by the scanner), so its exit code cannot be
the record of a baked skill. A skill counts only when the hub lockfile has an
entry for its identifier whose install path holds a SKILL.md, or — for skills
Hermes ships as builtins and never records in the lockfile — when a directory
named after the identifier's last segment holds a SKILL.md. Provisioning trusts
this file to skip installs on a fork, so it must never over-report.
"""
import json
import os
import sys


def read_list(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#"):
                yield line


def lock_entries(skills_dir):
    lock = os.path.join(skills_dir, ".hub", "lock.json")
    try:
        with open(lock, encoding="utf-8") as fh:
            installed = json.load(fh).get("installed", {})
    except (OSError, ValueError):
        return {}
    by_identifier = {}
    for entry in installed.values():
        if not isinstance(entry, dict):
            continue
        identifier = entry.get("identifier")
        install_path = entry.get("install_path")
        if isinstance(identifier, str) and isinstance(install_path, str):
            by_identifier[identifier] = install_path
    return by_identifier


def has_skill_md(skills_dir, rel):
    return os.path.isfile(os.path.join(skills_dir, rel, "SKILL.md"))


def builtin_dir(skills_dir, name):
    for root, dirs, _files in os.walk(skills_dir):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        if root[len(skills_dir):].count(os.sep) >= 2:
            dirs[:] = []
        if name in dirs and has_skill_md(root, name):
            return True
    return False


def main():
    home, list_path = sys.argv[1], sys.argv[2]
    skills_dir = os.path.join(home, ".hermes", "skills")
    locked = lock_entries(skills_dir)
    present = []
    for identifier in read_list(list_path):
        install_path = locked.get(identifier)
        if install_path is not None and has_skill_md(skills_dir, install_path):
            present.append(identifier)
        elif builtin_dir(skills_dir, identifier.rsplit("/", 1)[-1]):
            present.append(identifier)
        else:
            print(f"WARN: base skill {identifier} is not on disk", file=sys.stderr)
    manifest = os.path.join(home, ".hermes", ".template-skills")
    with open(manifest + ".tmp", "w", encoding="utf-8") as fh:
        fh.write("".join(f"{s}\n" for s in present))
    os.replace(manifest + ".tmp", manifest)
    print(f"template skills: {len(present)} baked")


if __name__ == "__main__":
    main()
