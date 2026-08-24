image.goal.md — build spec for the Image Studio upgrade (Toolcraft parity)

Read `goal.md` and `ARCHITECTURE.md` in full before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins and this file is the bug. This file finishes `goal.md` §MA7 #8: the image mini-app becomes a real layered editor with Toolcraft's interaction model (drag-reorder, nested groups, collapse, rename, per-layer transform, undo/redo) without giving up a single platform invariant — every render stays metered through the existing creative lane, and every layer document stays box-side at `.hermes/miniapps/image/<resource>.json` (C4).

What you are building: (1) an upgraded `ImageDoc` schema that can express what a Toolcraft layer tree expresses; (2) the action grammar and `applyImageAction` cases that mutate it; (3) a Toolcraft-runtime **bundle** served as a first-party mini-app on `mini.wzrd.tech`, persisting through the existing Apps API into the same box-side document; (4) the classic server-HTML renderer kept as the fallback surface for iMessage cards and for boxes/R2 outages. Target: the existing private beta. Correctness and isolation over polish.

0. What already exists — audit before you write code
Do not rebuild any of this. Extend it.

| Subsystem | Where | State |
|---|---|---|
| Image renderer | `apps/web/lib/miniapps/apps/image.tsx` | Live. Server-HTML, Toolcraft-*styled* (canvas stage + collapsible rail): Generate, Edit, Layers, Export, Document panels, prompt bar. Every mutation is an HTML `<form method="post">` round trip; layer rows are rendered from the reversed flat array so the visual "up" inverts to a stored `move` `"down"`. Owner-gated for generate/edit/export. |
| Document model | `apps/web/lib/miniapps/creativeDocs.ts` | Live. `ImageDoc { title, layers[], flatAssetId }`, `ImageLayer { id, kind: "asset"\|"text", assetId?, text?, opacity, blend, visible }`, `BlendMode` = 4 modes, `MAX_LAYERS = 50`, `applyImageAction` (10 variants) as a pure mutation over the parsed doc, `normalizeImageDoc` (permissive), `getImageDoc`/`updateImageDoc`. |
| Box persistence | `creativeDocs.ts` `docPath()` → `.hermes/miniapps/image/<resource>.json`; `lib/miniapps/store.ts` `readAppState`/`writeAppState` for the generic path | Live. Read failures propagate deliberately (a swallowed failure would let a later write replace a real doc with an empty one); only 404 or unparseable JSON means "no doc"; `armStopAfter` is re-armed in `finally`. |
| Metered creative lane | `lib/creative/jobs.ts` `createCreativeJob`, `lib/creative/run.ts` `executeCreativeJob`, `lib/creative/gmi.ts` `MediaInput` | Live. Generate = `imagine` text-to-image job. Edit = `imagine` job with the current flat's signed URL as an image input. Costs/limits/receipts already land in the creative job ledger. |
| Export | `lib/assets/pipeline.ts` `mintDelivery` + `asset_deliveries` reuse; `lib/miniapps/publicExport.ts` `publicExporter.publishAsset` | Live. Private link re-signs an unexpired delivery copy for `miniapp-image:<resource>`; public link goes to the R2 public prefix (MA8). |
| Registry | `apps/web/lib/miniapps/registry.ts` (`RegistryApp`, `parseRegistryApp`, `getRegistryApp`) | Live. `kind` (`render`/`input`/`passthrough`), `bundle_version`, `plugin_signin_enabled`, `status`, `visibility`, `access` all already exist on the row and in the parser — this upgrade sets fields, it does not add columns. |
| Loader dispatch | `apps/web/app/mini/[app]/route.ts` `resolveModule()`; `apps/web/app/mini/[app]/[...path]/route.ts`; `lib/miniapps/apps/published.ts` | Live. `resolveModule` returns `FIRST_PARTY_MODULES[slug] ?? publishedModule(app)`, and `publishedModule` requires **`owner_user_id` non-null** + `bundle_version`. So today a first-party row can never serve a bundle — §MA-I3 is exactly this one change. |
| Bundle pipeline | `lib/miniapps/bundles.ts`, `lib/miniapps/bundleLimits.ts`, `lib/storage/r2.ts` | Live. Zip validated server-side (size caps, extension allowlist, no service workers, no `<meta http-equiv>` CSP), unpacked to `apps/<slug>/<version>/`; served under `publisherCsp()` (`default-src 'none'`, `connect-src 'self'`, `worker-src 'none'`, `frame-ancestors 'self' <APP_ORIGIN>`). |
| Apps API | `apps/web/app/api/apps/v1/state/route.ts`, `.../action/route.ts`, `lib/miniapps/appsApi.ts` | Live. `GET/PUT /api/apps/v1/state` reads/writes `.hermes/miniapps/<slug>/<resource>.json` for the session user; slug + resource come from the verified `mini_api_<slug>` cookie claims, never the request; guests are read-only; **`STATE_MAX_BYTES = 256 KB`**. |
| Toolcraft runtime | `gratitude5dee/toolcraft` `starter/src/toolcraft/runtime/` | Reference implementation, not a dependency yet. Schema→composition→runtime in `schema/define-toolcraft.ts`; command union + state in `state/types.ts`; dispatch in `state/reducer.ts`; patch-based history in `state/history-patches.ts`; layer UI in `react/layers/`. |

