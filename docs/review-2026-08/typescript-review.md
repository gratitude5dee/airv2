# air 2.0 — TypeScript Best-Practices Review (`apps/web`)

**Date:** 2026-08-25 · **Scope:** `apps/web` (587 `.ts`/`.tsx` files under `app/`, `lib/`, `components/`, `middleware.ts`) · **Rubric:** strict-TypeScript practice as popularized by Matt Pocock — strict compiler flags, no `any`/unsafe casts/non-null assertions, `unknown` at boundaries with runtime validation, discriminated unions over boolean-flag bags, `as const`/`satisfies` over assertions, union types instead of enums.

**Baseline verified in this checkout** (commit `088d6fe`): `npx tsc --noEmit` ✅ clean in 14s. Counts below come from `rg` over non-test sources unless noted.

**Method:** every finding was read in context and, where it claims a compiler outcome, reproduced by running `tsc` with the flag in question. Error counts per flag are measured, not estimated.

---

## Executive summary

The type hygiene here is already better than most Next.js codebases of this size: **zero `any` in type position, zero `@ts-ignore`/`@ts-expect-error`, zero `enum` declarations, no non-null assertions outside test files, and a clean `tsc --noEmit` with `strict` + `noUncheckedIndexedAccess` already on.** The base is solid; there is no cleanup backlog of the usual kind.

The weakness is concentrated in exactly one place, and it is systemic: **`as` is doing the work that runtime validation should do at every IO boundary.** 263 type assertions in non-test code, of which the load-bearing groups are 88 request-body casts in API routes, 91 `(await res.json()) as T` casts in browser code, 69 Supabase row casts, and two generic fetch helpers (`hermesFetch<T>`, `boxFetch<T>`) that let any caller name the response type of an HTTP call. None of these assertions is checked at runtime, so the type system is describing what the code hopes it received. In several routes the hope is load-bearing: a JSON body of `{"name": 1}` reaches `body.name.trim()` and throws a `TypeError` → 500 instead of a 400 (H-1).

There is no validation library in `package.json`. `zod@3.25.76` is already resolved in `node_modules` transitively (via `x402`/`thirdweb`), so adopting it costs one explicit dependency line, not a new supply-chain decision.

Counts: **2 high, 5 medium, 8 low/info.**

---

## H — High

### H-1 · API route bodies are cast, not validated — several routes 500 on a wrong-typed field

**Where:** 88 `request.json()` sites across 74 route files under `app/api/**`. The dominant shape is:

```ts
const body = (await request.json().catch(() => ({}))) as {
  name?: string;
  cron?: string;
};
```

175 of these declared fields are concrete (`string`/`number`/`boolean`); only 55 are `unknown`. The cast is a claim about attacker-controlled input that nothing verifies. Where the subsequent code narrows with `typeof` (`app/api/me/memory/route.ts:66-75`, `app/api/berd/result/route.ts:33-43`, `app/api/browser/route.ts:136-144`) the outcome is fine and the cast is merely redundant. Where it does not, the lie is load-bearing:

| Site | Input | Result |
|---|---|---|
| `app/api/bots/route.ts:177-191` | `{"title": 1}` (any non-string, non-`undefined`) | `body.title?.slice(0, 80)` → `TypeError: body.title.slice is not a function` → 500 |
| `app/api/bots/route.ts:134-141` | same, on POST create | same |
| `app/api/bots/[name]/routines/route.ts:200-210` | `{"id":"…","name":1}` — guarded only by `!== undefined` | `body.name.trim()` → 500 |
| `app/api/calendar/schedule/route.ts:59-62`, `:152-154` | `{"cron": {}}` | `body.cron?.trim()` → 500 |
| `app/api/connectors/route.ts:62`, `:96` | `{"toolkit": 5}` | `body.toolkit?.toLowerCase()` → 500 |
| `app/api/computer/keepawake/route.ts:59-60`, `:75` | `{"timezone": []}` | `body.timezone?.trim()` → 500 |
| `app/api/media/upload-url/route.ts:42-47` | `{"sizeBytes":"9"}` | no crash — `Number(...)` + `Number.isFinite` rescue it, but the declared `sizeBytes?: number` is still false |
| `app/api/bots/route.ts:141` | `{"skills":[1,2]}` | non-strings flow into `provisionBot`; `lib/bots/provision.ts:177` defends itself with a regex, so no injection — the type is simply wrong |

