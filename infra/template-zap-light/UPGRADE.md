# zap-light template — build & register

zap-light ("zap-VM") is a **dev-box template**, not an onboarding
environment: an air box with a sandboxed execution lane for the three
zap-light workloads — code generation, FFmpeg commands, and generative-media
workflows. It is the first rung of the Zap runtime ladder
(zap-light → zap-medium → zap-heavy); Hermes on the box remains the initial
zap-heavy implementation.

## Isolation model

| Host | Isolation |
| --- | --- |
| Box/VPS with `/dev/kvm` (e.g. Hetzner bare-ish VPS, Firecracker host) | Hyperlight micro-VM sandboxes (`hyperlight-host`, built from the pinned ref) |
| ascii.dev box (no nested virt) | systemd-run process sandbox; `~/.zap/capabilities.json` records `"isolation": "process"` so the control plane can route heavy jobs to a KVM-capable host |

`setup.sh` probes `/dev/kvm` and writes the capability manifest either way —
the template works on both, degrading isolation rather than failing.

## Build steps

1. Create a template box the same way as `infra/template/UPGRADE.md`
   (prod channel conventions apply).
2. Run `infra/template/setup.sh` (the base air template) to completion.
3. Copy this directory to the box and run `setup.sh`.
4. Verify:
   - `systemctl is-active zap-exec` → `active`
   - `cat ~/.zap/capabilities.json` shows the expected `isolation`
   - `ffmpeg -version` works as `user`
5. Snapshot the box and register the template id for the `zap-light`
   dev-box lane (kept out of `box_environment_templates` — this is not an
   onboarding environment; it will be exposed to users later via the Zap
   dev-box surface).

## Future (zap-medium / zap-heavy)

- zap-medium adds gateway routing (OpenRouter/OpenAI/Anthropic/GMI/Fal/
  Replicate) and the generative-media filesystem on top of this template.
- zap-heavy is the agent runtime with OpenViking memory and agent templates;
  the existing Hermes box is its first implementation.
- Self-hosted microsandbox (`msb`) servers and Firecracker hosts consume the
  same box config bundle; register their template pointers alongside this
  one when those providers come online.
