# R-CF-09 — Media without native binaries

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-09: …`.

**Why.** Three Node-only media dependencies break on workerd:
- **sharp.** It is a native addon, imported statically at `lib/miniapps/identityThumb.ts:20` and `lib/identity/references.ts:7`. Both files sit in the `/mini/[app]` static graph (`lib/miniapps/apps/index.ts:27` → `apps/onboarding.tsx:152,241`), so every mini app fails at module evaluation. `sharp` is not declared in `apps/web/package.json` at all; it arrives through `next` (resolved 0.35.5). `lib/create/icon.ts:171-202` already imports it lazily, and on workerd it silently stores unresized icons.
- **heic-convert.** `lib/identity/heif.ts:9` pulls in libheif-js, which compiles WebAssembly from bytes as it loads. On workerd that is a hard crash for 14 entries, including `/api/chat` and inbound iMessage.
- **ffmpeg.** The freeze stitch runs `ffmpeg-static` through `execFile` (`lib/miniapps/freeze.ts:11,23,1010,1219`) and buffers clips of up to 250 MB (`:331,1151-1169`). Workers have no `child_process`.

Memory is 128 MB per isolate on Paid too, and several paths exceed it:
- `readZip` materializes every entry: a 25 MB zip and 100 MB unpacked for bundles, and 50 MiB and 200 MB for imports (`lib/miniapps/bundles.ts:97-153`, `lib/create/import.ts:56-62`).
- Identity videos and twin consent videos of up to 50 MB are buffered, guarded and hashed (`lib/identity/assets.ts:87,202-205`, `lib/identity/twin.ts:97,127`, `lib/creative/store.ts:90`).
- SigV4 puts hash and copy every body (`lib/storage/r2.ts:113,257`).

**Deltas.**

*Config*
- `apps/web/wrangler.jsonc`:
  - `"images": { "binding": "IMAGES" }`
  - `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "air-media" }]`. This is the same bucket air-create binds (`infra/workers/create/wrangler.jsonc:25`). The bucket already exists, so R-CF-13's `ensure-resources` job needs no step for it (§2.5 C18).
  - No `services` entry here. `SIDECAR` (`{"binding": "SIDECAR", "service": "air-sidecar"}`) belongs to R-CF-03, which lands first in P2.
  - Regenerate `apps/web/worker/worker-configuration.d.ts` in the same PR with `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` (§2.5 C4).
- `apps/web/worker/handler.ts` (R-CF-02's `createFetchHandler`) — return 404 for `/_next/image` before OpenNext.
  - The branch goes on the Cloudflare path, after the switch branch and directly before `openNext.fetch`. With `target=vercel`, a switch host proxies `/_next/image` like any other path. That keeps the fal webhook as the only app path Cloudflare serves whatever the target (§2.5 C1). `Internal.fetch` needs no check, because only server code reaches it, through `SELF`.
  - R-CF-02 owns the handler. If the branch is missing when this PR lands, add it here with a `worker/handler.test.ts` case, because binding `IMAGES` is what makes it necessary.
  - Binding `IMAGES` turns on OpenNext's public optimizer (`@opennextjs/cloudflare@1.20.10 dist/cli/templates/worker.js:29-32`, `images.js:94-101,118-126`).
  - The app has no `next/image`, so the optimizer would only let anyone spend the account-wide transformation quota on the 27 raster files in `apps/web/public`.
  - `/cdn-cgi/image/*` needs nothing, because it "does not reach production workers" (`worker.js:23-25`).
- `infra/workers/sidecar/wrangler.jsonc` — R-CF-03 creates the Worker and its scaffold. Append to the scaffold's arrays, after R-CF-03's `ImessageRelay` entries:
  ```jsonc
  "containers": [ /* R-CF-03 ImessageRelay */ { "class_name": "MediaWorker", "image": "./media/Dockerfile", "instance_type": "standard-1", "max_instances": 2 } ],  // §2.5 C14
  "durable_objects": { "bindings": [ /* IMESSAGE_RELAY */ { "name": "MEDIA_WORKER", "class_name": "MediaWorker" } ] },
  "migrations": [ /* v1-imessage-relay */ { "tag": "v2-media-worker", "new_sqlite_classes": ["MediaWorker"] } ]   // §2.5 C8: next free vN on air-sidecar
  ```
  - The scaffold declares its SQLite DO classes through `migrations`, so `MediaWorker` uses `migrations` too; the two forms cannot be mixed ([Containers config](https://developers.cloudflare.com/containers/configuration/wrangler/)). Tags on this Worker are append-only in merge order (§2.5 C8). Use the next free `vN`: that is `v2`, unless R-CF-05's optional `TenkiRelay` merged first.
  - `MediaWorker` uses the default scheduling policy, so `image`, `instance_type` and `max_instances` apply to it. R-CF-03's relay uses the `durable_object` policy, where they do not. The limits are at most 2 instances and a `sleepAfter` of 2 min (§2.5 C14). §3 and R-CF-15 compute cost and set alerts on exactly these numbers.
  - The scaffold already keeps the sidecar private: `workers_dev: false`, `preview_urls: false`, no `routes`. `/media/v1/*` is binding-only, like `/imessage/v1/*`, and there is no auth header (§2.5 C15).
  - The sidecar reads its own Worker secrets directly. `applyEnv` (§2.5 C3) belongs to airv2-app's entrypoints and is not imported here.
  - Regenerate `infra/workers/sidecar/worker-configuration.d.ts` with `npx wrangler types`.
- `apps/web/env.example.md` — by hand, add `MEDIA_ALLOWED_HOST` (the Supabase project host, `<ref>.supabase.co`) to the `## secret @air-sidecar` block, with its tag comment (§2.5 C20). The owner pushes it with `npm run cf:env -- push --worker air-sidecar` (§2.5 C22). Until then the container rejects every URL with 400, and the stitch degrades to the raw move.
- `infra/workers/sidecar/package.json` — add `@cloudflare/containers`.
- `.github/workflows/workers.yml` — this PR does not change it. R-CF-13 owns the `sidecar` check row and the `deploy-sidecar` job (§2.5 C18); this PR adds the `MediaWorker` image to the package they check and deploy. The image build needs Docker on the runner, which `deploy-sidecar` already has for `ImessageRelay` (verify whether `--dry-run` builds the image).
  - Deploy order: on merge, `deploy-sidecar` ships the `MediaWorker` class and its migration. Until then `/media/v1/*` returns 404 and `stitchFreezeClip` degrades to the raw move. airv2-app needs no ordering gate beyond R-CF-03's `SIDECAR` one.

*Images (`IMAGES` replaces sharp and heic-convert; lazy, never at module scope)*
- `apps/web/lib/media/images.ts` NEW — the adapter:
  - `heicToJpeg(input, {quality: 90})`
  - `heicToPng(input, {maxDim?})`
  - `coverJpeg(input, size, {quality: 78})`
  - `coverPng(input, size)`
  - `composeSheet(photos, {cell: 512, inset: 4, bg: [18, 22, 34], quality: 90})`
  - `info(input)`, which is free.

  Behaviour:
  - On workerd (`onWorkerd()`) it runs `cfEnv().IMAGES.input(stream).transform(…).output(…)`. Both helpers come from `lib/runtime/platform.ts` (R-CF-12, §2.5 C2).
    - Every airv2-app entrypoint runs `applyEnv(env)` first, and that calls `setCfEnv` (§2.5 C3). So the adapter also works inside R-CF-08's Workflow and R-CF-04's DO, where `getCloudflareContext()` throws. Never call `getCloudflareContext()` here.
    - A missing binding maps to `ImagesUnavailableError`.
    - `.input()` takes at most 20 MB and accepts HEIC ([binding](https://developers.cloudflare.com/images/optimization/binding/)).
    - EXIF rotation is applied even when metadata is discarded, which replaces sharp's `.rotate()` ([features: metadata](https://developers.cloudflare.com/images/optimization/features/#metadata)).
  - For JPEG output, pass `metadata: "none"`; the default `copyright` keeps a tag. Verify whether the field belongs in `transform` or `output`. `guardMediaUpload` still strips metadata afterwards (MA8).
  - On Node (dev and the Vercel rollback) it runs `await import("./images.node")`. `apps/web/lib/media/images.node.ts` NEW imports `sharp`/`heic-convert` inside its functions.
  - Errors map to `ImagesQuotaError` (9422), `ImagesInputError` (over 20 MB, or unreadable) and `ImagesUnavailableError` (9432: legacy Image Resizing subscription) ([codes](https://developers.cloudflare.com/images/reference/troubleshooting/)).
- `apps/web/lib/media/solidPng.ts` NEW — builds the base canvas in memory with `node:zlib` `deflateSync` + `crc32`, because the binding has no blank-canvas primitive. Output size is set by the base image ([draw](https://developers.cloudflare.com/images/optimization/draw-overlays/)).
- `apps/web/lib/identity/heif.ts:9,46-58` — drop the static import. `heifToJpeg`/`heifToPng` delegate to the adapter; `isHeif` (`:37-42`) is unchanged.
  - On CF, `heifToPng` caps the long edge at 2048 px. A full-resolution iPhone PNG (tens of MB) plus the guard copy and the ingest copy does not fit in 128 MB, and the largest freeze render is 1080P (`freezeRecipe.ts:28-30`).
  - On `ImagesQuotaError` and `ImagesInputError`, reuse the existing message "couldn't read that HEIC image — export it as JPEG and retry." (`lib/identity/assets.ts:162-165`).
  - Call sites stay unchanged apart from the delegation: `identity/assets.ts:154-159`, `creative/store.ts:249-251`, `miniapps/drawCommand.ts:104-105` and `miniapps/freeze.ts:266-267`. `guardMediaUpload` still runs after conversion for MA8.
- `apps/web/lib/miniapps/identityThumb.ts:20,70-86` — remove sharp.
  - Store thumbnails at **`<userId>/thumbs/<assetId>-<w>.jpg` in the private `creative-assets` Supabase bucket**. Never use air-media: it is public on media.wzrd.tech (`r2.ts:2-3`, `env.ts:594-596`), and `thumbHref` puts the asset id in the HTML (`:43-45`).
  - Read through: on a hit, stream the stored thumbnail. On a miss, stream the original into `coverJpeg(w)`, upload with `upsert`, then serve.
  - Headers stay as at `:86-96`: `private`, `no-referrer`, `default-src 'none'`.
- `apps/web/lib/identity/assets.ts` `deleteIdentityAsset` (`:530-569`) — remove the four thumbnail keys, one per `THUMB_WIDTHS` (`identityThumb.ts:33`). Do it right after `removeIdentityAsset` (`:550`) and **before** the `upload:` early return (`:553`), because generated images get thumbnails too.
- `apps/web/app/api/admin/delete/route.ts:346` — the folder list `["masters","deliveries"]` gains `"thumbs"` and `"staging"`, which are flat. It also gains `"freeze-clips"`, which needs a two-level walk:
  - Objects there are nested per session (`<userId>/freeze-clips/<sessionId>/<uuid>.<ext>`, `freeze.ts:363`). Listing `freeze-clips` returns folder names, so the flat `remove` at `:357` removes nothing and the loop breaks.
  - List each session folder and remove its objects.
  - This fixes a pre-existing gap: account deletion never removes clips.
- `apps/web/lib/identity/references.ts:7,198-236` — `composeReferenceSheet` uses the adapter:
  1. Start from a `solidPng(cols*512, rows*512, #121622)` base.
  2. For each photo (1–6, `:19-20`), call `.draw(IMAGES.input(photo).transform({width: 504, height: 504, fit: "cover", gravity: "auto"}), {left, top})`.
  3. Finish with `.output({format: "image/jpeg", quality: 90})`.

  Accept `readonly (Buffer | ReadableStream)[]`, and stream the selfie bodies instead of buffering them (`:178-184`).
- `apps/web/lib/create/icon.ts:171-202` — `resizeIcon` becomes two `coverPng` calls (512 and 180), so `resized: false` happens only on Node without sharp. `storeIcon` (`:216-238`) uses the binding-backed `putObject`. `readBoxIcon` (`:247-275`) is unchanged: at most 8 MiB of base64 is fine on Paid, and the Box path belongs to R-CF-05.

*Freeze stitch via the `air-sidecar` MediaWorker (ffmpeg parity)*
- `apps/web/lib/miniapps/freezeGraph.ts` NEW, pure. Move into it:
  - the `FreezeClipWindow` type (`freeze.ts:344-350`); `freeze.ts` re-exports it, and this keeps the vendored bundle free of `freeze.ts`'s import graph;
  - `buildFreezeEditGraph` (`freeze.ts:1037-1101`);
  - the probe regexes, as `parseFfmpegProbe(stderr)` (`:1013-1026`);
  - the argument list, as `freezeStitchArgs(src, cam, out, graph, hasAudio)` (`:1195-1218`).

  `freeze.ts` also re-exports `buildFreezeEditGraph`, because `freeze.test.ts:20` imports it.
- `infra/workers/sidecar/scripts/vendor-freeze-graph.mjs` NEW — esbuild-bundles `freezeGraph.ts` into the committed `media/freezeGraph.mjs`. A drift test fails when the vendored hash differs from the source.
- `infra/workers/sidecar/media/Dockerfile` NEW — `node:22-slim` for `linux/amd64`. Run `npm i ffmpeg-static@5.2.0`, the version the lockfile resolves for the Vercel path, and copy in `server.mjs` + `freezeGraph.mjs`.
- `infra/workers/sidecar/media/server.mjs` NEW — `POST /v1/freeze-stitch`. This is the container path; the sidecar Worker exposes it as `/media/v1/freeze-stitch`.
  - Request body: `{jobId, clip: {url, ext}, camera: {url}, window: {clipIn, clipOut, freezeAt}, upload: {url}}`.
  - Return 400 for any URL whose host is not `MEDIA_ALLOWED_HOST`, the Supabase project host, which the sidecar passes in as container env. With `enableInternet` on, this stops the container from being used as an open fetcher.
  - Steps:
    1. Stream both downloads to `/tmp`.
    2. Probe and apply the same early exits as `freeze.ts:1175-1185`. These return `{ok: false, skipped}`.
    3. Run ffmpeg with the identical graph and args and a 300 s timeout (`:1219-1222`).
    4. Hash `out.mp4` (sha256) and record its size while streaming it.
    5. PUT it to the signed upload URL and remove the temp files.
  - Responses:
    - success: `{ok: true, sha256, bytes, width, height, durationS}`;
    - busy: 429;
    - SIGTERM: kill ffmpeg and return 503.
- `infra/workers/sidecar/src/media.ts` NEW — `class MediaWorker extends Container { defaultPort = 8080; sleepAfter = "2m"; enableInternet = true }`. The constructor sets `envVars = { MEDIA_ALLOWED_HOST: env.MEDIA_ALLOWED_HOST }`.
- `infra/workers/sidecar/src/index.ts` — add the `/media/v1/*` route next to R-CF-03's `/imessage/v1/*`, following R-CF-03's namespace rule: strip `/media`, so the container sees `/v1/*`.
  - It reads `jobId` from the buffered JSON body, which is a few hundred bytes, so the body can be replayed.
  - It forwards to `getContainer(env.MEDIA_WORKER, \`media-${fnv(jobId) % 2}\`)`. On a 429 it tries the other name once, then returns 429.
- `apps/web/lib/media/stitch.ts` NEW — `stitchFreezeClip(deps, req)` picks the backend with `onWorkerd()` (§2.5 C2).
  - On workerd it calls `cfEnv()?.SIDECAR.fetch("https://sidecar/media/v1/freeze-stitch", …)`.
  - On Node it calls `stitch.node.ts` through `await import("./stitch.node")`.
  - A missing `SIDECAR`, a 404 (the sidecar has not been redeployed yet), a 5xx or a timeout counts as a stitch failure. A 429 is a retryable busy error.
- `apps/web/lib/media/stitch.node.ts` NEW — today's local implementation (`freeze.ts:1149-1240`), importing `node:child_process`, `ffmpeg-static`, `node:fs/promises` and `node:os` **inside** the function.
- `apps/web/lib/miniapps/freeze.ts`:
  - Delete the static imports at `:11`, `:13-21` and `:23`. **Keep `node:crypto` at `:12`**: `randomUUID`/`createHash` are still used at `:363,418,1351`, and workerd supports them.
  - Move the stitch body out.
  - `clipFingerprint` (`:385-422`) feeds `hash.update(value)` once per chunk, with no `chunks[]` and no `Buffer.concat`. It hashes the same chunks, including any overshoot past 8 MiB, so the digest is unchanged and existing dedupe rows still match.

*Freeze slot and ordering* (`apps/web/lib/miniapps/freezeStitch.ts` NEW). This item ships the steps as pure functions with injected deps (`supabase`, `stitchFreezeClip` and a clock): `planFreezeStitch`, `runFreezeStitch`, `commitFreezeStitch` and `degradeFreezeStitch`. `freeze.ts` exports `releaseFreezeSlot` for the runners. Two runners call these functions in the same order:
- **Node inline (this item, P2).** `executeFreezeRender` (`freeze.ts:917-987`) replaces the `stitchFreezeIntoClip` call (`:964-977`) with plan → stitch → commit or degrade, and keeps `releaseFreezeSlot` in its `finally` (`:984-985`).
  - `executeCreativeJob` still delivers the raw move first, as today. So steps 1–2 do not apply, and steps 5–6 run in `delivered` mode.
  - On CF this runner still sits in `after()`, and with the 30 s cap it cannot finish a render. Until R-CF-08 lands, the CF acceptance below covers only the stitch backend.
- **Workflow (R-CF-08, P3).** R-CF-08 runs the same functions as the render `freeze` continuation steps, in `polling` mode, with the step names and `WorkflowStepConfig`s below (§2.5 C9).
  - R-CF-08 also adds the deferred claim that steps 1–2 describe (`claimDelivered(…, {defer: true})`, `commitGeneratedMedia({defer})`).
  - It owns the end-to-end acceptance on CF.
  - This item does not depend on R-CF-08.
1. At admission, record `clipBacked = session.clip_asset_id != null` in the sealed continuation. This is the Workflow runner only; R-CF-08 seals it.
2. For a clip-backed render, ingest calls R-CF-08's `claimDelivered(…, {defer: true})`. It writes `output_asset_id = raw` and keeps `polling`. As a result:
   - the job keeps the slot (`ACTIVE_JOB_STATUSES`, `freeze.ts:63-68`);
   - the studio keeps waiting on `activeJob` (`freezeStatus`, `:1369`);
   - the render list stays hidden, because it filters on `delivered` (`client/freeze-studio.tsx:2438`);
   - the save lane (`freeze.tsx:483-492`, which requires `delivered`) cannot ship the raw move.
3. `freeze:plan` (`retries {limit: 3, delay: "10 seconds"}`, `timeout "60 seconds"`) re-reads `freeze_sessions` exactly as `:1117-1146` does, and re-reads the job status. A swapped source or a missing clip → degrade. A terminal (cancelled) job → skip to release.
4. `freeze:stitch` (`retries {limit: 4, delay: "30 seconds", backoff: "exponential"}`, `timeout "8 minutes"`):
   - **Inside the step**, mint the clip and camera signed GETs (TTL 15 min) and `createSignedUploadUrl("<userId>/staging/freeze-<jobId>.mp4", {upsert: true})`, then call `stitchFreezeClip`.
   - Never mint them in an earlier step: outputs replay on resume, and `DELIVERY_TTL_SECONDS` is 30 min (`assets/keys.ts:16`).
   - A 429 from a busy pool throws for a retry, waiting about 7.5 min in total before the degrade path. The Node backend never returns busy.
   - Fence (§2.5 C9): the step first re-reads the job. Unless the job still holds the slot, it returns `{skipped}` without calling the container. Holding the slot means `active_job_id = jobId` and a status of `polling`, or `delivered` inline.
   - Every write is idempotent by key: the staging key is fixed and uploaded with `upsert`, adopt dedupes on `sha256`, and the commit is a CAS. An engine restart therefore repeats only the container compute.
5. `freeze:commit` (`retries {limit: 3, delay: "10 seconds"}`, `timeout "2 minutes"`, the `continue:<kind>` config):
   - Run `adoptStagedObject` with the container's sha256 and bytes. This gives `box_asset_id gmi:<sha>`, as in `store.ts:112-125`.
   - Then CAS:
     - `polling` mode: `status='delivered', delivered_at, output_asset_id=<stitched> where status='polling'`.
     - `delivered` mode (inline): `output_asset_id=<stitched> where status='delivered'`. This replaces today's unconditional `updateCreativeJob` (`:1229-1231`).
     - In either mode, zero rows means the job was cancelled: keep the asset and change nothing.
   - For clip-backed jobs in `polling` mode, append a single `completed` event here, not before the stitch as `finishFreezeRun` does today (`:958`). The inline mode keeps today's events (`:958`, `:1232-1237`).
6. Degrade path (skip, failure after retries, or timeout):
   - In `polling` mode, run the same CAS with the raw asset and append `completed`.
   - In `delivered` mode the raw move is already the output, so nothing changes.
   - Both modes log, as in `:972-976`.
7. `freeze:release` (`retries {limit: 3, delay: "10 seconds"}`, `timeout "2 minutes"`): `releaseFreezeSlot` (`:602-612`, a CAS on job id) runs **last on every path** and never earlier. It runs from the try/finally in R-CF-08's `run()`, or from `executeFreezeRender`'s `finally`.
8. `cancelActiveFreezeJob` (`:1329-1348`) is unchanged. In both modes, its `failed` status turns the commit CAS into a no-op.
- `apps/web/lib/miniapps/apps/freeze.tsx:472-511` save lane:
  - Belt and braces: also refuse while `session.active_job_id === jobId`. On the inline runner this is the guard that stops the raw move shipping during the stitch, because the job is already `delivered`.
  - Choose by `asset.bytes`: read at most 50 MiB into memory, and above that send a signed rich link.
  - Send through the R-CF-03 transport. Today `createSpectrumSender("freeze-attachment")` (`:515`) is gRPC; after R-CF-03 it selects the relay on CF. Keys come from R-CF-03's table, `imessageKey("mini", app, jobId)` (§2.5 C15).
- `apps/web/next.config.ts:13,30` — keep `ffmpeg-static` external and the `/mini/[app]` trace for the Vercel rollback build. Drop the `/mini/[app]` trace entry when `process.env.AIR_BUILD_TARGET === "cloudflare"`, which `npm run cf:build` sets (§2.5 C17), so the CF build never ships the binary. The R-CF-13 size gate enforces the 64 MiB worker limit.

*Bounded memory*
- `apps/web/lib/miniapps/bundles.ts` — add `openZip(zip, limits): ZipArchive`.
  - `entries` comes from a central-directory walk only.
  - Path, extension, `index.html`, count and total-size checks all run up front. Add a per-entry cap, `BUNDLE_MAX_ENTRY_BYTES = 32 MiB`, in `bundleLimits.ts`.
  - `read(entry)` calls `inflateRawSync(data, { maxOutputLength: entry.uncompressedSize })`.
  - These functions accept `BundleFile[] | ZipArchive` and process one entry at a time: `validateBundle`, `storeBundle`, `bundleDigest` (`create/versions.ts:154-166`), `lintBundle` (`lib/create/lint.ts:565-587`, which builds `paths` from `entries`) and `enforceCsp` (`lint.ts:602-606`). Peak memory is the zip, plus one entry, plus one utf8 copy.
  - The validation pass finishes before any put. Unvalidated bytes never land under the public `apps/` prefix, and nothing is presigned into it.
  - `readZip` (`:97`) stays as a thin wrapper for tests.
- Callers move to `openZip`: `create/versions.ts:260`, `create/drop.ts:88`, and `create/import.ts:843,1277,1371`.
  - For imports, `repoSubtree` (`import.ts:487`), `subtreeRaw` (`:508`) and `planRepository` filter `archive.entries` by path and inflate only the entries they read.
  - The caps (`import.ts:56-62`) are unchanged. Memory is now bounded by the zip (at most 50 MiB) plus 32 MiB.
  - If R-CF-10 moves import into `air-build`, it reuses this API.
- `apps/web/lib/storage/r2.ts` — use a binding-backed implementation when `cfEnv()?.MEDIA` (`lib/runtime/platform.ts`, §2.5 C2) exists and `env.r2Bucket() === "air-media"`:
  - `putObject(key, Uint8Array | ReadableStream, type)` → `MEDIA.put(key, body, { httpMetadata: { contentType } })`. A stream body must have a known length (a request/response body with `Content-Length`, or a `FixedLengthStream`) (verify).
  - New `getObjectStream(key)` → `{body, contentType, size}`. The Buffer `getObject` stays for small reads.
  - `headObject` → `MEDIA.head`; `deleteObject` → `MEDIA.delete`.
  - `listKeys` → `MEDIA.list({prefix, limit: 1000, cursor})`.
  - `deletePrefix` → list, then `MEDIA.delete(keys[])` with up to 1,000 keys per call.

  `presignPut`/`presignGet` (`:163,210`) stay SigV4, because bindings cannot presign; so the `R2_*` secrets stay. Drop the `new Uint8Array(body)` copy (`:257`). This item owns the binding-backed `r2.ts`, and R-CF-10 reuses it.
- `apps/web/lib/miniapps/apps/published.ts:90,141` — pass `getObjectStream().body` into `NextResponse`. `lib/miniapps/appsApi.ts:87` keeps the Buffer `getObject`, because it parses a small JSON manifest. **Keep serving in Next.** A fast path in the worker entry would skip the gate chain in `app/mini/[app]/[...path]/route.ts:40-43` (`ownerSessionFromStore`, `visibilityGate`, `sessionFromCookie`).
- `apps/web/lib/creative/hash.ts` NEW — `sha256Transform()` returns a pass-through `TransformStream` plus a `digest()`/`bytes()` pair, built on incremental `createHash("sha256")` (`node:crypto`; supported on workerd per the contract). `sha256OfStream(stream)` wraps it. The same code runs on both runtimes.
- `apps/web/lib/creative/media-url.ts` — add `streamSafeGeneratedMedia`.
  - It keeps the host allowlist and the manual redirect loop (`:238-297`).
  - It checks the first ≥16 bytes with `bytesMatchMimeType` (`:164`) in a pass-through, counts bytes against `MAX_GENERATED_MEDIA_BYTES` (`:48`), and returns a stream.
  - `fetchSafeGeneratedMedia` stays for the inline path.
- `apps/web/lib/creative/store.ts`:
  - `ingestGeneratedStream(supabase, userId, jobId, stream, mimeType)` pipes through `sha256Transform` into `<userId>/staging/<jobId>.<ext>` (storage-js streams with `duplex: 'half'`). It returns `{stagingKey, ext, sha256, bytes}`, so the object is never re-downloaded to hash it.
  - `adoptStagedObject(supabase, userId, {stagingKey, ext, refPrefix, sha256?, bytes?})`:
    - If `sha256` is absent (direct uploads), stream the staged object through `sha256OfStream`.
    - Dedupe on `unique(user_id, sha256)`.
    - If no row exists, `storage.move` the object to `masterKey` (`assets/keys.ts:48`); treat an existing target as a dedupe (verify the move semantics).
    - Insert the row; on 23505, select instead.

  Digests equal today's buffered ones, so there is no schema change. `ingestBytes` (`:78-130`) stays for images of 12 MB or less and for TTS audio.
- `apps/web/lib/identity/assets.ts:181-206` and `lib/identity/twin.ts:116-158` — identity video and audio, and the twin consent video (buffered at `twin.ts:127`, cap `CONSENT_VIDEO_MAX_BYTES` `:97`), switch to direct signed upload. Follow `mintFreezeClipUpload`/`registerFreezeClip` (`freeze.ts:353-374,454`).
  - NEW actions in `onboarding.tsx` next to `upload_media` (`:3706-3738`) and `upload_consent` (`:3990-3998`):
    - `mint_identity_upload` → `createSignedUploadUrl("<userId>/staging/<uuid>.<ext>")`.
    - `register_identity_upload` checks the type allowlist; checks the size against `IDENTITY_VIDEO_MAX_BYTES`/`IDENTITY_AUDIO_MAX_BYTES` (`assets.ts:87,97`) or `CONSENT_VIDEO_MAX_BYTES`, using storage info; checks the head magic (`Range: bytes=0-15`); then adopts.
  - Client: the upload tiles (`uploadTile`, render sites `onboarding.tsx:1971,2036`) are plain multipart forms. Add the mint → PUT → register flow to `lib/miniapps/client/identity-booth.tsx` (built by `scripts/build-identity-booth.mjs`, loaded at `onboarding.tsx:2646`). Verify it loads on the selfies/voice/twin steps, and add the tag there if not.
  - Images (8 MB or less) keep the form post.
- `apps/web/lib/creative/store.ts:294-316` (inbound iMessage staging) — on CF:
  - Skip soundtrack extraction when the attachment is over 40 MiB, degrading the same way as `:313-315`.
  - Reject attachments over 50 MiB: a 100 MiB Buffer plus the upload copy cannot fit in 128 MB. Check the size before reading the body. R-CF-03's relay download (`GET /v1/attachments/:guid`) returns `content-length` with the headers (verify that `getAttachment` surfaces it to callers).
- `apps/web/lib/creative/imessage.ts:246-255` — choose by `result.asset.bytes`: download at most 50 MiB, and above that use the rich link (`:262-273`). The file name stays `wzrd-<sha8>` (`:251`), because sha256 is still non-null. Keys stay R-CF-03's `imessageKey("creative", jobId, …)` (§2.5 C15).
- `apps/web/lib/media/poisonImports.test.ts` NEW — fails CI on a static import of `sharp`, `heic-convert`, `ffmpeg-static` or `node:child_process` in `apps/web/{lib,app}/**/*.{ts,tsx}`, outside `*.node.ts` and `*.test.ts`.
  - Tests are excluded because `identityThumb.test.ts:6` and `references.test.ts:1` import sharp.
  - In the repo today only `references.ts`, `heif.ts`, `freeze.ts` and `identityThumb.ts` match. R-CF-12 (m) makes those imports lazy first.
  - This test complements R-CF-12's graph walk (`lib/runtime/poison-imports.test.ts`), which checks route entries only. This one bans the static import in any module. After this item, only `*.node.ts` modules reach these packages.

**Acceptance.**
- [ ] Every `/mini/<slug>` renders on airv2-app with no 1101 at module evaluation, and the poison-import test is green.
- [ ] On CF:
  - a HEIC selfie becomes a JPEG asset, correctly oriented and with EXIF stripped;
  - a HEIC iMessage attachment is staged as `image/jpeg`;
  - a HEIC freeze upload is stored as a PNG with a long edge of at most 2048 px.
- [ ] `?thumb=<id>&w=96` returns a 96×96 JPEG with `Cache-Control: private, max-age=300`. A repeat request is served from `<userId>/thumbs/` without calling Images. Deleting the asset, whether an upload or a generated image, removes the four thumbnails. Admin delete empties `thumbs/`, `staging/` and every `freeze-clips/<sessionId>/` (route test, plus a test account).
- [ ] Reference sheets for 1–6 selfies produce `cols×512 × rows×512` JPEGs. An icon upload on CF stores 512 and 180 PNGs with `resized: true`.
- [ ] `/_next/image?url=/app-icons/x.png&w=64&q=75` returns 404 on airv2-app (workers.dev).
- [ ] Freeze stitch backend (P2; no Workflow needed). Under `wrangler dev` with Docker, the sidecar probe `POST /media/v1/freeze-stitch` runs on the golden fixtures:
  - it returns `{ok: true, sha256, bytes, …}` and writes the output to the signed staging URL;
  - the output matches `stitch.node.ts` for the same inputs: same stream layout, duration within one frame;
  - when both instances answer 429, the route tries the other name once and returns 429, and `stitchFreezeClip` raises that as the retryable busy error.
- [ ] Node inline runner (`next dev` locally), clip-backed render:
  - it holds the slot until commit, and `releaseFreezeSlot` runs last;
  - save is refused during the stitch (`active_job_id === jobId`);
  - cancelling mid-stitch leaves `failed` with no output swap;
  - a source swap mid-render degrades to the raw move.
- [ ] The end-to-end clip-backed render on CF is R-CF-08's acceptance. That render stays `polling` until commit, and a busy pool waits and then stitches, or degrades after about 7.5 min. This item supplies the step functions and step configs it runs.
- [ ] The media container returns 400 for a non-Supabase `clip.url`, and air-sidecar has no public route.
- [ ] Publishing a 25 MB zip that unpacks to 100 MB, and running a 50 MiB import fixture, both succeed on CF with no "Exceeded Memory" outcome in Workers Logs. A bundle that fails validation makes zero R2 puts.
- [ ] A 50 MB identity video and a 50 MB consent video uploaded by signed upload register with the same sha256 that the Node path computes for the same bytes.
- [ ] `storeBundle` makes no SigV4 fetches (check with `wrangler tail`). `deletePrefix` is checked against local R2 under `opennextjs-cloudflare preview`, because deleting objects in `air-media` is owner-only (§2.5 C22). `presignPut`/`presignGet` still work.

**Tests.**
- `lib/media/images.test.ts` NEW — a fake `IMAGES` binding records the call chains. Cover:
  - the HEIC chain;
  - cover params and `metadata: "none"`;
  - sheet `left/top` for 1–6 tiles;
  - the 9422/9432/over-20 MB error mapping, and a missing binding → `ImagesUnavailableError`.
- `lib/media/solidPng.test.ts` NEW — IHDR, CRC and pixel colour.
- `lib/media/stitch.test.ts` NEW:
  - backend selection by `onWorkerd()`;
  - the `https://sidecar/media/v1/freeze-stitch` URL;
  - the error map: a missing `SIDECAR`, a 404 or a 5xx → failure; a 429 → busy.
