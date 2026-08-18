"""AirVaultSource — Hermes secret source over the box-local encrypted vault.

Contract-conformant to agent/secret_sources/base.py (API v1): ``fetch()``
never raises, never prompts, never spawns; failures are returned through
``FetchResult.error`` + ``ErrorKind``; the environment is read through
``get_source_environment()`` (never bare ``os.environ``).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from agent.secret_sources.base import (
    SECRET_SOURCE_API_VERSION,
    ErrorKind,
    FetchResult,
    SecretSource,
    get_source_environment,
    is_valid_env_name,
)

try:
    from . import vault_store
except ImportError:  # pragma: no cover — script-style import in tests
    import vault_store

logger = logging.getLogger(__name__)

# Values shorter than this are not registered as redaction patterns — too
# short to be meaningfully secret and too likely to over-redact prose.
_MIN_REDACTION_LEN = 6


def _register_redaction(values) -> None:
    """C19: register every stored secret value with Hermes' redaction engine.

    Registered patterns are masked everywhere built-in credential patterns
    apply — run events, session storage, and the ``/v1/runs/{id}/events``
    SSE all pass through ``redact_sensitive_text`` before persistence/egress.
    Additive-only and fail-open: a registration failure must never break a
    fetch.
    """
    try:
        from agent.redact import register_redaction_patterns

        patterns = [
            re.escape(value)
            for value in values
            if len(value) >= _MIN_REDACTION_LEN
        ]
        if patterns:
            register_redaction_patterns(patterns, source="plugin:air-vault")
    except Exception:  # noqa: BLE001 — belt only, never fail the fetch
        logger.warning("air-vault: redaction registration failed", exc_info=True)


class AirVaultSource(SecretSource):
    api_version = SECRET_SOURCE_API_VERSION
    name = "air_vault"
    label = "AIR Vault"
    shape = "mapped"  # each injected var is an explicit user binding
    scheme = None

    def protected_env_vars(self, cfg: dict):
        # The bootstrap key — no source, including this one, may overwrite it.
        return frozenset({"AIR_VAULT_KEY"})

    def remediation(self, kind, cfg: dict) -> str:
        return "Open the AIR web app \u2192 Vault tab to add or repair vault items."

    def fetch(self, cfg: dict, home_path: Path) -> FetchResult:
        result = FetchResult()
        try:
            env = get_source_environment()
            key = (env.get("AIR_VAULT_KEY") or "").strip()
            if not key:
                result.error = (
                    "secrets.air_vault.enabled is true but AIR_VAULT_KEY is "
                    "not set in the box environment."
                )
                result.error_kind = ErrorKind.NOT_CONFIGURED
                return result

            path = vault_store.store_path(Path(home_path))
            if not path.is_file():
                result.error = f"vault store not found at {path}."
                result.error_kind = ErrorKind.NOT_CONFIGURED
                return result

            try:
                store = vault_store.load_store(path, key)
            except vault_store.VaultError as exc:
                result.error = f"vault store unreadable ({exc.code}): {exc}"
                result.error_kind = ErrorKind.INTERNAL
                return result

            _register_redaction(vault_store.secret_values(store))

            for item in store.get("items", []):
                env_var = item.get("env_var")
                if not env_var:
                    continue
                item_id = item.get("id")
                if not isinstance(env_var, str) or not is_valid_env_name(env_var):
                    result.skipped.append(str(env_var))
                    result.warnings.append(
                        f"air_vault: item {item_id} has an invalid env var "
                        f"name; skipped"
                    )
                    continue
                value = vault_store.injection_value(item)
                if not value:
                    result.skipped.append(env_var)
                    result.warnings.append(
                        f"air_vault: item {item_id} ({env_var}) has no value "
                        f"field; skipped"
                    )
                    continue
                result.secrets[env_var] = value
            return result
        except Exception as exc:  # noqa: BLE001 — fetch() must never raise
            logger.warning("air-vault: unexpected fetch failure", exc_info=True)
            failed = FetchResult()
            failed.error = f"unexpected air_vault failure: {exc}"
            failed.error_kind = ErrorKind.INTERNAL
            return failed
