# Air Create V13 — M0 Cloudflare proofs

Run: `npx tsx scripts/create-v13-m0.ts` — 2026-09-24T12:46:57.592Z

Local probes assert the shipped code; live probes call Cloudflare. "pending"
means the env var or operator step in the evidence column is still open.

| Probe | Status | Evidence |
| --- | --- | --- |
| worker-layout — air-create wrangler binds Workflow, OwnerRoom DO, Browser Run, R2 media and the air-apps dispatch namespace | pass | workflows + DO + browser + r2 + dispatch + cron + vars all bound |
| dev-router-layout — air-dev router binds the manifest KV, dispatches to <slug>-dev/-draft and serves *.dev.wzrd.tech | pass | candidate header + draft gate + noindex + expiry in router source |
| bridge-parity — CF1 signature: Vercel bridge and Worker compute the identical HMAC payload/digest | pass | payload + digest identical; web-signed request verifies; stale→false; unsigned→null |
| candidate-token — CF4 candidate tokens: mint/verify round-trip; wrong slug, wrong secret and expired all reject | pass | mint→verify ok; cross-slug, cross-secret and expired all reject; version is bound |
| live-token — Live-view tokens bind job+user, reject other jobs and expire | pass | worker mint/verify ok; cross-job and expiry reject; web mintLiveToken round-trips |
| check-sandbox — CF6: Browser Run checks route-abort off-list hosts and carry the candidate header | pass | allowedHosts + page.route abort + candidate header; off-list recorded as smoke issues |
| percent-monotonic — OwnerRoom broadcast clamps percent monotonic per job snapshot | pass | broadcast() reads last snapshot and max-clamps percent before fan-out |
| supersede — OwnerRoom admit: one running slot per owner, same-app replacements tombstone the old job | pass | admit returns start\|wait\|superseded; replaced jobs get superseded:<id> tombstones |
| adapter-kill — waitForTurn: a dead adapter chunk-times-out and the job keeps moving | pass | chunked waitForEvent + catch→curve; code wait falls through to the build step |
| step-table — Step percents follow the §5.2 ladder (admit 2 → brief 5→10 → code 10→50 → build 50→60 → check 60→85 → publish 85→99 → notify 100) | pass | all step names and ladder percents present in workflow.ts |
| no-content — CF5: create_jobs columns, DO broadcast shape and worker payloads carry ids/counters only | pass | no content columns; ProgressBroadcast = {percent,step,detail,round,state,dev_url,shot_url}; changes go via change_file |
| two-bubbles — The card is minted once at /api/create/go; the old relay editor is gone | pass | one [card: create] emission site; relay/card editing removed from progress.ts |
| flag-gate — CREATE_V13 flag + CREATE_V13_USER_IDS allow-list gate /api/create/go | pass | flag + allow-list gate present; disabled lane answers 426-style refusal |
| skill-v5 — create-miniapp skill v5: x-air-skill: 5, go + compile verbs, legacy verbs deprecated in place | pass | skill version 5 header + go/compile verbs + SKILL.md v5 |
| cf-token — Cloudflare API token verifies and can see this account | pending | set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN |
| air-apps-namespace — Workers for Platforms is enabled and the air-apps dispatch namespace exists | pending | set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN |
| dev-origin — *.dev.wzrd.tech DNS + cert resolve and air-dev answers on the wildcard | pending | air-dev not reachable yet — deploy it / fix *.dev.wzrd.tech DNS (fetch failed) |
| canary-dispatch — A canary user Worker deploys into air-apps and serves through air-dev | pending | set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN |
| create-worker-health — Deployed air-create answers /v1/health with adapter readiness | pending | https://create.wzrd.tech/v1/health → 404 — air-create not deployed on that host yet |
| waitforevent-roundtrip — Workflow waitForEvent round-trip: a signed Vercel callback advances a job | pending | operator step: deploy air-create, start a job via POST /v1/jobs, then POST a signed turn_done to /v1/jobs/<id>/events and confirm the step advances — needs CREATE_BRIDGE_SECRET + a reachable adapter |
| browser-run-check — Browser Run loads a candidate URL with x-air-candidate and runs the smoke pass | pending | operator step: with M0_CANARY=1 deployed, run the job's check step (or wrangler dev --remote on infra/workers/create) against the canary — asserts the BROWSER binding launches |
| adapter-turn — The adapter starts a turn on a real Box and the turn_done callback arrives | pending | operator step: on a real Box + line, POST /api/create/go for a test app and confirm the code turn's turn_done event arrives (job row percent > 10) |

Summary: 14 pass, 8 pending, 0 fail.