- `lib/miniapps/identityThumb.test.ts` — today it uses sharp (`:6,52,97,112`). Switch to an adapter fake, and add thumb-store hit/miss and deletion cases. Keep the real-sharp case under `describe.runIf(hasSharp)` with a dynamic import.
- `lib/identity/references.test.ts` — today it uses sharp (`:1,11,57`). Switch to the adapter fake and keep a real-sharp case under `runIf`.
- `lib/identity/assets.test.ts` NEW (the repo has none today) — `deleteIdentityAsset` removes thumbnails for generated assets too.
- `lib/miniapps/freezeGraph.test.ts` NEW — move the `buildFreezeEditGraph` suite from `freeze.test.ts:341+` and add `parseFfmpegProbe` stderr fixtures.
- `lib/miniapps/freezeStitch.test.ts` NEW:
  - deferred delivery (`polling` mode) and the inline `delivered` mode;
  - the cancel race, in both modes;
  - the source-swap degrade;
  - the busy error is retryable, and the driver degrades after the last attempt;
  - release runs last on every path;
  - the stitch fence: a job that no longer holds the slot never reaches `stitchFreezeClip`;
  - signed URLs are minted per call (a fake clock replays a plan older than 30 min and it still works).
- `infra/workers/sidecar/test/media.test.ts` NEW, following `infra/workers/create/test/*.test.ts` — protocol tests with a fake container `fetch`:
  - the URL-host 400;
  - the `/media` prefix strip;
  - the single failover on 429.

  An optional Docker golden job runs `server.mjs` on fixtures: an H.264 MP4, a rotated HEVC `.mov`, a silent camera leg, and 480P/768P/1080P.