Also note `.catch(() => ({}))` silently converts malformed JSON into an empty body, so clients get a field-level 400 (or a 500) instead of "invalid json". The five fleet routes already do this correctly — see the H-1 fix.

**Severity rationale:** unauthenticated-to-authenticated callers can convert any of these into a 500 with a one-character body change. No data-integrity or authz consequence was found (the DB writes that follow are string-shaped or separately validated), which is what keeps this off a P0 list.

**Fix, option A (preferred) — zod at the boundary, one shared helper.** Add `zod` as an explicit dependency and a single parser used by every route:

```ts
// lib/http/body.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<Parsed<z.output<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid json" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid request" },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
```

```diff
--- a/apps/web/app/api/calendar/schedule/route.ts
+++ b/apps/web/app/api/calendar/schedule/route.ts
-  const body = (await request.json().catch(() => ({}))) as {
-    name?: string;
-    cron?: string;
-    timezone?: string;
-    prompt?: string;
-    deliver?: string;
-  };
-  const name = body.name?.trim();
-  const cron = body.cron?.trim();
-  const timezone = body.timezone?.trim();
-  const prompt = body.prompt?.trim();
-  const deliver = (body.deliver ?? "imessage") as Deliver;
-  if (!name || !cron || !timezone || !prompt) {
-    return NextResponse.json(
-      { error: "name, cron, timezone, prompt required" },
-      { status: 400 }
-    );
-  }
-  if (!DELIVER_VALUES.includes(deliver)) {
-    return NextResponse.json({ error: "invalid deliver" }, { status: 400 });
-  }
+  const CreateSchedule = z.object({
+    name: z.string().trim().min(1).max(80),
+    cron: z.string().trim().min(1),
+    timezone: z.string().trim().min(1),
+    prompt: z.string().trim().min(1),
+    deliver: z.enum(DELIVER_VALUES).default("imessage"),
+  });
+  const parsed = await parseBody(request, CreateSchedule);
+  if (!parsed.ok) return parsed.response;
+  const { name, cron, timezone, prompt, deliver } = parsed.data;
```

`z.enum(DELIVER_VALUES)` requires `DELIVER_VALUES` to be `as const` — it already is in most of these files, which removes the `as Deliver` cast on the same line as a bonus.

**Fix, option B (no dependency) — adopt the pattern the fleet routes already use.** `app/api/admin/fleet/sync/route.ts:48-92` and its four siblings are the counter-example to every row in the table above: the body is declared with `unknown` fields and narrowed field by field, so nothing is ever asserted.

```ts
let body: { channel?: unknown; canary_box_ids?: unknown; wave_size?: unknown };
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "invalid json" }, { status: 400 });
}
if (!isChannelName(body.channel)) { /* 400 */ }
```

This is strictly correct and needs no library; it costs ~8 lines per field group, which is why option A scales better across 88 sites. Either way the rule to enforce going forward is the same: **`request.json()` produces `unknown`, and the only way out of `unknown` is a check.**

**Rollout:** the highest-value dozen routes are the eight crash paths in the table plus `app/api/vault/route.ts:100` and `app/api/browser/route.ts:136` (both already `Record<string, unknown>`, so they only need the schema, not a rewrite).

---

### H-2 · `hermesFetch<T>` / `boxFetch<T>` let the caller invent the response type

**Where:** `lib/hermes/client.ts:65-79`, `lib/box/client.ts:94-117`, and the 91 downstream call sites that name a type parameter.

```ts
async function hermesFetch<T>(target, path, init?): Promise<T> {
  ...
  return (await response.json()) as T;   // lib/hermes/client.ts:79
}
```

