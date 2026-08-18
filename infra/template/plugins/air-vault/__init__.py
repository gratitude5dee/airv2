"""AIR Vault Hermes plugin — registers the ``air_vault`` secret source.

Module import and ``register(ctx)`` run before the post-discovery secret
re-pull, so no credentialed work happens here; everything that needs
``AIR_VAULT_KEY`` lives inside ``AirVaultSource.fetch()``.
"""

try:
    from .vault_source import AirVaultSource
except ImportError:  # pragma: no cover — script-style import (test collection)
    from vault_source import AirVaultSource


def register(ctx):
    ctx.register_secret_source(AirVaultSource())
