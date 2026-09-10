#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.air"
command_path="$(bash -lc 'printf "%s" "$PATH"')"
target="$(mktemp "$HOME/.air/command-env.XXXXXX")"
printf 'export PATH=%q\n' "$command_path" > "$target"
mv "$target" "$HOME/.air/command-env.sh"
