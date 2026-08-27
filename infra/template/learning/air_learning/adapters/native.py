"""Native Air adapter (goal.md §11.3).

Required for production shadowing, session reconciliation, macOS, and tasks
that neither framework models safely. Native does not mean unisolated: the
twin contract (§10) applies fully.

V10 status: the M2 twin substrate (disposable container / clone acquisition,
scoped gateway token, teardown proof) is not yet provisioned on owner boxes,
so this adapter refuses any spec that would need side effects and fails
closed with a typed error instead of running unisolated. Fully synthetic
read-only smoke specs are the M0 exit criterion and run through the same
entry point once fixtures ship.
"""

from __future__ import annotations

from . import AdapterError

ADAPTER_VERSION = "native/0.1.0"

SIDE_EFFECT_CAPABILITIES = {"filesystem", "browser", "network_mock", "shell", "subagent"}


class NativeAdapterError(AdapterError):
    error_class = "twin_unavailable"


def run_experiment(spec: dict) -> dict:
    capabilities = set(spec.get("requiredCapabilities", []))
    if capabilities & SIDE_EFFECT_CAPABILITIES:
        # L2/L3: no twin substrate yet -> refuse rather than run against
        # production state. This is the M2 deliverable.
        raise NativeAdapterError(
            f"evaluation twin required for capabilities {sorted(capabilities & SIDE_EFFECT_CAPABILITIES)} "
            "— twin substrate lands in M2; refusing to run unisolated"
        )
    raise NativeAdapterError(
        "no synthetic taskset fixtures provisioned yet (M0 smoke task pending)"
    )