1. Hard constraints
All C-constraints in `SECURITY-DECISIONS.md` and every MA-constraint in `goal.md` §1 remain in force verbatim. The ones this upgrade is most able to break:

| # | Constraint as it applies here |
|---|---|
| C4 | The layer document lives in the user's box. Postgres gains nothing but ids that already exist (`creative_assets`, `creative_jobs`, `asset_deliveries`). No layer, transform, prompt, or history entry is ever written to a table. |
| C15/C16 | The bundle is reached only through a minted, scoped, single-use link; it never learns a box URL, a box `_token`, or an `API_SERVER_KEY`. All box I/O is control-plane-mediated through the Apps API. |
| C17/MA1 | The editor is served from `mini.wzrd.tech`. It shares no cookie, storage, or session with `air.wzrd.tech`. The Toolcraft starter persists to `localStorage`; **that persistence layer is deleted, not configured** — the mini origin is shared by every app (`goal.md` §4.2), so client storage is a cross-app leak. State lives in the box; the runtime holds it in memory. |
| MA2 | The `image` slug in the path is a routing hint. The Apps API resolves slug + resource from the cookie claims; a request that names another resource is not "corrected", it is ignored. |
| MA3 | The bundle is static files only — no publisher/first-party server code inside the bundle, no service worker, no `unsafe-eval`. Everything dynamic is the Apps API or the owner's agent. |
| MA5 | Owner/guest and every gate stay server-side. `role !== "owner"` cannot generate, edit, export, or `PUT` state, and disabling a control in the client is not a gate. |
| MA10 | The agent never learns the editor exists. It writes the same document with its normal tools; the view re-reads it. New capability = new document field + action, never a mini-app-specific agent API. |
| Metering | Every pixel-producing operation is a `createCreativeJob` + `executeCreativeJob` pair. There is no unmetered render path, client-side or otherwise — a canvas composite for *preview* is not a render; flattening/generating/editing is. |

2. Non-goals
- Rendering in the browser as the source of truth. The client composites a preview; the flat that gets exported comes from the metered lane.
- Vendoring all of Toolcraft. We take the layer/history/schema model and the `react/layers/` interaction design; the airv2 bundle is a Toolcraft *app*, not a fork of the framework.
- Timeline/keyframes, 3D model assets, and the model-repair lane from Toolcraft (`state/timeline-*`, `model-import/`). Video keeps its own document (`VideoDoc`); do not merge the two.
- Real-time multiplayer editing. `access` stays `single` for `image` in v1; a guest read-only view is a later milestone, not this one.
- Dropping the server-HTML renderer. iMessage card sessions (`session.via === "card"`) and R2-unconfigured environments keep working (§MA-I3).

3. The Toolcraft target — what we are copying, precisely
Facts from `gratitude5dee/toolcraft` (`starter/src/toolcraft/runtime/`), not paraphrase:

