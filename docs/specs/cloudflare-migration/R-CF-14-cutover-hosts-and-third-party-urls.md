# R-CF-14 — Cutover, hosts and third-party URLs

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-14: …`.

**Why.** One Next deployment serves `app.`, `mini.` and `link.wzrd.tech`, and it routes them by the `Host` header (`apps/web/middleware.ts:56`, `:58`, `:76`). `apps/web/wrangler.jsonc:1-22` defines no routes, so `airv2-app` answers only on workers.dev.

The `wzrd.tech` zone is on Cloudflare. All three hosts already resolve to Cloudflare anycast through proxied records. mini and link reach Vercel through those records. app is most likely fronted by an app-switch route (verify). Vercel marks app as misconfigured and lists the other two as configured over HTTP. Because of this, moving a host changes only the edge: clients get the same DNS answers, so there is no propagation wait. Vercel has run no functions or crons since about 2026-10-11, because the team is blocked.

The hostnames do not change, so `APP_ORIGIN` stays `https://app.wzrd.tech` (`apps/web/lib/env.ts:343`). Every URL already baked into boxes, approval links and Cal.com accounts stays valid. Only two things need work:
- registrations that point at `airv2.vercel.app`;
- the two Workers that call the app with a public `fetch`.

Use Workers **Custom Domains**, not Routes:
- With a Custom Domain, the Worker is the origin, and Cloudflare creates the DNS record and the certificate (developers.cloudflare.com/workers/configuration/routing/custom-domains/).
- A Route needs a proxied record that points at an origin, which here would be Vercel.

With a Custom Domain, Next receives the original `Host`. Host routing and the same-origin check (`apps/web/lib/http/origin.ts:57-64`) then work with no code change. The trusted `x-air-origin-host` pair (R-CF-02; checked by `lib/http/edge.ts` `trustedOriginHost`, §2.5 C11) is needed only in proxy mode.

**Deltas.** R-CF-14 ships in parts. Title each PR `R-CF-14.N: …`.

| Part | Phase | Contents |
|---|---|---|
| **14.1a** | P1 | WfP deploy gating in `workers.yml` |
| **14.1b** | P1–P3, after R-CF-01, R-CF-02 and R-CF-13 | Service bindings, mail-webhook reconcile, inventory script, reserved word, routes echo step, emergency-route section of the app-switch README, canary rehearsal, runbook doc |
| **14.2** | P4 | `app.wzrd.tech` |
| **14.3** | P5 | `mini.wzrd.tech`, then `link.wzrd.tech` |
| **14.4** | P6 | Cleanup |

**Keep each 14.2/14.3 PR unmerged until its T0.** R-CF-13's domain guard (`apps/web/scripts/cf-domain-guard.ts`) fails any deploy whose `routes` list a host that is not yet attached to `airv2-app`. A premature merge therefore blocks every later main deploy until T0. Without the guard, or with `attach_domains=true`, the deploy re-points the live record by itself: CI deploys run without a TTY, and in that case wrangler 4.149.0 sets `override_existing_origin=true` and `override_existing_dns_record=true` (`wrangler-dist/cli.js` `publishCustomDomains`, ~l.164218-164221).

- **`apps/web/wrangler.jsonc` — `routes`.** Change it one phase at a time:
  - **14.1b:** `[{ "pattern": "cf-canary.wzrd.tech", "custom_domain": true }]`. This is a rehearsal hostname that the owner approves (§6.12). The last 14.1b PR sets `"routes": []` again.
  - **14.2:** `[{ "pattern": "app.wzrd.tech", "custom_domain": true }]`. This is the same shape as `infra/workers/create/wrangler.jsonc:16`.
  - **14.3:** append `mini.wzrd.tech` and deploy, then append `link.wzrd.tech` and deploy.
  - **14.4:**
    - set `"workers_dev": false` and `"preview_urls": false` (R-CF-02 may already set the second). Land this only after `CREATIVE_WEBHOOK_ORIGIN=https://app.wzrd.tech` has been verified (R-CF-08; runbook step 7) and `AIRV2_SMOKE_URL` is the app host (R-CF-13). Otherwise fal webhooks and the CI smoke point at a dead host;
    - `AIR_PUBLIC_ORIGIN` is already gone, because R-CF-02 deletes it and no code reads it (§2.5 C1). Do not delete it again. Remove the stale carve-lane comment on `UPSTREAM_VERCEL` (old `:15-16`) if R-CF-02 left it;
    - keep `UPSTREAM_VERCEL` (`:17`) for as long as Vercel is a rollback target.
  - **Separate P6 PRs**, tracked at P6 exit and not part of 14.4:
    - `R-CF-05.P6`: `TENKI_API_KEY` moves to `OPTIONAL_ENV` and the Tenki deps move to devDependencies, once there are 0 `tk_` rows;
    - `R-CF-10.P6`: delete the legacy `compileWorkspace`, the disk extractors and the `/api/create/turn` tracing include;
    - R-CF-11's removal of the `vercel.json` crons.