- `lib/miniapps/bundles.test.ts` — add cases:
  - `openZip` never inflates while listing;
  - an oversize entry is rejected before inflate;
  - a failing validation makes no puts;
  - the digest is the same for array and archive sources;
  - `lintBundle` gives the same findings for both.
- `lib/storage/r2.binding.test.ts` NEW — a fake `R2Bucket` with a stream put, a list cursor, and delete batches of 1,000.
- `lib/creative/hash.test.ts` NEW — `sha256Transform`/`sha256OfStream` match a one-shot `createHash`, and the `clipFingerprint` fixture digest is unchanged.
- `lib/creative/store-staging.test.ts` — add adopt idempotency at each crash point, and the 50 MiB inbound reject.
- `app/api/admin/delete/route.test.ts` (exists) — add nested `freeze-clips` removal.
- Register the new pure suites in `vitest.pure-tests.txt`.
- Manual probes:
  - Run `opennextjs-cloudflare preview`, upload a HEIC selfie in `/mini/onboarding`, and check the thumbnails in the preview's log output (or in `wrangler tail airv2-app` on the workers.dev deploy).
  - Run `cd infra/workers/sidecar && npx wrangler dev` with Docker, then `curl -XPOST localhost:8787/media/v1/freeze-stitch` with fixture signed URLs.
  - Run `wrangler containers list`.
  - Wrangler's local Images mode supports only basic operations (verify), so check `draw`/`gravity` against the remote binding.