- **Schema → composition → runtime.** `schema/define-toolcraft.ts` takes a `ToolcraftAppSchema` and resolves it (`resolveToolcraftAppIdentity`, `normalizeToolcraftPanels`, `resolveToolcraftExport`, `resolveToolcraftMedia`, `resolveToolcraftPersistencePlan`, `createToolcraftAssemblyContract`) into a `ResolvedToolcraftAppSchema` that is carried *inside* `ToolcraftState.schema`. The app is data; the runtime is generic. Our editor is one `defineToolcraft({...})` call: canvas on, layers panel on, controls panel for opacity/blend/transform, export on, timeline off.
- **One command union, one reducer.** `state/types.ts` declares `ToolcraftCommand`; `state/reducer.ts` `toolcraftReducer` dispatches by `command.type` to per-domain reducers (`controls`, `layers`, `canvas`, `panels`, `media`, `timeline`) plus `history.undo` / `history.redo`. The layer commands are exactly: `layers.add`, `layers.delete`, `layers.moveToGroup`, `layers.select`, `layers.rename`, `layers.toggleCollapsed`, `layers.toggleVisibility`, `layers.reorder`.
- **The layer model is a flat array with parent pointers.** `ToolcraftLayer { id, name, visible, kind?: "group" | "layer", parentGroupId?, collapsed?, displayName? }`; ordering is array order; `ToolcraftState.selectedLayerId` holds selection. Note what is **not** there: `opacity` and `blend` are not layer fields in the starter — per-layer numeric/enum settings are control values (`state.values` keyed by control target, mutated by `controls.setValue`). airv2 already carries `opacity`/`blend` on `ImageLayer`, so our Toolcraft app binds those two controls to the selected layer's document fields; do not expect the starter's types to have them.
- **History is patch-based with an authoring mode.** `state/history-patches.ts` keeps `state.history.undo/redo` as `ToolcraftHistoryPatch[]`; commands carry `history?: ToolcraftHistoryMode` (`"merge" | "record" | "skip"`), `historyGroup`, and `label`, which is how a slider drag becomes one undo step (`merge`) and a selection change becomes none (`skip`).
- **The layers panel is the interaction spec.** `react/layers/`: `layers-panel.tsx` (panel host + add-layer/add-group buttons), `layers-panel-row.tsx` (visibility toggle, rename, indentation by depth, dimmed rows for hidden layers), `layer-tree.ts` (`getToolcraftVisibleLayerRows`, `getToolcraftLayerDepth`, `isToolcraftLayerVisibleInTree`), `layers-panel-reorder.ts` (`canMoveLayerIntoGroup`, `getLayerSubtreeEndIndex` — a group moves with its subtree, and a group cannot be dropped inside itself), `layers-panel-insert-targets.ts` + `use-layers-panel-drag-controller.ts` (drag/drop insert targets and keyboard fallbacks).
- **Persistence is pluggable and currently localStorage.** `state/persistence-snapshot.ts` only snapshots when `persistence.storage === "localStorage"`. Our app supplies `storage: "none"` and drives persistence from the airv2 Apps API adapter instead (§MA-I4).

4. The decision: server-HTML view or client app? — both, with one source of truth
The tension is real: `image.tsx` is server-HTML because that is what the loader was built for (SSR HTML, no client storage, form posts, works inside an iMessage webview). Toolcraft parity — drag-reorder, nested collapse, live transform — is not achievable in form round trips.

**Decision.** Ship the Toolcraft runtime as a **published-style static bundle served as a first-party app** on the separate `mini.wzrd.tech` origin, and keep the box-side document as the shared contract:

1. `mini_apps.image` gets `kind = 'input'` and a `bundle_version` (e.g. `2025.09.0`). The bundle is uploaded through the existing `lib/miniapps/bundles.ts` pipeline to `apps/image/<version>/` on the platform bucket (first-party bundles live under the platform prefix; `_platform/` is already reserved for first-party assets in `goal.md` §4.1).
2. `resolveModule()` (loader) and `publishedModule()` are generalized into `bundleModule(app)`: **`bundle_version` present** selects the bundle module regardless of `owner_user_id`, so a first-party row can serve one. First-party rows keep their renderer module as the declared fallback (§MA-I3), not as an accident of dispatch order.
3. The bundle talks to exactly one API: `GET/PUT /api/apps/v1/state` and `POST /api/apps/v1/action` on its own origin, authenticated by the `mini_api_image` cookie the loader mints. It never sees a box URL, a token, or a Supabase key (C3/C16).
4. The **document is the contract.** The agent's tools write `.hermes/miniapps/image/<resource>.json`; the bundle reads and writes the same file through the Apps API; `image.tsx` renders the same file server-side. Nobody owns a private schema (MA10).
5. Fallbacks are explicit, never silent-degrade-to-broken: `session.via === "card"` (iMessage), `?view=classic`, `r2Configured() === false`, or a missing bundle object all render `image.tsx`. The classic renderer keeps its full existing action grammar, so a card user can still generate, retitle, toggle, reorder, and export.

