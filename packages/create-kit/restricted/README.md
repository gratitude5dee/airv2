# Restricted (Tier B) Kit artifact

React Bits is MIT + Commons Clause: it may be compiled into an application, but the
components themselves may not be sold, sublicensed, or redistributed — alone, bundled,
or as a port. So Tier B never enters this repository (CR11, `scripts/verify.ts` fails
CI if it does), never appears in a source export or a published package, and lives as
a **private R2 object read only by the Build Service** (MC4).

Nothing in this directory is component source. `allowlist.json` names the upstream
files by path; the tarball and its manifest are gitignored build outputs.

## Artifact

```
_platform/kit/restricted/<version>.tgz          private R2 bucket (same bucket as _platform/templates/)
_platform/kit/restricted/<version>.manifest.json
```

`<version>` is `<kitVersion>+reactbits.<upstream-commit-12>` (e.g. `2026.09+reactbits.0123456789ab`).

Tarball contents (fixed order, mtime 0, so re-packing the same inputs is byte-identical):

```
LICENSE.md                 upstream license text, verbatim
NOTICE                     source, commit, SPDX, permitted / not-permitted use
manifest.json              schema, version, source pin, per-file sha256 (normalized + upstream)
components/<name>/<File>.jsx
```

## Producing it (operator, on a workstation — never in a Box or in CI)

```bash
git clone https://github.com/DavidHDev/react-bits /tmp/react-bits && git -C /tmp/react-bits checkout <commit>
KIT_CLONE_REACTBITS=/tmp/react-bits npx tsx packages/create-kit/scripts/pack-restricted.ts
```

The script refuses to run if `LICENSE.md` no longer contains both `MIT + Commons Clause License Condition` and
`Commons Clause Restriction` (a relicensing means the tier must be re-decided, not silently
repackaged), if the checkout lives inside this repository, or if any allowlisted file has
a hard CSP finding after normalization. Upload with the Build Service's R2 credential
(`putObject` in `apps/web/lib/storage/r2.ts`, key from the manifest's `r2Key`); the
manifest's `tarballSha256` is what the Build Service pins.

## Build Service read contract (MC4)

- Reads `_platform/kit/restricted/<version>.tgz` with its own credential. A store-session
  or gateway-token request for this key is refused: the key prefix is not under
  `apps/`, `u/`, or any public-media prefix, and no route proxies it.
- Verifies the tarball sha256 against the version pinned in the Build Service config
  before extracting; extracts into the build sandbox only, never into a Box, a source
  export, or the published bundle's source map.
- Resolves specifiers `@kit/restricted/<name>` to `components/<name>/<File>.jsx` from the
  extracted tree; every other Kit specifier resolves to `kit/` or `vendor/` in this repo.
- A published bundle may contain the compiled output (permitted: "as part of an
  application"). Source export (P2) omits any Tier B module and records the omission in
  the export manifest; a published package never includes one.
- Tier B components are non-lite (`allowlist.json` → `lite: false`); the Build Service
  rejects a `surface.lite` app that imports one.

## Existing `apps/web/lib/miniapps/client/backgrounds/vendor/`

Those 13 `.jsx` files are verbatim React Bits ports and are the same Tier B material as
this artifact (`allowlist.json` lists the same 13 upstream paths). MC0 finding and the
recommended move are in the MC3 PR description; they are intentionally left in place
by MC3.