**Risks & notes.**
- Images output differs from sharp. `gravity: "auto"` replaces `position: "attention"`, and there is no 4:4:4 chroma control (`references.ts:234`). Pixel-exact tests must move to dimension and format assertions. New sheets get new digests, so they do not dedupe against old ones.
- Images cost is counted per unique transformation per month ([pricing](https://developers.cloudflare.com/images/pricing/)).
  - Persisted thumbnails cost one transform per asset and width, ever. HEIC costs one per upload, and a sheet costs one per selection.
  - The `/_next/image` 404 blocks public burn.
  - Whether each `.draw()` counts separately is unverified. R-CF-15 adds the budget alert; a per-user cap is deferred to R-CF-15.
  > Owner action (§6, blocks P2): the contract's "5,000 free, then usage" holds only on the Images Paid plan. On Images Free, the 5,001st unique transformation in a month returns 9422 (not billed), and HEIC uploads then fail with the export-as-JPEG message. Decide on Images Paid before P2.
- Owner action before P2 (§6): confirm the account is on the Images subscription, not legacy Image Resizing (error 9432).
- MediaWorker:
  - Cold start is 1–3 s or more. Host restarts send SIGTERM; the step retries and is idempotent (same staging key, `upsert`).
  - `standard-1` (½ vCPU) encodes libx264 veryfast more slowly than Vercel. Measure p95; if it is over 240 s, the owner decides on `standard-2` (§6). The contract fixes `standard-1`.
  - Memory is billed while the container runs, including the 2 min `sleepAfter`. The cap of 2 instances (§2.5 C14) bounds the ceiling that §3 computes.
- fal `merge-videos` is a later optimization only:
  - `MergeVideosInput.resolution` must be 512–2048 px per side, which rejects `480P` (`freezeRecipe.ts:28-30`).
  - The camera leg is always silent (`generate_audio: false`, `freezeRecipe.ts:360`), so the legs would mix audio and no audio.
  - HEVC, HDR and rotation are unverified.

  Keep ffmpeg parity until golden tests pass on fal.
- Unverified:
  - `storage.move` behaviour when the target exists, and the signed-upload validity window;
  - the project's file-size limit for stitched outputs and 50 MB identity and consent videos;
  - streamed uploads to Supabase Storage without `Content-Length`. If they are rejected, wrap the body in a `FixedLengthStream` when the length is known; otherwise buffer up to 50 MB.
- Behaviour changes:
  - The identity video/audio and consent upload contract changes on the client: signed upload, then register.
  - On CF, inbound iMessage attachments over 50 MiB are rejected, and HEIC freeze stills are capped at 2048 px.
  - On the Node inline runner, a cancel during the stitch no longer swaps in the stitched output (commit CAS), and save is refused while the slot is held.
- Staging objects from identity uploads that are never registered leak until account deletion, which now removes `staging/`.

**Depends on.**
- R-CF-01: env packing, which supplies the Supabase and R2 values these paths read on airv2-app. Also `cf:env -- push --worker air-sidecar` for `MEDIA_ALLOWED_HOST`.
- R-CF-02: the entry and `createFetchHandler` (the `/_next/image` 404 slot), `applyEnv`, and the generated `worker-configuration.d.ts` (§2.5 C3, C4).
- R-CF-03: the `air-sidecar` scaffold (`migrations`, the `/media/v1/*` namespace, binding-only access), the `SIDECAR` binding, and the iMessage transport and attachments for the save lane.
- R-CF-12: `lib/runtime/platform.ts` (`onWorkerd()`, `cfEnv()`; §2.5 C2), and the (m) lazy imports this item replaces.
- R-CF-13: the `sidecar` check row and the `deploy-sidecar` job (§2.5 C18), and the size gate.
- R-CF-08 is not a dependency. R-CF-08 (P3) depends on this item: it runs `freezeStitch.ts` as `CreativeJob` steps and adds the deferred claim. Until then the freeze render cannot finish on CF anyway, because it runs in `after()`.