This is the classic "generic as an assertion" anti-pattern: `T` is unconstrained by anything the function actually knows, so `hermesFetch<RunResponse>(...)` reads as validation while performing none. Everything the control plane believes about the box and the Hermes agent — run ids, session ids, cost fields — is unverified. `lib/box/client.ts:114` compounds it with `return undefined as T` on the `expectJson: false` path, which is a straight lie for any `T` a caller might pass.

Same pattern, lower blast radius: `lib/miniapps/store.ts:63` (`JSON.parse(raw) as T` on box-file contents), `lib/skills/hub.ts:88`, `:277`, `lib/vault/client.ts:83`, `:154`, `:243` (CLI stdout — already flagged as a P2 in `01-engineering-review.md`), `lib/creative/videoRender.ts:150`.

**Fix:** make the schema the parameter instead of the type.

```diff
-async function hermesFetch<T>(
+async function hermesFetch<S extends z.ZodTypeAny>(
   target: HermesBoxTarget,
   path: string,
+  schema: S,
   init?: RequestInit
-): Promise<T> {
+): Promise<z.output<S>> {
   ...
-  return (await response.json()) as T;
+  const parsed = schema.safeParse(await response.json());
+  if (!parsed.success) {
+    throw new HermesApiError(502, `unexpected response shape at ${path}`);
+  }
+  return parsed.data;
 }
```

A wrong-shaped upstream response then surfaces as a 502 at the boundary that owns the contract, instead of `undefined` propagating into a run record. If schemas for every endpoint are too much churn for one pass, apply it to the three responses whose fields are persisted or billed (`createRun`, run status, and the cost/usage payload) and leave the rest typed as `unknown` with local narrowing — `unknown` is honest, `as T` is not.

**Related, but not the same finding:** the token/claims casts at `lib/auth/session.ts:68`, `:93`, `lib/miniapps/tokens.ts:69`, `lib/vault/tickets.ts:98`, `lib/imessage/ingest.ts:70` all cast `JSON.parse` output — but each verifies an HMAC over the payload *first* and then checks the individual claims it uses, so these are self-issued, integrity-checked values and the cast is cosmetic. `lib/auth/desktop.ts:61` (`decode<T>`) is the one exception in that group: it is HMAC-verified but performs no field checks at all, leaving `expired(claims.exp)` and friends to trust the type parameter. Give it the same schema treatment (Medium, not High, because the signing key is ours).

---

## M — Medium

### M-1 · The Supabase client is untyped, so 69 row casts stand in for a schema

**Where:** `lib/supabase.ts:10` returns a bare `SupabaseClient`, with no generated `Database` generic. Consequently every query result is `any`-adjacent and gets asserted at the call site:

```
lib/fleet/channels.ts:34,42 · lib/fleet/releases.ts:78,91,104 · lib/bots/store.ts:44,62
lib/miniapps/analytics.ts:98,150,204,237,274,275,359,360 · lib/miniapps/guests.ts:115
lib/miniapps/commandLane.ts:169,218,278 · lib/plugin/auth.ts:134,186,218
lib/browser/rules.ts:103 · lib/box/events.ts:73 · lib/connectors/manage.ts:99,117
lib/identity/assets.ts:163,174 · lib/identity/twin.ts:78 · lib/decisions/batch.ts:46
lib/storage/confirm.ts:96 · lib/providers/keys.ts:120 · app/api/bots/route.ts:230 (…69 total)
```

Each cast is a hand-maintained duplicate of a migration in `supabase/migrations/`, and nothing fails when the two drift: rename a column and `data as BotRow` still compiles, delivering `undefined` at runtime. `lib/miniapps/commandLane.ts:218,278` even needs `as unknown as` to force the shape, which is the compiler explicitly objecting.

**Fix:** generate the schema types and thread them through the one factory.

```bash
npx supabase gen types typescript --project-id <ref> --schema public > apps/web/lib/database.types.ts
```

```diff
--- a/apps/web/lib/supabase.ts
+++ b/apps/web/lib/supabase.ts
-import { createClient, type SupabaseClient } from "@supabase/supabase-js";
+import { createClient, type SupabaseClient } from "@supabase/supabase-js";
+import type { Database } from "./database.types";
+
+export type Db = SupabaseClient<Database>;

-export function serviceClient(): SupabaseClient {
+export function serviceClient(): Db {
```

