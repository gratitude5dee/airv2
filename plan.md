# plan.md — freeze

A first-party mini-app at `mini.wzrd.tech/freeze`. The owner picks a photo three ways, choreographs a camera move around it, and gets back a short video where the scene is frozen in time and only the camera moves. The reference implementation is `blendi-remade/freeze`; the render backend is fal's `minimax/h3-max/multi-angle/image-to-video`; the app shape is a port of the `/draw` studio pattern.

This is a renderer on top of the existing creative pipeline, not a new subsystem. Everything below reuses `creative_jobs` metering, the fal queue client, `creative_assets` storage, and the mini-app shell.

## 1. What it does

Three steps, one screen each, sized for an iPhone in a Messages webview:

1. **Source.** Pick one: Take Photo, Upload Photo, or Generate (sketch canvas + prompt on the Flare quality modes). All three converge on one `creative_assets` row: a PNG the model can consume.
2. **Camera.** A touch camera-path editor. The reference video shows fal's playground editor: a 3D viewport with the photo standing on a grid, an orbit path with keyframe dots, a draggable camera glyph, and a keyframe timeline along the bottom with a scrub playhead. We keep the model and interaction grammar, and rebuild the rendering as a 2D canvas projection (no WebGL: the lite surface forbids it). Preset moves sit one tap away on a chip rail.
3. **Result.** Loop the MP4, Send it to iMessage, or go back and try another move on the same source.

The reference app freezes a frame out of a user video and splices the rendered camera move back into the footage. Ours starts from a still and ships only the rendered clip, so the whole ffmpeg assembly lane in the reference (`lib/edit-plan.ts`, `lib/export.ts`) is out of scope.

## 2. Render contract (from the reference)

`POST https://queue.fal.run/minimax/h3-max/multi-angle/image-to-video`

```ts
interface CameraKeyframe {
  time: number;       // 0..1 over the clip
  azimuth: number;    // -360..360 degrees around the subject
  elevation: number;  // -90..90 degrees
  distance: number;   // > 0, camera radius multiplier
}

{
  image_url: string;            // reference passes a data URI; we pass a signed asset URL
  duration: 5 | 6;              // seconds
  resolution: "480P" | "768P" | "1080P";
  prompt: string;               // FROZEN_SCENE_PROMPT + optional return clause
  prompt_expansion_mode: "balanced";
  enable_safety_checker: true;
  seed?: number;                // safe integer
  camera_trajectory: CameraKeyframe[];   // 2..12 keyframes
}
```

The `FROZEN_SCENE_PROMPT` is the product. It instructs the model that the scene is one instant of stopped time, people and animals are statues, airborne objects stay suspended, and all apparent motion is camera parallax. Presets with `returnsToStart: true` append a second clause demanding the final pose match the opening frame. Port both verbatim into `lib/miniapps/freezeRecipe.ts`.

Validation to mirror from the reference `app/api/generate/route.ts`: 2–12 keyframes, `time` in [0,1], `|azimuth|` ≤ 360, `|elevation|` ≤ 90, `distance` > 0, `duration` ∈ {5,6}, `resolution` in the enum, `seed` a safe integer, `prompt` capped at 2000 chars. Add monotonically increasing `time` and first-keyframe `time === 0`, last `time === 1`, which the reference validates implicitly through its presets.

### Preset port

Reference `lib/recipe.ts` ships 16 presets: `swing`, `rise`, `orbit`, `orbit-left`, `arc-return`, `rise-return`, `arc-left-return`, `wide-return`, `dip-return`, `high-arc-return`, `low-arc-return`, `sway-return`, `halo`, `halo-left`, `arc-left`, `low-angle`. Port all of them with names and durations intact. Two correctness notes carry over:

- Full-turn presets use nine 45°-step keyframes reaching ±360 at `t ≈ 0.833` then hold to `t=1`. Never normalize the final azimuth back to 0; that would command a reverse orbit.
- `returnsToStart` presets build the trajectory to be back at the opening pose by `t=0.8`, leaving the final fifth of the clip as a hold.

