"""Test path setup: make the plugin modules and this dir importable.

These tests run against the pinned Hermes checkout (the box venv, or any
environment with ``hermes-agent`` installed). Suites that need the Hermes
contract modules ``importorskip`` them so a bare environment skips instead
of erroring.
"""

import sys
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parents[1]
TESTS_DIR = Path(__file__).resolve().parent

for path in (str(PLUGIN_DIR), str(TESTS_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)