`.from("bots").select(...)` then returns the real row type and the 69 casts delete themselves (`Tables<"bots">` replaces the hand-written `BotRow` interfaces). Add the generation command to CI so a migration that lands without regenerating fails the build. Note the fake clients in tests currently rely on `as unknown as SupabaseClient` (`lib/miniapps/testing/fakeSupabase.ts:58` and ~15 test files) — those keep working, and are the right place for a helper like `@total-typescript/shoehorn`'s `fromPartial` if the churn becomes annoying.

### M-2 · No shared contract between route handlers and their callers — 91 client-side casts

**Where:** `NextResponse.json<T>()` is never used (0 occurrences); route responses are structurally typed by whatever object literal is returned. Clients then re-declare the shape and assert it:

```ts
// app/home/panels/context-panel.tsx:80
const data = (await res.json()) as MemoryState;
// :214 as DeepMemoryState · :292 as { receipts: TraceReceipt[] } · :367 as OnairosState
```

91 such casts, concentrated in `app/home/page.tsx:317,333,353,431,581,772`, `app/home/bots-panel.tsx:103,111,470,574,863,1164`, `app/home/panels/*.tsx`, `app/home/store-panel.tsx:105,147`, `app/studio/brand/page.tsx:53`. Two independent declarations of one wire format, with the compiler unable to compare them: rename the `receipts` key at `app/api/me/traces/route.ts:33` to `items` and `context-panel.tsx:292` keeps compiling and renders an empty list. `app/home/use-swr.ts:14` (`cache.get(key) as T | undefined`) then re-asserts the same values out of an untyped cache.

**Fix:** one module per feature holding the schema, imported by both sides — the route validates its own output, the client parses the response.

```ts
// lib/api/contracts/memory.ts
export const MemoryState = z.object({
  memory: z.string().nullable(),
  user: z.string().nullable(),
  user_char_limit: z.number(),
});
export type MemoryState = z.infer<typeof MemoryState>;
```

```diff
--- a/apps/web/app/api/me/memory/route.ts
-      return NextResponse.json(
-        { ...files, user_char_limit: USER_PROFILE_CHAR_LIMIT },
-        { headers: NO_STORE }
-      );
+      return NextResponse.json(
+        { ...files, user_char_limit: USER_PROFILE_CHAR_LIMIT } satisfies MemoryState,
+        { headers: NO_STORE }
+      );

--- a/apps/web/app/home/panels/context-panel.tsx
-      const data = (await res.json()) as MemoryState;
+      const data = MemoryState.parse(await res.json());
```

`satisfies` (not `as`, not an annotation) is the point on the route side: it checks the literal against the contract while keeping the literal's own narrow type. If parsing on the client is judged too heavy for hot panels, importing the shared *type* and dropping the local duplicate already removes the drift class — the cast then at least references a single source of truth.

### M-3 · `exactOptionalPropertyTypes` is off, and 57 sites depend on that

**Measured:** `tsc --noEmit --exactOptionalPropertyTypes` → **57 errors** in 40 files. Concentrations: `lib/spectrum/sender.ts` (6), `app/home/page.tsx` (5), `lib/email/inbound.ts` (3), `lib/ads/approvals.ts` (3), `app/mini/[app]/route.ts` (3).

Almost every error is the same shape — a value of `T | undefined` handed to a `field?: T` property, i.e. code that cannot distinguish "absent" from "explicitly undefined":

```
app/api/admin/fleet/sync/route.ts(76,53): Argument of type '{ channel: ChannelName;
  canaryBoxIds: string[] | undefined; waveSize: number | undefined; ... }' is not
  assignable to parameter of type 'StartSyncJobInput' with 'exactOptionalPropertyTypes: true'.
app/api/decisions/[id]/route.ts(60,9): Type '{ subject: string | undefined; ... }' is not
  assignable to type '{ subject?: string; text?: string; to?: string[]; }'.
```

This matters here beyond pedantry because these objects are `JSON.stringify`-d to the box or spread into Supabase `update()` calls, where a present-but-undefined key and an absent key are genuinely different requests.