Why not the alternatives: a client app on `air.wzrd.tech` breaks MA1/C17; a first-party React route inside the loader's route group means shipping platform JS with the same privileges as the main app and loses the CSP story of MA3; keeping pure server-HTML means never reaching parity. The bundle is the only option that is strictly *more* sandboxed than what we have.

4.1 Serialization: `ToolcraftState` ⇄ `ImageDoc`
One module owns this and nothing else: `apps/web/lib/miniapps/toolcraft/imageDocBridge.ts` (pure, unit-tested both directions, no I/O).

| Toolcraft | `ImageDoc` v2 | Notes |
|---|---|---|
| `state.layers[]` order | `doc.layers[]` order | Both are bottom-of-stack-first arrays. The classic renderer's reversal stays a *render* concern; it never touches storage. |
| `layer.id` | `layer.id` | Ids are minted box-side-safe (`newId()`); the bundle may propose an id, the reducer keeps it if unused. |
| `layer.kind` (`"group"` \| `"layer"`) | `layer.kind` (`"group"` \| `"asset"` \| `"text"`) | airv2 splits leaf kinds because the leaf payload differs (`assetId` vs `text`). Bridge maps both leaves to Toolcraft `"layer"` and carries the payload in the app's media assets/values. |
| `layer.parentGroupId` | `layer.parentGroupId` (`string \| null`) | `undefined` ⇄ `null`. A cycle or unknown parent normalizes to `null` (root). |
| `layer.collapsed` | `layer.collapsed` | Groups only. A collapsed group still renders its subtree in the flat/preview: collapse is UI, `visible` is content. |
| `layer.name` / `displayName` | `layer.name` | `name` is user-authored; the panel falls back to a derived label (`T · <text>`, `▣ <assetId>`) when empty, as `image.tsx` does today. |
| `layer.visible` | `layer.visible` | A hidden group hides its subtree in composition (`isToolcraftLayerVisibleInTree`); child `visible` values are preserved, not rewritten. |
| control values (`state.values["layer.opacity"]`, `"layer.blend"`) | `layer.opacity` (0–100 int), `layer.blend` | Bound to `doc.selectedLayerId`; `controls.setValue` with `history: "merge"` during a drag, committed on release. |
| `mediaAssets[].position/size/transform` | `layer.transform` | `{ x, y, scale, rotation }` — canvas-relative, scale in percent, rotation in degrees. Toolcraft's richer media transform is reduced to this; anything it cannot express is not stored. |
| `state.selectedLayerId` | `doc.selectedLayerId` | Persisted so a reload lands on the same layer. Selection changes use `history: "skip"`. |
| `state.history` | `doc.history` | Only the airv2 shape is persisted (§5.3) — Toolcraft patches are runtime-local. |
| `state.canvas`, `state.panels`, `state.timeline` | not persisted | Viewport and panel chrome are per-session UI. Persisting them would burn the 256 KB budget for nothing and leak layout state across surfaces. |

5. The upgraded document model
5.1 Types (`creativeDocs.ts`)

```ts
export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "darken" | "lighten" | "color-dodge" | "color-burn"
  | "hard-light" | "soft-light" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";   // = CSS mix-blend-mode

export interface LayerTransform {
  x: number;        // canvas-relative offset, px
  y: number;
  scale: number;    // percent, 1–1000
  rotation: number; // degrees, -360–360
}

export interface ImageLayer {
  id: string;
  kind: "asset" | "text" | "group";
  name?: string;                     // user-authored label
  parentGroupId: string | null;      // null = root
  collapsed?: boolean;               // groups only, UI state
  assetId?: string;                  // kind 'asset'
  text?: string;                     // kind 'text'
  opacity: number;                   // 0–100
  blend: BlendMode;
  visible: boolean;
  transform: LayerTransform;
}

export interface ImageDoc {
  schemaVersion: 2;
  title: string;
  layers: ImageLayer[];              // bottom-of-stack first, parent-pointer tree
  selectedLayerId: string | null;
  flatAssetId: string | null;        // creative_assets id of the last render
  history: { undo: ImageHistoryEntry[]; redo: ImageHistoryEntry[] };
}
```

