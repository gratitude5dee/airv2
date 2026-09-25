# Stale PR audit (R-CI-10)

Audited 2026-09-25 against `origin/main` (`0f80c2c4`). Recommendations only — no PRs were closed or merged from this audit.

| PR | Summary | Recommendation | Why |
| --- | --- | --- | --- |
| #48 | air 2.1 uplift spec + visual changelog (docs only) | close | 5+ weeks old; nothing on main cites `goal-uplift` — the citation need it was written for never materialized, and the M9–M16 scope is covered by the newer `goal-create-v11…v13` docs |
| #195 | Onboarding: browser sign-in CTA inside Messages sheet | close | Superseded — `browserSignin` + "open this step in your browser" shipped on main via `1d0fdbee`; different markup, same behavior |
| #221 | Strict-TS review of apps/web + pocock review skill | needs-owner | Harmless doc merge if the Aug-25 point-in-time review is wanted as a record; findings may be absorbed by `review-findings.json` — owner's call whether the artifact still earns a spot in `docs/review-2026-08/` |
| #261 | `boxctl` create/ip/sshkey verbs + `box-dev.sh` idle spin-down | merge-after-rebase | Verbs absent on main; `infra/template/boxctl.sh` untouched since the PR's base (clean rebase); self-contained infra tooling verified end-to-end against a live box |
| #304 | Standalone `wz-sky` HTML snippet | close | Niche copy-paste asset duplicating the `fx.js` shader — drifts as the shader evolves; branch preserves it if a standalone embed is ever needed |
| #330 | exo agent harness alongside Hermes | needs-owner | Product/architecture call: new migration 0080, new `(channel, environment, harness)` template key, and ops must register a `zap-heavy-exo` template before exo is selectable |
| #405 | Clay Wabi home dashboard (draft) | close | Superseded — the same commit title `5c505548 feat(home): add clay Wabi dashboard` is already on main plus two follow-ups; clay theme and `wabi-v1` icons exist |
| #427 | Kernel browsers + vault payments + link host + hypeman eval plan | needs-owner | Plan doc for SWE-2 Max; harmless to merge if the plan is ratified, close if not — owner's call on whether the plan stands |
| #434 | Muse connector spec `muse.md` | close | Superseded — `muse.md` is on main and moved ahead (`4fc770b3`, `2bb6f3e0`); the PR's revision history is covered |
| #454 | `/motion` skill + spec (launch-video recipe) | merge-after-rebase | One day old, CI green, two new files under `.agents/skills/motion/` — self-contained, nothing to conflict |

Counts: 5 close, 2 merge-after-rebase, 3 needs-owner.