**Fix:** enable the flag and resolve each site one of two ways — widen the target when undefined is legitimately meaningful (`waveSize?: number | undefined`), or build the object conditionally when it is not:

```diff
-    canaryBoxIds,
-    waveSize: typeof body.wave_size === "number" ? body.wave_size : undefined,
+    ...(canaryBoxIds !== undefined && { canaryBoxIds }),
+    ...(typeof body.wave_size === "number" && { waveSize: body.wave_size }),
```

57 errors is one focused pass. Do it after H-1, since the zod schemas rewrite many of these argument objects anyway.

### M-4 · Boolean-flag result objects where a discriminated union is the actual model

**Where:**

| Site | Current | Problem |
|---|---|---|
| `lib/miniapps/publicExport.ts:25-32` | `{ ok: boolean; url: string \| null; line: string }` | callers must null-check `url` even after `ok === true` |
| `lib/identity/generate.ts:36-41` | `{ ok: boolean; notice: string; asset?: CreativeAsset; deliveryUrl?: string }` | success/failure fields coexist; every consumer re-checks |
| `lib/calendar/nl.ts:12-16` | `{ cron?: string; description?: string; error?: string }` | all-optional bag; `{}` and `{cron, error}` both typecheck |
| `lib/fleet/sync.ts:197` | `{ outcome: BoxOutcome; error?: string }` | `error` meaningful only for failing outcomes |
| `lib/identity/twin.ts:177`, `lib/vault/managers.ts:176`, `lib/commerce/checkout.ts:406` | same `ok:`-plus-optionals shape | same |

**Fix** (`publicExport.ts` as the template — the others follow mechanically):

```diff
-export interface PublicExportResult {
-  ok: boolean;
-  url: string | null;
-  line: string;
-}
+export type PublicExportResult =
+  | { ok: true; url: string; line: string }
+  | { ok: false; line: string };
```

`if (result.ok)` then gives callers a `string` URL with no null check, and the impossible states (`ok: true` with `url: null`) stop being representable. `lib/calendar/nl.ts` becomes `{ ok: true; cron: string; description: string } | { ok: false; error: string }`, which also removes the "did it parse?" ambiguity the UI currently resolves by truthiness.

### M-5 · ESLint runs no type-aware rules, so none of the above is enforced

**Where:** `eslint.config.mjs:6` extends only `next/core-web-vitals` and `next/typescript`. `next/typescript` is `typescript-eslint`'s non-type-checked base, so the rules that would have caught H-1/H-2 (`no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`, `no-unnecessary-type-assertion`) are not running. Nothing prevents the 263 assertions from becoming 300.

**Fix:** add a type-checked layer scoped to `lib/**` and `app/api/**` first (repo-wide `recommendedTypeChecked` on 587 files in one step will bury the signal):

```diff
+import tseslint from "typescript-eslint";
+
 const config = [
   ...compat.extends("next/core-web-vitals", "next/typescript"),
+  {
+    files: ["lib/**/*.ts", "app/api/**/*.ts"],
+    languageOptions: {
+      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
+    },
+    plugins: { "@typescript-eslint": tseslint.plugin },
+    rules: {
+      "@typescript-eslint/no-unnecessary-type-assertion": "error",
+      "@typescript-eslint/no-unsafe-argument": "error",
+      "@typescript-eslint/no-unsafe-assignment": "warn",
+      "@typescript-eslint/consistent-type-assertions": [
+        "error",
+        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
+      ],
+      "@typescript-eslint/no-explicit-any": "error",
+      "@typescript-eslint/no-non-null-assertion": "error",
+    },
+  },
```

`no-unnecessary-type-assertion` is the cheap early win: it flags exactly the casts that are already provably redundant (the `typeof`-narrowed routes), shrinking the diff surface before the real work. `objectLiteralTypeAssertions: "never"` is what pushes new code toward `satisfies`. Type-aware linting slows `npm run lint` — measure before extending it to `app/**/*.tsx`.

---

## L — Low / Info

### L-1 · Five strict flags cost nothing today — turn them on in this pass

Measured on this checkout, each flag alone:

| Flag | Errors | Verdict |
|---|---|---|
| `noImplicitOverride` | 0 | enable |
| `noUnusedLocals` | 0 | enable |
| `noFallthroughCasesInSwitch` | 0 | enable |
| `verbatimModuleSyntax` | 0 | enable |
| `noImplicitReturns` | 0 | enable |
| `noUnusedParameters` | 3 | enable with the 3 fixes below |
| `exactOptionalPropertyTypes` | 57 | see M-3 |
| `noPropertyAccessFromIndexSignature` | 1149 | do not enable — see L-2 |

```diff
--- a/apps/web/tsconfig.json
+++ b/apps/web/tsconfig.json
     "strict": true,
     "noUncheckedIndexedAccess": true,
+    "exactOptionalPropertyTypes": true,
+    "noImplicitOverride": true,
+    "noImplicitReturns": true,
+    "noFallthroughCasesInSwitch": true,
+    "noUnusedLocals": true,
+    "noUnusedParameters": true,
+    "verbatimModuleSyntax": true,
     "noEmit": true,
```

The three `noUnusedParameters` hits: `lib/payments/x402.ts:140` (`app`), `lib/miniapps/apps/inbox.tsx:154` (`threadId`), `lib/commerce/commerce.test.ts:157` (`op`) — prefix with `_` if the position must stay.

`strict` already provides `useUnknownInCatchVariables`, and the codebase honors it correctly everywhere we looked (`error instanceof Error ? error.message : "unknown"`), so no change is needed there.

### L-2 · `noPropertyAccessFromIndexSignature` is the wrong tool; route env through `lib/env.ts` instead

1149 errors, almost all `process.env.FOO` and test-double property access (`error TS4111: Property 'ADMIN_API_KEY' comes from an index signature`). Enabling it would force `process.env["ADMIN_API_KEY"]` across the repo for no safety gain — the real issue is that `lib/env.ts` exists as the single typed accessor and 30+ sites bypass it: `middleware.ts:24,51,92`, `lib/entitlements/models.ts:206-208,220-222,235-237,312-314`, `lib/miniapps/commandLane.ts:59`, `lib/publish/worker.ts:71`, `lib/publish/registry.ts:35`, `lib/payments/link.ts:19`, `lib/vault/purchase.ts:260`. Add the missing accessors to `lib/env.ts` and leave the flag off. (`middleware.ts` runs on the edge runtime — keep its reads inline or give `env.ts` an edge-safe subset.)

### L-3 · `as unknown as` in production code — two sites the compiler is objecting to

`lib/miniapps/commandLane.ts:218` and `:278` double-cast Supabase results to `Record<string, unknown>[]`. Both disappear under M-1. Every other `as unknown as` in the tree is a test double.

### L-4 · Non-null assertions are test-only (11 sites) — keep it that way

`lib/miniapps/apps/image.test.ts:157,159,162`, `lib/miniapps/tokens.test.ts:25`, `lib/miniapps/commandLane.test.ts:65,77,161,164,179,192,251`. Harmless in tests (a wrong assumption fails the test), and the `no-non-null-assertion` rule in M-5 is scoped to `lib/**`/`app/api/**` non-test globs. The repo already has a `migrate-to-shoehorn` skill available if the `link!`-style partials in `commandLane.test.ts` are worth tidying.

### L-5 · `satisfies` is under-used relative to `as const`

111 `as const` vs 4 `satisfies`. The lookup tables are the missed opportunity — e.g. `lib/entitlements/models.ts` tier maps and `lib/calendar/nl.ts:19-40` (`DAY_NUMBERS: Record<string, number>`): annotating with `Record<string, number>` discards the literal keys, so `DAY_NUMBERS.monday` is not known to exist and `parseTime`'s `WORD_TIMES[text]` lookup returns `[number, number] | undefined` for keys that provably exist. `const DAY_NUMBERS = { ... } satisfies Record<string, number>` keeps both the constraint and the keys.

### L-6 · `Record<string, string | null>` patch objects lose the row type