Invariants the normalizer enforces (fail-safe, never throw on a hostile file — C9 applies to a document the agent wrote from a hostile prompt too):
- unknown `blend` → `"normal"`; non-finite `opacity` → `100`; missing `transform` → identity `{x:0,y:0,scale:100,rotation:0}`;
- `parentGroupId` pointing at a non-existent layer, at a non-group, at itself, or forming a cycle → `null`;
- a leaf that carries neither `assetId` nor `text` is dropped; a `group` never carries either;
- `layers.length + groups` capped by `MAX_LAYERS`; depth capped by `MAX_GROUP_DEPTH = 6`;
- the whole serialized doc must stay under the Apps API's 256 KB (`STATE_MAX_BYTES`) — the history cap (§5.3) exists for this reason.

5.2 Migration from v1
`normalizeImageDoc` upgrades in place, silently, on read: no `schemaVersion` (or `1`) → every layer gets `parentGroupId: null`, identity `transform`, `name` absent, and its existing `opacity`/`blend`/`visible`; `selectedLayerId: null`; `history: { undo: [], redo: [] }`; `schemaVersion: 2`. v1 docs written by the agent's older tools keep working; a v2 doc read by an un-upgraded surface degrades to "extra fields ignored, groups look like layers", which is why the classic renderer stays list-shaped. There is no down-migration and no migration job — reads upgrade, writes persist v2.

5.3 Undo/redo semantics
Toolcraft's runtime history is patch-based and in-memory; the *document* needs a durable, small, agent-legible history. Shape:

```ts
export interface ImageHistoryEntry {
  label: string;                  // "Reorder layer", "Opacity"
  at: string;                     // ISO timestamp
  layers: ImageLayer[];           // snapshot of the tree BEFORE the action
  selectedLayerId: string | null;
}
```

- Every structural action (`add-*`, `remove`, `reorder`, `move-to-group`, `set-transform`, `set-opacity`, `set-blend`, `toggle-visible`, `rename-layer`) pushes one entry and clears `redo`. Pure-UI actions (`select`, `toggle-collapsed`) push nothing — Toolcraft's `history: "skip"`.
- Coalescing (`merge`): consecutive same-`label` + same-target actions inside `HISTORY_MERGE_MS = 1500` replace the previous entry instead of pushing a new one, so a slider drag is one step.
- `undo` pops `undo` → pushes the current tree onto `redo` → restores the snapshot. `redo` mirrors it. `MAX_HISTORY = 20` entries per stack, dropped oldest-first.
- `flatAssetId` is **not** part of history. A render is metered and cannot be undone by rewriting a document; undoing the layer edit that preceded it does not un-charge or un-produce the flat.
- The agent's writes go through the same actions, so an agent edit is undoable in the editor and shows up with its label — that is the whole point of one shared document.

5.4 New actions (`ImageAction`) and `applyImageAction` cases
Existing variants keep their names and behavior (`rename`, `add-text`, `add-asset`, `set-text`, `set-opacity`, `set-blend`, `toggle-visible`, `move`, `remove`, `set-flat`). Added:

| Action | Semantics |
|---|---|
| `add-group { name?, parentGroupId? }` | Insert an empty group at the end of the target parent's run. |
| `rename-layer { id, name }` | 120-char clamp, empty clears back to the derived label. |
| `set-parent { id, parentGroupId }` | Toolcraft `layers.moveToGroup`. Rejects a cycle, a non-group parent, and a depth over `MAX_GROUP_DEPTH`; moves the whole subtree (`getLayerSubtreeEndIndex` equivalent). |
| `reorder { id, index }` | Absolute placement within the sibling run (what drag-and-drop produces); the subtree moves with the layer. `move { direction }` stays as the classic renderer's coarse form and is now implemented in terms of sibling order, not raw array index. |
| `toggle-collapsed { id }` | Groups only; no history entry. |
| `select { id \| null }` | Sets `selectedLayerId`; no history entry. |
| `set-transform { id, transform: Partial<LayerTransform> }` | Clamped per field; partial patch so a drag can send only `x`/`y`. |
| `remove { id }` | Now removes the subtree, not one row. |
| `undo` / `redo` | §5.3. |