## 3. Experience design

Layout obeys the mini-app shell contract: one column ≤ 36rem, `100svh`, `env(safe-area-inset-*)` padding, ≥ 44px targets, 16px inputs, a complete still frame under `prefers-reduced-motion`. The shell theme tokens (`--canvas`, `--ink`, `--accent`, glass panels) apply unchanged; freeze adds no chrome of its own outside the stages below.

### Stage A — Source

A vertical stack of three cards on the shell's empty state, each a 44px+ row with an icon, a title, and one line of subtitle:

- **Take a photo.** `<input type="file" accept="image/*,image/heic,image/heif" capture="environment">`. iOS hands HEIC; the client uploads raw bytes and the server transcodes (§4). Show a brief "converting…" state after selection because HEIC decode is not instant.
- **Upload a photo.** Same input without `capture`. Accept `image/jpeg`, `image/png`, `image/webp`, HEIC/HEIF. Cap at 12 MB before upload.
- **Generate.** Opens the sketch step: a square canvas (the dual-canvas ink layer ported from `client/draw-studio.tsx`), a prompt field, a Flare mode picker (`Flare Fast`, `Flare Detailed`; `Turbo` and `Sunburst HQ` ride along since they are free in the same lane), and Generate. The delivered image becomes the source and lands the user in Stage B.

Every path ends with the same state: `session.source_asset_id` set, Stage B rendered.

### Stage B — Camera

The screen is three bands, top to bottom:

1. **Viewport (~55vh).** A 2D canvas rendering a projected 3D scene: a dark stage, a faint grid floor, the source photo drawn as a vertical billboard at the origin, the trajectory as a curved ribbon with keyframe dots, and a camera glyph at the playhead pose. Rendered by a small custom projection (perspective divide on yaw/pitch-rotated points), not WebGL, not three.js. This is what makes it fit the bundle budget and the lite surface.
2. **Timeline (~9rem).** The time scrub from the reference: a horizontal track spanning `0:00`–`0:0{duration}`, diamond markers at each keyframe, a draggable playhead, a Play button that animates the camera glyph along the path in real time, and an `+` that adds a keyframe at the playhead. Tapping a diamond selects that keyframe; the caption reads "Keyframe N — move the camera to change it", as in the reference.
3. **Controls.** A horizontally scrolling chip rail of presets (loading a preset replaces the trajectory and duration), a Keyframes count readout, a Duration picker (5s/6s), a Resolution picker (480/768/1080, default 768P), and the Generate button showing the per-render price hint in the subtitle (`~$0.40 at 768P`).

Editing grammar, touch-first:

- **Drag the camera glyph** in the viewport to move the selected keyframe's camera in the orbit plane (azimuth) — vertical drag adjusts elevation. A two-finger drag or a pinch adjusts `distance` within the allowed range.
- **Drag the background** orbits the viewer's look-around angle without touching the trajectory (pure view control, like the reference's "drag the background to look around").
- **Drag a keyframe diamond** along the timeline to retime it (clamp between neighbors, min gap 0.02); the camera pose stays.
- **Add keyframe** samples the current spline at the playhead so the move stays identical until you edit.
- **Delete** removes the selected keyframe (disabled at 2 keyframes, the contract floor).
- **Reduced motion:** Play still scrubs the timeline but renders stepped poses, never smooth animation.

Default state entering Stage B: the `swing` preset loaded (2 keyframes, gentle, fast to read).

### Stage C — Result

Full-bleed looping `<video playsinline muted>` of the delivered MP4, a Send button ("send to iMessage"), a row for "new move" (back to Stage B with the same source) and "new photo" (back to Stage A). If send fails, fall back to a short-TTL `mintDelivery` URL, same as draw.

## 4. Data and actions

### Server module

`apps/web/lib/miniapps/apps/freeze.tsx` — `MiniAppModule` mirroring `draw.tsx`:

