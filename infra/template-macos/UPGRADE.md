# macOS environment — publish and register the bootstrap (operator runbook)

The macos environment is a Namespace Apple-silicon instance (a different
provider from the two Linux boxes — ascii.dev has no macOS). Namespace has no
snapshot fork for native instances, so the "template pointer" is not a box id:
it is the **URL of `bootstrap.sh`**, which every fresh Mac curls on first boot
(`createMacInstance` in `apps/web/lib/namespace/client.ts`). The bootstrap
clones this repo at a pinned ref and runs `setup.sh` — the darwin/arm64 port of
`infra/template/setup.sh` (brew for apt, per-user launchd agents labelled
`tech.wzrd.air.<service>` for systemd, native windows + VNC for the X display,
Namespace ingress + `bridge.py` for the ascii host routes).

| | box (ubuntu/omarchy) | macos |
| --- | --- | --- |
| provider | ascii.dev | Namespace |
| template pointer | template box id (forked) | bootstrap.sh URL (built at boot) |
| exec / files | Box command API | `bridge.py` behind authenticated ingress |
| services | systemd units | launchd `tech.wzrd.air.*` LaunchAgents |
| routes | `hermes-host` ascii tunnels | Namespace ingress (8642, 9119, 8722) |
| screen | box desktop stream | Namespace VNC (`GetVNCConfig`) |

Security posture: the ingress for the bridge port keeps Namespace's bearer
check ON, and the bridge additionally requires the per-instance
`X-Air-Bridge-Token` — neither token alone reaches the Mac. Hermes (8642) and
the dashboard (9119) publish open (they carry their own auth: API_SERVER_KEY,
dashboard basic auth) and are consumed through the same control-plane proxy
lanes as the box hosted routes. No provider key ever enters the Mac (C2);
NAMESPACE_TOKEN lives only in Vercel.

## 1. Publish the bootstrap

1. Pin the refs in the two scripts and commit:
   - `AIR_INFRA_REF` in `bootstrap.sh` — pin to a commit SHA of this repo, not
     a branch, before publishing (the checked-in default `main` is for
     development only).
   - `HERMES_REF` in `setup.sh` — keep in lockstep with
     `infra/template/setup.sh` (re-pin both together, with a delta review).
2. Host `bootstrap.sh` at a stable HTTPS URL the control plane owns, e.g.
   `https://app.wzrd.tech/infra/mac-bootstrap.sh` (any immutable raw URL of a
   pinned commit also works). The file contains no secrets — per-instance env
   (TENANT_ID, GATEWAY_TOKEN, AIR_BRIDGE_TOKEN) arrives from `CreateInstance`,
   never from the script.

## 2. Register it as the macos template

```sql
insert into box_environment_templates (channel, environment, template_ref)
values ('prod', 'macos', 'https://.../bootstrap.sh')
on conflict (channel, environment)
do update set template_ref = excluded.template_ref, updated_at = now();
```

`MAC_BOOTSTRAP_URL` in Vercel is the fallback until that row exists. Also set
`NAMESPACE_TOKEN` (a tenant token: `nsc token create` with instance
lifecycle + ingress grants) and optionally `NAMESPACE_REGION` /
`NAMESPACE_COMPUTE_API`. Without both a pointer and a token, the macos
environment reports itself unavailable and onboarding does not offer it.

## 3. Verify a fresh instance

Provision a test user with `environment: "macos"` and check:

```bash
# over the bridge (runCommand routes here for native targets)
launchctl print gui/$(id -u) | grep tech.wzrd.air     # 4 agents running
grep '^DISPLAY=' ~/.hermes/.env                        # absent — no X on macOS
~/.hermes-venv/bin/python ~/.air-infra/infra/template/generate_platforms.py \
  --hermes-repo ~/hermes-agent --config ~/.hermes/config.yaml --verify
```

Then hit `/health` on the hermes ingress, `/api/health` on the dashboard
ingress, and open the VNC config (`GetVNCConfig`) to confirm the screen share
shows the agent's browser windows.

## 4. Upgrading

Instances build themselves, so upgrading the template = commit + re-pin
`AIR_INFRA_REF` (and republish the bootstrap URL if it is not commit-addressed).
Existing Macs are NOT rebuilt: like boxes, they carry the user's `~/.hermes`
state. Run the equivalents of `sync-box.sh` over the bridge for fleet updates,
or move the user with `switchEnvironment` (which builds a new instance and
tears down the old one).