All of them stay pure functions over the parsed document in `creativeDocs.ts` so the grammar is testable without a box, and all of them are reachable from both surfaces: the bundle sends them to `POST /api/apps/v1/action`, the classic renderer posts them as form actions.

6. What stays exactly as it is
- **Generate / Edit.** `createCreativeJob(supabase, userId, "web", "imagine")` then `executeCreativeJob(...)`; edit attaches the current flat's signed URL as a `MediaInput`. The bundle never calls a model provider — it posts a `generate`/`edit` action and polls state. Costs, limits, and receipts continue to land in the creative job ledger, unchanged.
- **Flattening.** Composition for export is a metered `imagine`/render job in the box, not a browser canvas dump. The bundle's canvas is a preview.
- **Export.** Private = `exportDelivery` (reuse the unexpired `miniapp-image:<resource>` delivery, sign only for its remaining life). Public = `publicExporter.publishAsset` (MA8 rules). Owner-only; guests get neither.
- **Failure posture.** `StartLimitError` → the honest "your agent's computer can't start right now" page, never a silent empty document.

7. Milestones

**§MA-I1 — Document model v2 (no UI change).** Upgrade `creativeDocs.ts`: full `BlendMode` set, `LayerTransform`, groups/`parentGroupId`/`collapsed`/`name`, `selectedLayerId`, `schemaVersion`, history stacks, the new actions and their `applyImageAction` cases, a strict-but-forgiving `normalizeImageDoc` with the v1 upgrade. `image.tsx` keeps working unchanged except for the widened blend list. Tests: v1→v2 upgrade, cycle/depth rejection, subtree move/remove, sibling reorder, history coalescing + cap, hostile-document normalization.

**§MA-I2 — Classic renderer parity within form limits.** Add group create, rename, collapse, set-parent (a `<select>` of eligible groups), and undo/redo buttons to `image.tsx`; render rows indented by depth with collapsed subtrees hidden. This is the iMessage/fallback surface and the proof the action grammar is complete before any bundle exists.

**§MA-I3 — First-party bundles in the loader.** Generalize `publishedModule` into `bundleModule(app)` keyed on `bundle_version`; `resolveModule` prefers the bundle for a first-party row that has one, with `FIRST_PARTY_MODULES[slug]` as the declared fallback for card sessions, `?view=classic`, `r2Configured() === false`, and a missing bundle object. Mint `mini_api_image` for first-party bundle renders (already how `published.ts` does it). Negative tests: no `bundle_version` → renderer; bundle present + card session → renderer; bundle present + owner web session → bundle under `publisherCsp()`; a bundle asset request for another slug → 404.

