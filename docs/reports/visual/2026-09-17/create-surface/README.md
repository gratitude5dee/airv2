# Create surface — recorded visual test (2026-09-17)

What this is: a Playwright walk of the V12 Create studio panes (spec §5.4) at
390×760, driven entirely by route mocks. No control plane, no Box, no network.

Re-run:

```
cd apps/web && node scripts/visual/create-surface.mjs
```

The script bundles the island (`scripts/build-create.mjs`), serves `public/`
plus a token-only HTML shell on 127.0.0.1:3457, answers every
`**/api/create/**` request from an in-memory fixture that walks
`plan_sent → confirmed → building 15/45/65/85 → dev_ready → finalizing`, and
writes this directory. It asserts 29 conditions (visible text per stage, the
fixture events the panes post, the disabled publish button, zero page errors)
and fails on the first mismatch. Total size 632 KB.

| Artifact | What it proves |
| --- | --- |
| `plan.png` | Plan pane at `plan_sent`: stage chip, plan v1, revision count, "Build this", a change note field. The plan text is not rendered — it lives in the owner's thread as an attachment (CR21). |
| `progress-45.png` | Progress pane mid-build: `building · 45%`, the bar, "build succeeded" detail, the build-log tail and the findings slot. |
| `progress-100.png` | Progress pane at the end of the run: 100%, the QA chip, no findings. |
| `release-dev.png` | Release pane at `dev_ready`: the `link.wzrd.tech/<u>/<a>` URL, "v3 · expires in 14 days", Renew and Revoke, and the production form (name ≤ 60, description ≤ 160, icon input, mirror toggle on, store listed). |
| `release-finalize.png` | The same pane after Renew moves the fixture to `finalizing`; the stage chip follows and the copy still says the decision is approved in Needs-you. |
| `page@*.webm` | The whole walk as one video (315 KB). |

Checked by hand against the Kit doctrine: single column at 390 px, 44 px
targets, tokens rather than literals, no hover-only affordance, short
present-tense copy.

Known gap: "Request publish" is disabled until `POST /api/create/finalize`
ships; the pane says so rather than hiding the form.