- **`routes` replace semantics.** `routes` is the single source of truth. `publishCustomDomains` (`cli.js` ~l.164150-164259) posts the full custom-domain list to `domains/changeset?replace_state=true`, then sends `PUT domains/records` with `override_scope: true`. Confirm both of these effects on the canary:
  - While the list is non-empty, any host missing from it is detached on the next deploy.
  - When `routes` holds no custom domains, wrangler does not touch domains at all (`cli.js` ~l.164925).
- **`.github/workflows/airv2-app.yml`** (owned by R-CF-13):
  - The Rollback B freeze already exists: R-CF-13's deploy job condition `vars.AIRV2_ROLLBACK_B != 'true'`, backed by its domain guard. Add no second `if:` (§2.5 C21).
  - Add a step, before `wrangler deploy`, that echoes the `routes` hosts it is about to publish.
  - From 14.2 on, `AIRV2_SMOKE_URL` is `https://app.wzrd.tech`. It holds the origin only, because the workflow appends `/api/version`. The owner sets it in runbook step 7. That endpoint is served before the hosting switch, so it always reports the Cloudflare SHA.
  - Never deploy custom-domain changes while rollback B is in effect.
- **`infra/workers/app-switch/` is vendored by R-CF-02 (§2.5 C19).** R-CF-14 does not vendor it again. R-CF-14 relies on these properties of that copy:
  - `src/index.js` is the downloaded bundle, verbatim.
  - `wrangler.jsonc` has name `app-switch`, KV `HOSTING` → `61b51af0f1da4cda8dd6449c845ac01e`, and the vars `UPSTREAM_CF` and `UPSTREAM_VERCEL`. `SWITCH_TOKEN` is a secret only (§6.7). It has **no `routes`**, so a redeploy can never take a host.
  - `README.md` is the only record of the routes and domains that were live at vendoring time. **14.1b** appends the emergency route procedure (below) to it.
  - The dry-run-only `check` matrix entry in `workers.yml` comes from R-CF-13 (§2.5 C18). There is no deploy job, and every app-switch deploy is owner-only (§2.5 C22).
- **`.github/workflows/workers.yml` (14.1a).** Append `&& vars.WFP_ENABLED == '1'` to the `if:` of `deploy-dispatcher` (`:95`), `deploy-create` (`:130`) and `deploy-dev-router` (`:147`). Leave `deploy-outbound` (`:78`) ungated.
  - This turns off three deploy jobs, so the owner approves the merge (§2.5 C22). Setting `vars.WFP_ENABLED=1` later is §6.6.
  - Evidence: the last main run (Actions run 37415667694, 2026-10-06) failed in `wrangler-action` for deploy-outbound, deploy-create and deploy-dev-router, and skipped deploy-dispatcher.
  - The logs could not be read from this session. air-outbound has no WfP binding, so suspect the repo's `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets (verify; §6.10).
- **`infra/workers/muse/wrangler.toml`.** Add:
  ```toml
  [[services]]
  binding = "CONTROL_PLANE"
  service = "airv2-app"
  ```
  Keep `CONTROL_PLANE_ORIGIN` (`:23`) as the URL base and as the fallback. air-muse already sets `global_fetch_strictly_public` (`:7`), so today's public fetch works. The binding removes that dependency and the public hop.
  - The binding targets airv2-app's default (public) entrypoint, not `Internal`. `Internal` is only for airv2-app's own `SELF` calls (§2.5 C1). The hosting switch and the `x-air-*` stripping therefore apply exactly as they do for today's public fetch.
  - Deploy it only after `airv2-app` exists (R-CF-13), because wrangler rejects a binding to a Worker that does not exist (§2.5 C18).
