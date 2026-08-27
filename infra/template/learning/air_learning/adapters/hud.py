"""HUD adapter (goal.md §11.1) — lands in M5.

Pinned target: hud==0.6.13. Until the signed frozen release ships, this
adapter is a typed unavailability, not a silent skip (L13). When enabled it
must set HUD_TELEMETRY_ENABLED=0, HUD_CLI_ANALYTICS_ENABLED=0,
HUD_FILE_TRACKING_ENABLED=false, HUD_TELEMETRY_LOCAL_DIR=<learning spans>,
persist no HUD_API_KEY, and bind all channels to loopback (L8).
"""

from __future__ import annotations

from . import AdapterError

ADAPTER_VERSION = "hud/unavailable"

REQUIRED_ENV = {
    "HUD_TELEMETRY_ENABLED": "0",
    "HUD_CLI_ANALYTICS_ENABLED": "0",
    "HUD_FILE_TRACKING_ENABLED": "false",
}


class HudAdapterError(AdapterError):
    error_class = "backend_unavailable"


def run_experiment(spec: dict) -> dict:
    raise HudAdapterError("HUD adapter ships in M5 (pinned hud==0.6.13); backend unavailable")