**§MA-I4 — Toolcraft app + persistence adapter.** Vendor the Toolcraft runtime pieces we use into `apps/web/toolcraft-image/` (its own build, output = the static bundle; **not** part of the Next app's client graph), define the app with `defineToolcraft` (canvas + layers + controls + export panels; timeline off; `persistence: none`), and write the adapter: load `GET /api/apps/v1/state` → `toolcraftInitialState` via `imageDocBridge`; dispatch → action POST; optimistic local reducer with server-confirmed reconcile; conflict = last-write-wins on the document with a re-read (the agent may have written between our read and write, and the agent wins the tie).

**§MA-I5 — Layer UI parity.** Wire `react/layers/` behavior: drag-reorder with insert targets, nested groups with `canMoveLayerIntoGroup` guards, collapse, visibility, inline rename, depth indentation, keyboard fallbacks, undo/redo (⌘Z/⇧⌘Z) mapped to the document actions.

**§MA-I6 — Canvas + controls.** Preview composition honoring order, group nesting, `visible`, `opacity`, `blend` (CSS `mix-blend-mode` names are the reason for the enum choice), and `transform`; the controls panel binds opacity/blend/transform to the selected layer with drag-merge history; Generate/Edit/Export panels post the existing metered actions and reflect job state.

**§MA-I7 — Registry + rollout.** Migration setting `image.kind = 'input'` + `bundle_version`, `bundle_version = null` as the instant rollback, and the C18 sweep + red-team additions (bundle CSP escape attempts, a bundle asking for another resource, a guest attempting `PUT /state`, an unmetered render path).

8. Acceptance
- [ ] A v1 `image` document written by the old code opens in both surfaces with no data loss, and is rewritten as v2 only when the user actually edits it.
- [ ] A 3-level group tree with 20 layers survives box stop/resume and a bundle reload with identical order, nesting, collapse, opacity, blend, and transform.
- [ ] Drag-reordering a group moves its whole subtree; dropping a group into itself or exceeding `MAX_GROUP_DEPTH` is refused server-side, not just in the UI.
- [ ] Undo after a slider drag reverts the whole drag in one step; 25 edits then 25 undos ends at the original tree (cap honored, no partial state); undo never changes `flatAssetId`.
- [ ] Every Generate/Edit/flatten in the bundle produces a `creative_jobs` row with a cost; blocking the creative lane blocks the editor's renders with an honest message and zero pixels.
- [ ] The saved document never exceeds 256 KB for a legal tree; exceeding it is a refused action with a clear message, never a truncated write.
- [ ] Devtools on the bundle: zero cookies/requests to `air.wzrd.tech`, zero `localStorage`/`sessionStorage`/IndexedDB writes, zero tokens in URLs after load, `connect-src 'self'` violations = 0.
- [ ] `role='guest'`: no generate, no edit, no export, no `PUT /api/apps/v1/state`, no action outside `guestActions` — each returning 403 from the server.
- [ ] iMessage card session renders the classic HTML editor and can still create a group, reorder, and export.
- [ ] `bundle_version = null` in the registry falls back to the classic renderer within one request, no deploy.
- [ ] `npm run typecheck && npm run lint && npm run test` clean, with the new negative tests in the same PR (`goal.md` §7).

9. Devin child-session plan
The image upgrade is one dependency chain; Berd (`berd.goal.md`) and Buzz (`buzz.goal.md`) are disjoint from it and from each other.

| Session | Scope | Blocked by | Owns (disjoint paths) |
|---|---|---|---|
| F1 | §MA-I1 + §MA-I2 | — | `lib/miniapps/creativeDocs.ts`, `lib/miniapps/apps/image.tsx`, their tests |
| F2 | §MA-I3 | — (merges after F1 only to avoid a trivial conflict) | `app/mini/[app]/route.ts`, `lib/miniapps/apps/published.ts`, loader tests |
| F3 | §MA-I4 + §MA-I5 + §MA-I6 | F1 (model), F2 (dispatch) | `apps/web/toolcraft-image/**`, `lib/miniapps/toolcraft/imageDocBridge.ts` |
| F4 | §MA-I7 + red-team | F2, F3 | `supabase/migrations/00xx_image_bundle.sql`, `lib/security/**` |
| J | Berd mini-app (`berd.goal.md`) | — | `lib/miniapps/apps/berd.tsx`, `lib/miniapps/berd/**`, its migration |
| K | Buzz mini-app (`buzz.goal.md`) | — | `lib/miniapps/apps/buzz.tsx`, `lib/miniapps/buzz/**`, its migration |

Rules: one session owns `app/mini/[app]/route.ts` at a time (it is the merge-conflict magnet — F2 only). J and K run fully concurrently with F1–F4: they touch no image file, no creative lane, and no loader dispatch; their only shared files are `lib/miniapps/apps/index.ts` (one line each) and a new migration file each (take the next free number and rebase, never renumber someone else's). If J or K needs a registry/loader change, it stops and escalates rather than editing F2's file.

10. Escalate to a human, do not decide
- Any C- or MA-constraint appears to block a task. The constraint is right.
- Any pressure to composite/flatten client-side to "save a render" (breaks metering) or to persist the document in `localStorage`/Postgres "for speed" (breaks MA1/C4).
- Toolcraft licensing or vendoring shape (copy-in vs package dependency) if the vendored surface grows past the layers/state/schema modules named in §3.
- A bundle needing any origin other than its own (`connect-src 'self'`) — including a CDN for fonts or an asset host.
- Raising `STATE_MAX_BYTES`, `MAX_LAYERS`, or `MAX_HISTORY` because a real document did not fit: that is a product/budget decision, not a constant to bump.