- **NEW `infra/workers/muse/src/controlPlane.ts`.** Add `controlPlaneFetch(env, path, init)`:
  - It returns `env.CONTROL_PLANE ? env.CONTROL_PLANE.fetch(new Request(origin + path, init)) : fetch(origin + path, init)`.
  - Use it from `controlPlane()` (`src/index.ts:234-242`) and `cp()` (`src/full.ts:56-69`).
  - Regenerate `worker-configuration.d.ts` with `npm run cf:types`.
  - Deploy with `infra/workers/muse/release.sh`, because `workers.yml` has no muse deploy job.
- **`infra/workers/outbound/wrangler.toml`, `outbound/index.mjs:157-170`, `outbound/index.d.mts:13-17`.**
  - Add the same binding, and wrap `fetch(target.toString(), {…, redirect: "manual"})` in the same helper.
  - Add `CONTROL_PLANE?: { fetch(r: Request): Promise<Response> }` to `OutboundEnv`.
  - air-outbound is deployed but idle, because air-dispatcher is not deployed. This change is for parity only.
  - Until `deploy-outbound` works, deploy with `cd infra/workers && npx wrangler deploy --config outbound/wrangler.toml` (the job's own command, `workers.yml:90-91`).
- **`infra/workers/create/wrangler.jsonc:10`.** The comment says `CONTROL_PLANE_ORIGIN … (https://air.wzrd.tech)`.
  - That is the landing page (`ARCHITECTURE.md:319`), but `adapterPost` POSTs control-plane routes (`create/src/adapter.ts:31-36`). Change the comment to `https://app.wzrd.tech`.
  - Add no binding. air-create is not deployed, and it binds a dispatch namespace (`:26`), which is WfP (§7).
- **`apps/web/lib/wzrdmail/client.ts:383-425` and `apps/web/lib/agentmail/client.ts:580-622`.** Make `ensureWebhook` reconcile the URL:
  - Add `url?: string` to `Webhook`.
  - When `new URL(existing.url).href !== new URL(url).href`, send one PATCH with `{ url, pod_ids: merged }`.
  - Today only `pod_ids` is PATCHed, so whatever host the `air-inbound` webhook was created with sticks (`lib/provisioning/email.ts:273`).
  - It is unconfirmed whether each vendor's PATCH accepts `url` (verify). On a 4xx, `log.warn` and continue.
  - `ensureWebhook` runs only when a user is provisioned, so the script below fixes the existing webhook.
- **NEW `apps/web/scripts/webhook-inventory.mjs`.** Local-only and read-only by default. It reads values through the R-CF-01 `.env.airv2.md` parser and prints the URL each vendor has on record:
  - Stripe: `GET /v1/webhook_endpoints`.
  - GitHub App: `GET /app/hook/config`, using an App JWT built from `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`.
  - wzrdmail and AgentMail: `GET /webhooks`, filtered to `client_id` starting with `air-inbound`.

  With `--fix`, it points each one at `${APP_ORIGIN}/api/inbound/<kind>`. Devin implements `--fix` and tests it against fixtures. Only the owner runs it, after reviewing the read-only output (§6.9):
  - Stripe: `POST /v1/webhook_endpoints/{id}` with `url`. The existing `whsec_` is kept.
  - GitHub: `PATCH /app/hook/config`.
  - Mail: PATCH `url`.

  Photon, the GitHub App Setup URL and Cal.com have no API path, so they stay manual rows.
- **`apps/web/lib/miniapps/reserved.ts:14-18`.** Add `"vendor"` to `PLATFORM_RESERVED` before 14.3.
  - Static assets are served before the Worker on every host, so `mini.wzrd.tech/vendor/*` shadows a `vendor` publisher. On Vercel, middleware ran first (matcher at `middleware.ts:242`).
  - `creator-os` and `app-icons` need nothing. Middleware already passes them through (`middleware.ts:85-88`, `:188-193`), and `USERNAME_RE` (`lib/miniapps/nested.ts:13`) forbids hyphens, so they cannot be usernames.
  - The `public/*.sh` files contain `.`, so they cannot collide either.
- **NEW `docs/operations/cloudflare-cutover.md`.** Write the content below into it, filled with the observed values.

**Third-party and baked-in URL inventory.** The hosts do not change. Fill in the "observed" values before P4 (§6.9).

| # | Caller | Path | Where it is set | Action |
|---|---|---|---|---|
| 1 | Photon/Spectrum webhook | `/api/inbound/imessage` | Photon dashboard, by hand (`docs/goal-air2.md:188`); host not in repo | The owner reads it. If it is not `app.wzrd.tech`, the owner edits it. `SPECTRUM_WEBHOOK_SECRET` is unchanged (§6.2g asks Photon whether an edit rotates it). |
| 2 | Stripe | `/api/inbound/stripe` | Stripe dashboard. Tests use `airv2.vercel.app` (`lib/payments/stripe.test.ts:32`), so the registered host may be Vercel (verify). | The owner runs `webhook-inventory --fix` or edits it in place. Either way `whsec_` stays equal to `STRIPE_WEBHOOK_SECRET`. |
| 3 | wzrdmail (default `MAIL_PROVIDER`, `lib/env.ts:456-457`) / AgentMail | `/api/inbound/email` | Created once; the URL is never updated (`lib/provisioning/email.ts:273`) | Code reconcile, plus the owner's script `--fix` |
| 4 | GitHub App | webhook `/api/inbound/github`; Setup URL `/api/create/github/setup` | GitHub App settings | Owner's script `--fix` for the webhook; the owner sets the Setup URL by hand |
| 5 | Cal.com | `/api/inbound/calcom?account=<id>` | Minted per account and pasted by the user (`app/api/calendar/accounts/route.ts:196`) | Cannot be changed centrally. The host stays `app.wzrd.tech` permanently. |
| 6 | Provisioned boxes | `OPENAI_BASE_URL=${appOrigin}/api/gateway/v1`; MCP proxies `/api/mcp/{composio,wzrdconnect,masterkey}` | Written at provision time (`lib/provisioning/provision.ts:909,945,970`; `lib/provisioning/connectors.ts:109,147,249`; `lib/bots/provision.ts:116`) | None. No re-provisioning. |
| 7 | Approval links already sent | `/approve/<id>?k=` (`lib/approvals/token.ts:83`) | Users' threads | None |
| 8 | air-muse | `CONTROL_PLANE_ORIGIN` (`infra/workers/muse/wrangler.toml:23`) | Var | `CONTROL_PLANE` service binding |
| 9 | air-outbound | `CONTROL_PLANE_ORIGIN` (`infra/workers/outbound/wrangler.toml:16`) | Var | Service binding |
| 10 | air-create (not deployed) | `CONTROL_PLANE_ORIGIN` secret | `wrangler secret put` | Comment fix only |
| 11 | air-dispatcher (not deployed) | `APP_ORIGIN` / `MINI_ORIGIN` frame-ancestors (`infra/workers/wrangler.toml:25-26`) | Vars | None |
| 12 | Admin panel (`gratitude5dee/admin`) | `/_switch` + `SWITCH_TOKEN` | Admin server config | Confirm it calls `https://app.wzrd.tech/_switch` and not an app-switch-only URL (verify). Gates app-switch retirement. |
| 13 | Per-request URLs | Composio `${appOrigin}/home` (`app/api/connectors/route.ts:82`); Stripe success/cancel/return (`lib/payments/stripe.ts:89-90,146-147`) | Computed per request | None |

**Canary rehearsal (14.1b; required before P4).**
1. **(owner)** Create `cf-canary.wzrd.tech` as a proxied CNAME to `cname.vercel-dns.com`, which mimics today's records (verify the target). Optionally, add a route `cf-canary.wzrd.tech/*` to any existing worker, to rehearse runbook step 5.
2. Run the per-host runbook steps 3–7 on it, with the same owner/Devin split. The 14.1b canary PR plays the part of the 14.x PR.
3. **(owner)** Run rollback B steps 1–6 on it. Devin prepares the host-removal PR. Check three things:
   - with `AIRV2_ROLLBACK_B=true`, a main push skips the deploy;
   - with the variable briefly unset while the host is detached, R-CF-13's domain guard fails the job before `wrangler deploy`;
   - after the host-removal PR and unsetting the variable, the next deploy does not re-take the host.
4. Close the rehearsal:
   - **(Devin)** Merge the PR that sets `"routes": []`. That deploy leaves domains alone.
   - **(owner)** Detach the canary by hand.
   - **(owner)** Delete its DNS record and the leftover Advanced Certificate. Deleting a Custom Domain does not remove its certificate (custom-domains docs, "Certificates").

**Cutover runbook, per host** (14.2 for app; 14.3 for mini, then link). Steps marked (owner) are owner-only (§2.5 C22, §6.12). Devin never writes the production `HOSTING` key, never changes DNS and never attaches a Custom Domain.
1. **T-1 day (owner, or Devin with read-only access):**
   - Export the zone (DNS → Records → Export) and record the host's record: type, target and proxied flag.
   - List zone Worker routes (`GET /zones/{zone_id}/workers/routes`) and custom domains (`GET /accounts/{account_id}/workers/domains`).
   - Record whether app-switch holds the host as a route (expected for app; verify) or as a Custom Domain.
   - Read the switch: `npx wrangler kv key get target --namespace-id 61b51af0f1da4cda8dd6449c845ac01e --remote`.
2. **T0 (owner).** POST `/_switch` with `target=cloudflare` from the admin panel. Do not rely on the missing-key default, which is `vercel`.
   - *Optional soft step, app host only:* while app-switch still owns the route, this flip already sends app traffic through app-switch to airv2-app on workers.dev.
   - app-switch sends no `x-air-edge-auth`. Once R-CF-02 stops trusting a client-supplied `x-forwarded-host`, browser POSTs fail the same-origin check (`lib/http/origin.ts:57-64`, host = workers.dev). So use the soft step only for GET smoke tests and server-to-server webhooks, and keep it short.
3. **(owner)** Delete the host's CNAME to Vercel. "You cannot create a Custom Domain on a hostname with an existing CNAME DNS record" (custom-domains docs). If app-switch holds the host as a Custom Domain, there is no CNAME: skip this step.
4. **(owner, immediately)** Workers & Pages → `airv2-app` → Domains → Add → Custom Domain `<host>`. This creates the Worker DNS record and the certificate. If app-switch held a custom domain on the host, confirm the reassignment. Steps 3–4 are the only window in which the host has no origin, so do them back to back (seconds).
5. **(owner)** Delete every Worker route that matches the host (for example app-switch on `app.wzrd.tech/*`).
   - Routes run in front of a Custom Domain (custom-domains docs, "Interaction with Routes"). Until the route is deleted, app-switch keeps proxying according to KV `target`, which after step 2 means airv2-app.
6. **(Devin)** Merge the 14.x PR. R-CF-13's domain guard passes because the host is now on `airv2-app`, and the deploy log should show the host unchanged.
   - If step 4 failed, the merge deploy fails at the domain guard. The owner then dispatches `airv2-app` with `attach_domains=true`, which attaches the host through the non-TTY override. Custom-domain attaches are owner-only (§2.5 C22).
   - Do not merge anything else to main between step 4 and the end of this deploy. A deploy whose non-empty `routes` list lacks the host detaches it.
7. **Verify (Devin):**
   - `curl -sS https://<host>/api/version` returns the main SHA.
   - `curl -sI https://<host>/ | grep -iE '^(cf-ray|x-vercel-id):'` shows `cf-ray` and no `x-vercel-id`.
   - `npx wrangler tail airv2-app --format json | jq -r .event.request.url` shows the host.
   - The §5 checks for that host pass.
   - **App host only (14.2), after those checks pass:**
     - **(owner)** Set `CREATIVE_WEBHOOK_ORIGIN=https://app.wzrd.tech` in `.env.airv2.md` and run `npm run cf:env -- push` (§2.5 C22). Then Devin confirms that a `/zap` fal webhook lands on the app host: `wrangler tail` shows `https://app.wzrd.tech/api/creative/fal-webhook`.
     - **(owner)** Set repo variable `AIRV2_SMOKE_URL=https://app.wzrd.tech`. Give the origin only, because the workflow appends `/api/version`.
8. **(owner)** Leave the domain attached in the Vercel project; rollback B needs it.

**Rollback decision.**

| Failure | Use |
|---|---|
| Bad airv2-app version (code bug) | `npx wrangler rollback` to the previous version, or dispatch `airv2-app` with `mode=rollback` (R-CF-13). Fastest; no host change. |
| One dependency down (relay, Images, build) | Its feature switch, for example `IMESSAGE_TRANSPORT` (R-CF-03), which the owner changes in the md file and pushes with `cf:env -- push` (§2.5 C22); fix forward |
| App broken, entry healthy, Vercel unblocked and at the same SHA | Rollback A |
| Entry fails at startup (1101 on every request, so `/_switch` is dead) or a long Cloudflare incident | `wrangler rollback` first, then rollback B |
| Vercel still blocked | Only `wrangler rollback` and fix-forward exist. A and B just move the outage. |

**Rollback A, KV flip (owner-run, §2.5 C22). Useful only once Vercel is unblocked.**
- **Preconditions, all required:**
  - The Vercel team is unblocked (§6.3).
  - A Vercel production deploy exists at the Cloudflare SHA. `POST /_switch {target:"vercel"}` (R-CF-02) applies the semantics of §2.5 C12. It probes `UPSTREAM_VERCEL/api/version` (`https://airv2.vercel.app`) and never `app.wzrd.tech`, because a Worker that fetches its own Custom Domain gets 522. The outcomes:
    - an unreachable or non-2xx upstream returns 409 and nothing changes. A blocked account lands here;
    - a 404 is allowed, because it reads as a pre-R-CF-02 build such as the frozen `ce337d1`. The guard does not protect this case, so the owner checks that build against the migrations before flipping;
    - a SHA mismatch returns a `warning`, and the flip needs `{"force": true}`. The admin panel cannot send `force`, so a forced flip is an owner `curl` (step 2). Force only with owner approval, because migrations may have moved.
  - Vercel env has `EDGE_PROXY_SECRET`, and `VERCEL_AUTOMATION_BYPASS_SECRET` exists.
  - Vercel runs `IMESSAGE_TRANSPORT=spectrum`.
  - The airv2-app entry is healthy.
  - Cloudflare-side traffic never reaches the switch:
    - SELF-originated requests use the `SELF` binding to airv2-app's `Internal` entrypoint, which never runs the switch or `proxyToVercel` (§2.5 C1). These are cron dispatch from `scheduled()`, `selfFetch`, queue and DO callbacks.
    - The only public path served on Cloudflare whatever the target is `POST /api/creative/fal-webhook` (R-CF-08). R-CF-02's handler lists it ahead of the switch branch.

    Confirm both in R-CF-02's handler tests before relying on rollback A. If either were proxied, crons would reach Vercel, hit the `cron_host` guard and silently stop, and in-flight CreativeJobs would lose their webhook.
- **Steps:**
  1. **(owner)** `GET https://app.wzrd.tech/_switch` with `Authorization: Bearer $SWITCH_TOKEN`. Note `target` and both SHAs.
  2. **(owner)** POST `vercel` through the admin panel. The vendored app-switch source shows the body shape (verify). If the response carries a SHA `warning` and the owner approves a forced flip: `curl -sS -X POST https://app.wzrd.tech/_switch -H "Authorization: Bearer $SWITCH_TOKEN" -H 'content-type: application/json' -d '{"target":"vercel","force":true}'`.
  3. Wait about 90 s: up to ~30 s of isolate cache plus KV propagation (up to ~60 s).
  4. **(Devin)** Verify:
     - `curl -sI https://app.wzrd.tech/` carries `x-vercel-id`;
     - `/api/version` reports `target=vercel`;
     - Workers Logs show the `switch.flip` event, and `cron.dispatch` events continue (§2.5 C16);
     - after P5, mini and link host routing still work;
     - one browser POST succeeds (trusted headers, R-CF-02).
  5. Let Cloudflare-side durable work drain; do not delete instances. `ConversationDO` alarms, `creative-job` Workflow instances and the `air-deferred` consumer keep running. The `claim_flush`/`flush_jobs` fence prevents a double turn (R-CF-04; verify).
  6. **(owner)** Return: POST `cloudflare` and verify the same way.
- **`HOSTING.target` never moves `cron_host`.** They are independent levers (§2.5 C13). Crons stay on Cloudflare during rollback A. The owner moves `cron_host` only if the failure also breaks the cron routes, and as a separate step: set `cron_host=vercel` (SQL in rollback B step 4) and re-enable Vercel crons. Reverse both on return.

**Rollback B, DNS (owner-run, §2.5 C22; Devin prepares the host-removal PR).**
1. **(owner)** Freeze Cloudflare deploys first: `gh workflow disable airv2-app.yml && gh variable set AIRV2_ROLLBACK_B --body true` (§2.5 C21).
   - **CI re-take caveat:** without a TTY, wrangler 4.149.0 sets `override_existing_origin=true` and `override_existing_dns_record=true`, and posts `replace_state=true`. Any CI deploy whose `routes` still lists the host silently takes it back from a restored CNAME. R-CF-13's domain guard also refuses re-attachment, but do not rely on it alone.
2. **(owner)** Detach the Custom Domain: dashboard → airv2-app → Domains, or `DELETE /accounts/{account_id}/workers/domains/{domain_id}` (verify).
3. **(owner)** Recreate the CNAME exactly as exported (proxied, as today).
   - If Vercel shows the domain as invalid, switch the record to DNS-only.
   - After 2026-11-28, the `*.wzrd.tech` wildcard cert at Vercel has expired. Vercel must then issue a per-host cert over HTTP-01 (verify).
4. **(owner)** Confirm `x-vercel-id`. Then move crons to Vercel in SQL, because `/_switch` may be down:
   ```sql
   update platform_settings set value = '"vercel"'::jsonb, updated_at = now() where key = 'cron_host';
   ```
   Re-enable Vercel crons in Vercel settings.
5. **(Devin)** Land a PR that removes the host from `routes`. Only then does the owner run `gh variable delete AIRV2_ROLLBACK_B` and `gh workflow enable airv2-app.yml`.
6. Return:
   - **(Devin)** Fix forward and verify on workers.dev. After P6, re-enable `workers_dev` for one deploy.
   - Rerun the cutover runbook.
   - **(owner)** Set `cron_host` back to `"cloudflare"` and disable Vercel crons. If Vercel crons did not run during the rollback, run R-CF-11's backlog triage first (§2.5 C13).

**App-switch retirement (14.4).**
- **Preconditions:**
  - P5 exit plus at least 14 days with no rollback.
  - Inventory row 12 confirmed.
  - No route points at app-switch.
- **Steps:**
  - **(owner)** Delete the script with `npx wrangler delete --name app-switch` (§2.5 C19, C22).
  - The KV namespace stays, because airv2-app binds it.
  - The vendored copy stays deployable: it dry-runs in `workers.yml` (R-CF-13), and a redeploy needs `wrangler secret put SWITCH_TOKEN`.
- **Emergency path** (14.1b writes it into `infra/workers/app-switch/README.md`):
  - **(owner)** Redeploy app-switch from the vendored copy, add the route `app.wzrd.tech/*` in the dashboard, and set `target=vercel`. Never commit the route to its `wrangler.jsonc` (§2.5 C19).
  - The route runs in front of the Custom Domain, so this diverts the app host to Vercel with no DNS change and no CI re-take risk.
  - It covers the app host only, because app-switch rewrites `Host`.
  - Rehearse it on the canary before relying on it.

**Acceptance.**
- [ ] `app.wzrd.tech`, then `mini.wzrd.tech`, then `link.wzrd.tech` are Custom Domains on `airv2-app`. No zone Worker route matches them, and the zone export shows Worker records.
- [ ] `/api/version` on each host returns the deployed main SHA. Responses carry `cf-ray` and no `x-vercel-id`.
- [ ] Host routing works with no proxy headers:
  - the store home is on mini;
  - pay links are on link;
  - app pages are on app;
  - `/mini/*` on the app host behaves as in `middleware.ts:112-148`.
- [ ] `docs/operations/cloudflare-cutover.md` has every inventory row observed.
- [ ] Stripe, GitHub and email deliveries return 200 after cutover, and the `air-inbound` mail webhook URL equals `${APP_ORIGIN}/api/inbound/email`.
- [ ] air-muse and air-outbound reach airv2-app over `CONTROL_PLANE`. Their Workers Logs show no public fetch to `app.wzrd.tech`.
- [ ] The canary rehearsal is complete, including the rollback B drill with `AIRV2_ROLLBACK_B` and R-CF-13's domain guard. Rollback A is rehearsed, or recorded as unavailable while Vercel is blocked.
- [ ] `infra/workers/app-switch/` (vendored by R-CF-02) dry-runs in `workers.yml` (R-CF-13), and its README holds the emergency route procedure. The WfP deploy jobs run only with `vars.WFP_ENABLED == '1'`. The owner retires app-switch after the soak.
- [ ] `vendor` is reserved, and no existing username or app slug collides with it.
- [ ] P6: `workers_dev:false`, deployed only after a fal webhook has been seen on `https://app.wzrd.tech` with `CREATIVE_WEBHOOK_ORIGIN=https://app.wzrd.tech` and after `AIRV2_SMOKE_URL` is the app host. The canary record and certificate are gone.

**Tests.**
- `infra/workers/muse/test/controlPlane.test.ts` (vitest-pool-workers, `muse/vitest.config.ts`):
  - Add `miniflare.serviceBindings.CONTROL_PLANE` as a function stub.
  - Assert the stub receives the path, the method and `authorization: Bearer <MUSE_WORKER_TOKEN>`.
  - Without the binding, assert it falls back to `fetch`, using `vi.spyOn(globalThis, "fetch")` (verify under pool 0.22).
- NEW `infra/workers/test/outbound.controlPlane.test.mts` (root `infra/workers/vitest.config.mts`, run by the `dispatcher` matrix entry):
  - With `env.CONTROL_PLANE = { fetch: vi.fn() }`, the binding is used.
  - `redirect: "manual"` is kept.
  - `set-cookie` is still stripped.
- `apps/web/lib/wzrdmail/client.test.ts`: extend `describe("ensureWebhook")` at `:268`. In `apps/web/lib/agentmail/client.test.ts`, add a new `describe("ensureWebhook")`. Cover three cases:
  - when the URL differs, one PATCH carries `{url, pod_ids}`;
  - when the URL is equal and the pods are unchanged, there is no PATCH;
  - a 4xx on PATCH resolves and logs a warning.
- NEW `apps/web/scripts/webhook-inventory.test.ts` (picked up by the `unit` project):
  - Over vendor fixtures, classify each URL as `ok`, `wrong-host` or `missing`.
  - `--fix` builds the right request for each vendor.
  - No network calls.
- `apps/web/lib/miniapps/nested.test.ts`: `isReservedWord("vendor")` is true. `apps/web/middleware.test.ts` `describe("mini host")` (`:100`) is unchanged and green.
- SQL pre-check before 14.3:
  - `select username from users where username = 'vendor';` (citext, `0001_init.sql:10`) returns 0 rows.
  - `select slug from mini_apps where slug like '%-vendor';` is listed; those appnames lose new drafts.
- Manual probes:
  - Runbook step 7.
  - `dig +short <host>` before and after: still Cloudflare anycast.
  - `npx wrangler tail airv2-app --format json --status error` during each window.
  - The canary rehearsal.

**Risks & notes.**
- **`HOSTING.target` is shared.** app-switch and airv2-app both read it, so a flip before P4 also redirects live app-switch traffic. Keep `vercel` until P4 T0 unless the owner takes the soft step. Only the owner writes the production key (§2.5 C22). Devin tests the switch against local KV (`wrangler dev`, `--local`) or a test namespace. workers.dev is not in `SWITCH_HOSTS`, so for the P1–P3 workers.dev smoke R-CF-02 serves OpenNext there whatever the target is.
- **Self-fetch 522.** A Worker calling its own Custom Domain gets 522. `lib/orchestrator/sharedBridge.ts:203-204` breaks only after P4, and silently, because its catch returns null. R-CF-12's `selfFetch` sweep is a P4 entry gate: zero server-side `fetch` calls to `${env.appOrigin()}` outside `lib/http/self.ts`. `selfFetch` goes through `SELF` to the `Internal` entrypoint (§2.5 C1, C3), which avoids both the 522 and the switch.
- **`x-forwarded-host` spoofing.** On direct Cloudflare traffic, nothing overwrites a client-supplied `x-forwarded-host`, and `lib/http/origin.ts:57-64` trusts it (a CSRF bypass). Before P4, R-CF-02 must stop trusting it on untrusted requests, using the middleware-resolved host and `lib/http/edge.ts` (§2.5 C11). R-CF-02's public `fetch` must also strip every inbound `x-air-*` header (§2.5 C1). `Internal` never strips headers, and it is reachable only through `SELF`.
- **Pinned hosts.** Cal.com and existing mail webhooks pin the host permanently. Never put a workers.dev or canary URL into a user-visible string.
- **Replace semantics.** Removing one host from a non-empty `routes` list detaches it on the next deploy. Every host change is a reviewed PR, merged only at T0.
- **Workers CI.** Merging `infra/workers/**` triggers `workers.yml`.
  - `deploy-dispatcher` needs `deploy-outbound`; `deploy-create` and `deploy-dev-router` need only `check` (`workers.yml:75-160`).
  - All three WfP jobs would fail without the add-on, which is why 14.1a gates them.
- **mini and link gap.** mini and link are dead on Vercel today, and iMessage cards open mini URLs. Keep the P4→P5 gap to hours.
- **Zone security.** Zone settings (WAF, bot) already sit in front of every webhook, because the records were proxied, so cutover does not change them.

**Depends on.** 14.1a: none. 14.1b: R-CF-01, R-CF-02, R-CF-13. 14.2–14.4: R-CF-01 through R-CF-13, plus R-CF-15 (alerts live before P4).
