#!/usr/bin/env bash
# R-LED-02: every commit on a PR must name at least one ledger finding ID
# (an R-ID like R-CI-01, or a September-review ID like LAT-01) in its
# subject or body. Merge and chore: commits are exempt.
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
ID_PATTERN='R-[A-Z][A-Z0-9]*-[0-9]+|MEM-[0-9]+|LAT-[0-9]+|WEB-[0-9]+|MS-[0-9]+|TC-[0-9]+|WZ-[0-9]+|SOC-[0-9]+|BOX-[0-9]+|CA-[0-9]+'

missing=()
while read -r sha; do
  # Skip merge commits (more than one parent).
  parents=$(git rev-list --parents -n 1 "$sha" | wc -w)
  [ "$parents" -gt 2 ] && continue
  subject=$(git log -1 --format=%s "$sha")
  # Skip chore commits.
  if grep -Eq '^chore(\(|:)' <<<"$subject"; then
    continue
  fi
  if ! git log -1 --format=%s%n%b "$sha" | grep -Eq "$ID_PATTERN"; then
    missing+=("$sha $subject")
  fi
done < <(git log --format=%H "${BASE_REF}..HEAD")

if ((${#missing[@]})); then
  echo "Commits missing a finding ID (R-ID or ledger ID) in subject or body:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo "Add one (e.g. \"R-TQ-03: ...\" or \"LAT-01: ...\") or prefix the commit with chore:." >&2
  exit 1
fi
echo "All commits name a finding ID."