- `render(ctx)` returns the shell (`renderShell`/`shellHtml`) with `#freeze-studio` mount node, `data-payload` JSON, `<script src="/creator-os/freeze-studio.js" defer>`, and the draw-style CSP relaxation: `img-src https:`, `media-src https:`, `script-src 'self'`, `connect-src 'self'`.
- `action(ctx, form)` dispatches on `form.get("action")`. All client calls POST to the same `/mini/freeze` path with `format=json`:

| action | input | result |
|---|---|---|
| `status` | `after: seq` | payload: session, source preview URL, activeJob, latest result, events since `seq` |
| `upload` | `image: data URL` (png/jpeg/webp) or `blob:` multipart | transcodes HEIC→PNG server-side, stores asset, sets source |
| `sketch` | `image: png data URL`, `prompt`, `mode` | admits a draw-lane generation; delivered image becomes source |
| `render` | `presetId` or `trajectory: CameraKeyframe[]`, `duration`, `resolution`, `seed?` | admits a freeze job on the multi-angle endpoint |
| `send` | `jobId` | Spectrum `sendAttachment` of the MP4 to `session.phone`; falls back to `mintDelivery` URL |
| `cancel` | — | cancels the in-flight job |
| `reset` | — | clears the source, back to Stage A |

### Tables (one migration)

```sql
create table freeze_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  space_id text not null,
  phone text not null,
  status text not null default 'active',          -- active | expired | done
  source_asset_id uuid references creative_assets(id),
  active_job_id uuid,                             -- in-flight lease
  latest_job_id uuid,
  event_sequence integer not null default -1,
  expires_at timestamptz not null,                -- ~30 min TTL like draw
  created_at timestamptz not null default now()
);

create table freeze_events (
  session_id uuid not null references freeze_sessions(id),
  job_id uuid,
  sequence integer not null,
  kind text not null,                             -- state | completed
  state text, asset_id uuid, error_code text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);
```

`freeze_sessions` needs `source_asset_id` where draw kept `initial_asset_id`, and RLS identical to `draw_sessions` (owner-only). Jobs carry `freeze_session_id` on `creative_jobs` — same column pattern as `draw_session_id` (one nullable column per app; keeps `getCreativeJob` foreign-key checks app-scoped).

### Registry

One migration also inserts the `mini_apps` row (`slug 'freeze'`, `route '/mini/freeze'`, `kind 'input'`, `scopes '{image:read,image:write,video:write}'`, `visibility 'public'`, `access 'single'`, `status 'published'`), adds `'freeze'` to both `card_sends_kind_check` and `miniapp_card_sessions_kind_check`, and registers `freeze` in `FIRST_PARTY_MODULES` in `lib/miniapps/apps/index.ts` with the same product-freeze exception comment draw carries.

## 5. Creative pipeline

### Ingest — HEIC → PNG

`storeFreezeUpload` in `lib/miniapps/freeze.ts`:

1. Read bytes (data URL or multipart), cap 12 MB.
2. `isHeif(contentType, bytes)` sniffs the ftyp box; on HEIF, `heifToPng(bytes)` — a new export in `lib/identity/heif.ts` calling `heic-convert` with `format: "PNG"` (the WASM decoder is already a dependency; `heifToJpeg` sits beside it).
3. Validate the decoded PNG structurally (signature + IHDR + IEND, the `storeDrawUpload` checks).
4. Dedupe by sha256 into `creative_assets` through the existing master-key path.

Everything downstream then sees one image type. The upload still runs through the media guard at ingest.

### Sketch lane — Flare generation

The client flattens the sketch canvas to a PNG data URL and posts `sketch`. Server side mirrors `admitDrawGeneration`/`runDrawJob` on the freeze tables: `createCreativeJob(userId, "web", "freeze", { freezeSessionId })`, then `executeCreativeJob(turn{ mode: "imagine", mediaInputs: [flattened] }, { plan: directSketchPlan(prompt, mode, hasImage) })` reusing `directDrawPlan`/`DRAW_MODE_QUALITY` imports. Delivered output → `freeze_events` → `source_asset_id`. One in-flight job per session via the same claim/release slot pattern.

