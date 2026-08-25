# Omarchy environment — build and register the template box (operator runbook)

The Omarchy environment is an ascii.dev box, forked per user exactly like the
Ubuntu one — same Box API, same hosted routes, same `hermes-host` route
refresh, same live-screen lane. What differs is the userland: `setup.sh` here is
an **overlay** that runs `infra/template/setup.sh` verbatim and then adds a real
Arch root at `/opt/arch` (real `pacman`, real `yay`/AUR, Omarchy's own package
manifest and Hyprland config) with the Omarchy desktop running in it.

`POST /boxes` has no OS selector — every box is the same Ubuntu x86_64 image —
so Arch can only be the userland, not the base image. Hermes, the venv, the
plugins, the skills, the calendar spine, SOUL.md and the C24 gate have exactly
one copy (`infra/template/setup.sh`), so the two environments cannot drift.

| | Ubuntu | Omarchy |
| --- | --- | --- |
| substrate | ascii.dev box | the same box |
| userland | Ubuntu | Arch at `/opt/arch` (`arch-run '<cmd>'`) |
| packages | `apt-get` | `pacman` / `yay` (`packages.omarchy`) |
| desktop | the box's X display `:0` | Hyprland nested on `:0`, Xwayland on `:1` |
| agent's `DISPLAY` | `:0` | `:1` (inside the Omarchy desktop) |
| services | `hermes-gateway/dashboard/host`, `openviking` | the same, plus `arch-root`, `omarchy-desktop` |

Because Hyprland is nested on the display the box already streams, the human
sees the Omarchy desktop through the existing computer-use lane and no new VNC
stack, proxy or ticket path is introduced.

## 1. Build the template box

1. Create a fresh box and copy the whole `infra/` directory to it (the overlay
   reads its sibling `infra/template/`):

   ```bash
   BOX_API_KEY=... infra/template/boxctl.sh wait <box-id>
   # copy infra/ to /home/user/infra on the box (sync-box.sh's transport)
   ```

2. Run the overlay — it runs the baseline first, so this is the only command:

   ```bash
   BOX_API_KEY=... infra/template/boxctl.sh cmd <box-id> \
     'bash /home/user/infra/template-omarchy/setup.sh' 5400
   ```

   Everything is pinned: `HERMES_REF` (from the baseline),
   `ARCH_BOOTSTRAP_DATE` (Arch bootstrap tarball, from `archive.archlinux.org`
   — never `latest`), and `OMARCHY_REF`. Re-pin deliberately, with a delta
   review, the same way `infra/template/UPGRADE.md` §1 re-pins Hermes.

3. Verify, on the box:

   ```bash
   systemctl is-active hermes-gateway hermes-dashboard hermes-host \
     openviking arch-root omarchy-desktop
   arch-run 'pacman -Q hyprland chromium | cat'   # real Arch, real packages
   arch-run 'omarchy-theme-list | head'           # Omarchy's own tooling
   DISPLAY=:1 xdotool getdisplaygeometry          # the Omarchy Xwayland display
   grep '^DISPLAY=' ~/.hermes/.env                # must be :1
   ~/.hermes-venv/bin/python /home/user/infra/template/generate_platforms.py \
     --hermes-repo ~/hermes-agent --config ~/.hermes/config.yaml --verify
   ```

   Then open the box's desktop stream and confirm the Omarchy desktop fills it
   and the agent's browser windows appear inside it — that is what the human
   watches and takes over.

4. Run the baseline's §1 verifications too (secret-source re-pull, per-profile
   `api_server` auth), then warm the box: stop → resume → wait for units → stop
   (never `force: true`).

## 2. Register it as the omarchy template

Template pointers are per (channel, environment) in
`box_environment_templates.template_ref` — a box id for `ubuntu` and `omarchy`,
a bootstrap URL for `macos` (migration `0069_box_environments.sql`):

```sql
insert into box_environment_templates (channel, environment, template_ref)
values ('prod', 'omarchy', '<template-box-id>')
on conflict (channel, environment)
do update set template_ref = excluded.template_ref, updated_at = now();
```

`OMARCHY_TEMPLATE_ID` in Vercel (Production + Preview) is the fallback used
until that row exists. With neither, the environment reports itself unavailable
and onboarding does not offer it — it never silently forks the Ubuntu template
instead.

## 3. Upgrading existing Omarchy users

A user's box carries their `~/.hermes` state, so — as with Ubuntu — **never
re-fork to upgrade**. `infra/template/sync-box.sh` brings the shared baseline
up to date and is environment-agnostic; on an Omarchy box, follow it with the
Arch-side refresh:

```bash
arch-run 'sudo pacman -Syu --noconfirm'
arch-run 'git -C /usr/share/omarchy fetch --filter=blob:none origin <ref> \
  && sudo git -C /usr/share/omarchy checkout --force <ref>'
sudo systemctl restart omarchy-desktop
```

Re-running `setup.sh` on a provisioned box is also safe (it is idempotent and
preserves `~/.hermes` state), but it re-runs the whole baseline, so prefer
`sync-box.sh` + the two commands above for fleet work.

## 4. Known gaps

* `packages.omarchy` deliberately drops Omarchy's hardware and host-only
  packages (bluetooth, printing, brightness/ddc, docker, its Quickshell
  desktop-shell extras). Add what a skill actually needs with
  `arch-run 'yay -S --noconfirm <pkg>'` and then add it to the manifest, rather
  than restoring the full list.
* The Arch root shares `/home/user`, `/tmp`, `/dev` and `/run` with the host by
  bind mount (`arch-root.service`): it is an Arch userland on the same machine,
  not a sandbox, and gives no isolation from the host box. Isolation is still
  the box boundary, one box per user.
* Hyprland runs software-rendered (`WLR_RENDERER=pixman` via Omarchy's
  defaults, no GPU on a box), so heavy desktop animation is disabled and the
  desktop is sized to a fixed 1920x1080.