`app/api/bots/route.ts:176` builds `const patch: Record<string, string | null> = {}` and passes it to `.from("bots").update(patch)`, so a typo'd column name compiles. Under M-1 this becomes `Partial<Tables<"bots">>` — a typed patch, checked against the migration. `app/api/bots/[name]/routines/route.ts:198` shows the better local habit already (`{ name?: string; schedule?: string; prompt?: string }`).

### L-7 · Build scripts are outside the typecheck

`prebuild` runs four `.mjs` files (`scripts/build-onairos-connect.mjs`, `build-backgrounds.mjs`, `build-identity-booth.mjs`, `build-image-editor.mjs`), and `tsconfig.json`'s `include` covers only `**/*.ts(x)`, so a break in the mini-app bundlers surfaces only at build time. `scripts/preview-onboarding.ts` is checked. Low value at 24-49 lines each; convert opportunistically.

### L-8 · `skipLibCheck: true` — keep, with eyes open

Correct default for a tree carrying `three`, `@react-three/*`, `thirdweb`, and `spectrum-ts`, but it means a dependency's broken `.d.ts` (or a version skew between `zod` majors once zod is a direct dependency — the lockfile already resolves `zod@3.25.76` alongside packages asking for `^3.22.0 || ^4.0.0`) fails at runtime rather than at `tsc`. Pin `zod` explicitly when adopting it in H-1/M-2.

### Info · What the rubric found already correct

- **No `any` anywhere in type position** (0 sites), and no `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` (0 sites) — including test files. Rare at this size.
- **No `enum` declarations.** Domain vocabularies are string-literal unions with `as const` value arrays (`Deliver`, `BotModelTier`, `ChannelName`, speed tiers, model families) — exactly the recommended shape, and what makes the `z.enum(...)` fixes above one-liners.
- **`strict` and `noUncheckedIndexedAccess` already on**, and honored: `parts[2] as string` / `parts[1] as string` in `lib/auth/session.ts:89,93` are deliberate post-length-check narrowings, not a bypass.
- **Hand-rolled `unknown`-first validators already exist and are the right pattern** — `validateHandoff(input: unknown)` (`lib/onairos/context.ts:47`, with an SSRF host allowlist), `parseChunk`/`normalizeStatus` (`lib/imessage/ingest.ts:101,171`), `normalizeImageDoc`/`normalizeLayer` (`lib/miniapps/creativeDocs.ts:711,633`), `normalizeBerdDoc` (`lib/miniapps/berd/state.ts:189`), `parseGateSettingsRow` (`lib/miniapps/publish.ts:244`). H-1's fix generalizes what these files already do rather than introducing a foreign idea; they are also the sites where replacing hand-rolled narrowing with zod buys the least, so leave them last.
- **The five `app/api/admin/fleet/*` routes** are the in-repo model for correct boundary handling (M-1 aside) — `unknown` fields, explicit `try`/`catch` around `request.json()`, a real `400 invalid json`.
- **`catch (error)` handling is uniformly `unknown`-safe** (`error instanceof Error ? error.message : "unknown"`), with no empty catches in `lib/`.

---

## Suggested sequencing

1. **L-1** — six flags into `tsconfig.json`; zero-to-three errors, lands immediately, stops backsliding.
2. **H-1** — `zod` as an explicit dependency + `lib/http/body.ts`, then the eight crash-path routes, then the remaining 80 sites incrementally.
3. **M-5** — type-aware ESLint on `lib/**` + `app/api/**`, starting with `no-unnecessary-type-assertion` to sweep the casts H-1 made redundant.
4. **M-1** — generate `Database` types; deletes ~69 casts and both `as unknown as` sites, and unblocks L-6.
5. **M-3** — `exactOptionalPropertyTypes` (57 sites), after H-1 has rewritten many of the offending argument objects.
6. **H-2 / M-2** — schemas on the box/Hermes fetch helpers and shared route⇄client contracts; the largest change, and the one that stops the two-declarations-of-one-wire-format drift for good.
7. **M-4**, **L-2**, **L-5** — opportunistic, per touched file.

A reusable rubric for future reviews and new code is checked in at `.agents/skills/matt-pocock-typescript/SKILL.md`.