### Camera lane — the freeze render

`admitFreezeRender` + `runFreezeJob` in `lib/miniapps/freeze.ts`:

1. Resolve the trajectory: `presetId` → `freezeRecipe` table, or validate the posted `camera_trajectory` against the §2 contract. Reject anything failing validation before a job exists (never spend a render on a bad path).
2. Build the plan directly, bypassing the router:

```ts
const plan: RouterPlan = {
  mode: "zap",
  expanded_prompt: FROZEN_SCENE_PROMPT + (preset.returnsToStart ? RETURN_CLAUSE : ""),
  params: {
    duration,                              // 5 | 6
    resolution,                            // "480P" | "768P" | "1080P"
    camera_trajectory: trajectory,         // validated keyframes
    ...(seed !== undefined ? { seed } : {}),
  },
  // needs_input/chat_reply/delivery_line filled per RouterPlan
};
```

3. `createCreativeJob(userId, "web", "freeze", { freezeSessionId })`, claim the slot, then `executeCreativeJob(turn{ mode: "zap", mediaInputs: [{ kind: "image", url: signedAssetUrl(source) }] }, { plan })`.
4. `executeCreativeJob` handles status transitions, fal submit/poll, ingest, `mintJobDelivery`, and `insertRenderCostEvent` — the whole metered lifecycle is already there.

Two small code changes make this work:

- `lib/creative/run.ts`: in the `onFal` branch, honor an injected plan — `plan = options?.plan ?? directZapPlan(turn)`. One line; the plan-injection path already exists for the GMI lanes.
- `lib/creative/fal.ts`: add `FAL_FREEZE_IMAGE_TO_VIDEO = "minimax/h3-max/multi-angle/image-to-video"` and a branch in `buildFalZapRequest` — when `plan.params.camera_trajectory` is present, emit `{ model: FAL_FREEZE_IMAGE_TO_VIDEO, input: { image_url, duration, resolution, prompt, prompt_expansion_mode: "balanced", enable_safety_checker: true, seed?, camera_trajectory } }`. Keep it a pure builder so the trajectory mapping is unit-testable without touching the queue.

The fal CDN host is already inside `generatedMediaHosts` from the zap lane, so `fetchSafeGeneratedMedia`/`assertSafeGeneratedMediaUrl` admit the result unchanged. Ambiguous submits stay submit_unknown under C23 — never auto-resubmit.

## 6. Client bundle

`apps/web/lib/miniapps/client/freeze-studio.tsx` — React + canvas, built by `apps/web/scripts/build-freeze-studio.mjs` (esbuild, copy of `build-draw-studio.mjs`) into `public/creator-os/freeze-studio.js`, wired into `prebuild`. Mounts on `#freeze-studio`, reads `data-payload`, polls `status` every ~2.5s while visible, posts actions over `format=json`. No client storage (C17); all state hydrates from the payload.

Structure inside the bundle:

- `SourceStep` — the three cards + hidden file input + HEIC passthrough.
- `SketchStep` — the ported dual-canvas + mode picker. Reuse draw-studio's stroke model and flatten code wholesale; drop revisions, animate, and save.
- `CameraStage` — viewport canvas + projection math + gestures.
- `Timeline` — scrub track, keyframe diamonds, playhead, play.
- `ResultStage` — video + send row.

Interaction notes: pointer events with `setPointerCapture`, `touch-action: none` on the canvases, single-column bottom controls, and `navigator.vibrate(8)` on keyframe select for tactility (guarded). The trajectory spline interpolates linearly between keyframes in camera space (azimuth/elevation/distance), matching how the model reads the keyframe list — what the user sees in preview is what the endpoint receives.

## 7. Entry points

