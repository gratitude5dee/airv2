"""Harbor adapter (goal.md §11.2) — lands in M6.

Pinned target: harbor==0.22.0. Policy: HARBOR_TELEMETRY=off; `harbor
upload`, `--upload`, `--launch`, Hub credentials, and registry publication
are denied for owner-derived data (L8). Verifiers emit only
/logs/verifier/reward.json — never reward.txt alongside it; the adapter
contract test owns that precedence. Until then: typed unavailability.
"""

from __future__ import annotations

from . import AdapterError

ADAPTER_VERSION = "harbor/unavailable"

REQUIRED_ENV = {"HARBOR_TELEMETRY": "off"}

DENIED_OPERATIONS = ("upload", "--upload", "--launch", "hub_credentials", "registry_publish")


class HarborAdapterError(AdapterError):
    error_class = "backend_unavailable"


def run_experiment(spec: dict) -> dict:
    raise HarborAdapterError("Harbor adapter ships in M6 (pinned harbor==0.22.0); backend unavailable")