- **`/freeze` iMessage command** — `lib/miniapps/freezeCommand.ts`, a trimmed `drawCommand.ts`: bare `/freeze` mints a card (`mintSignedLink` + `persistCardSession` + `cardLayout`) and creates the session; `/freeze` with an attached photo runs `ingestUploadedMedia` (the iMessage lane already transcodes HEIC there) and pre-seeds `source_asset_id` so the card opens straight into Stage B. Aliases: `/freeze`, `/orbit`.
- **App surfaces** — registry row makes it available wherever first-party apps are listed (`access: 'single'`, owner-only, same as draw).

Session rules per the card contract: mint at send time, bind to `(user, app, freeze_session, nonce)` with minutes-TTL, single-use on side effects, log mint/open/redeem, never mint for tier-2 senders.

## 8. Security and invariants

- Separate origin (`mini.wzrd.tech`) — no shared cookies/storage with the main app; keep it.
- `FAL_KEY` stays control-plane only; the client never sees a fal URL until `mintJobDelivery` returns a signed Supabase URL.
- Uploads pass through the media guard; HEIC decode happens server-side; generated media passes `fetchSafeGeneratedMedia` host checks.
- Metering: every paid render is a `creative_jobs` row + `insertRenderCostEvent`; one in-flight job per session; daily cap unchanged.
- CSP relaxation scoped to the freeze shell only (img/media https, script self, connect self) — copy the `studioShellHtml` pattern from `draw.tsx` rather than widening the shared shell.
- `enable_safety_checker: true` on every submit; moderation failures map to `refused`.

## 9. Testing

- **Unit (vitest, `apps/web/lib/miniapps/`):** `freezeRecipe.test.ts` — all 16 presets produce 2–12 valid keyframes, ±360 full turns, monotonic time, correct `returnsToStart` prompt clause; `freezeInput.test.ts` — `buildFalZapRequest` emits the multi-angle input exactly once trajectory is present and stays byte-identical otherwise; trajectory validation rejects out-of-range/malformed keyframes.
- **Manual on-device:** prod build on `:3999` with `MINIAPP_ORIGIN=http://mini.air.localhost:3999`, walk the three source paths on an iPhone (HEIC capture is the critical one), edit a custom path, render at 768P, send the MP4, re-open the card mid-poll.
- **Reference payload check:** submit one trajectory from `scripts/test-camera.mjs`-style harness against fal staging before wiring the UI.

## 10. Cost and limits

Per the reference README: roughly $0.05/$0.08/$0.16 per generated second at 480P/768P/1080P → a 5s 768P render is ~$0.40, a 6s 1080P ~$0.96. Show the price estimate on the Generate button. Defaults: 768P, 5s, `swing`. One render at a time per session.

## 11. Build order

1. **Migration + skeleton** — tables, registry row, `FIRST_PARTY_MODULES`, module with the three source cards rendering statically.
2. **Ingest** — `heifToPng`, `storeFreezeUpload`, upload/capture lanes working end-to-end.
3. **Sketch lane** — ported canvas + `sketch` action through the imagine lane.
4. **Camera editor** — trajectory model, preset port, timeline scrub, 2D-projected viewport.
5. **Render lane** — fal branch + `runFreezeJob` + poll + result stage + send.
6. **Command + polish** — `/freeze` card, reduced-motion, error lines, price hints, on-device pass.

File list for the PR: `supabase/migrations/XXXX_freeze_miniapp.sql`, `lib/miniapps/apps/freeze.tsx`, `lib/miniapps/freeze.ts`, `lib/miniapps/freezeRecipe.ts`, `lib/miniapps/freezeCommand.ts`, `lib/miniapps/client/freeze-studio.tsx`, `scripts/build-freeze-studio.mjs`, `lib/identity/heif.ts` (+`heifToPng`), `lib/creative/fal.ts` (+multi-angle branch), `lib/creative/run.ts` (+`options.plan` on the fal lane), `lib/miniapps/apps/index.ts`, `package.json` (`prebuild`), tests under `lib/miniapps/__tests__/`.
