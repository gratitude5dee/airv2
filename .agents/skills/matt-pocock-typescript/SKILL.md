---
name: matt-pocock-typescript
description: Strict-TypeScript rubric (Matt Pocock style) for reviewing or writing TypeScript in this repo — compiler flag audits, boundary validation with zod/unknown, discriminated unions, satisfies/as const, and hunting any/as-casts/non-null-assertions/ts-ignore. Use when asked to review TypeScript quality or type safety, audit a tsconfig, tighten types at an API/IO boundary, replace type assertions with runtime validation, or model a result type.
---

# Strict TypeScript rubric

Apply to `apps/web` (Next.js App Router). Verify every claim against the code and the compiler before writing it down — never report a flag's impact without running `tsc` with it.

Prior review with current findings and sequencing: `docs/review-2026-08/typescript-review.md`. Read it first when reviewing; it records what is already known-good so the same ground is not re-walked.

## Commands

```bash
cd apps/web
npx tsc --noEmit                                  # baseline (~15s; must be clean)
npx tsc --noEmit --exactOptionalPropertyTypes     # measure one candidate flag at a time
npx tsc --noEmit --<flag> 2>&1 | grep -c 'error TS'
npm run lint && npm test
```

Never assess a flag by reading code — enable it and count errors. Report the count and the top files.

## Rubric

Check in this order; report findings by severity with `path:line` and a concrete diff.

1. **Compiler flags.** `strict` and `noUncheckedIndexedAccess` are baseline. Also want: `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. `noPropertyAccessFromIndexSignature` is usually *not* worth it in a Next app (`process.env.X` noise) — route env through a typed accessor (`lib/env.ts`) instead.
2. **Boundaries.** Every value entering the process — `request.json()`, `response.json()`, `JSON.parse`, CLI stdout, DB rows — starts as `unknown` and leaves only through a check. `as` at a boundary is a lie the compiler will not catch.
3. **`any` / assertions / assumptions.** `any`, `as any`, `as unknown as`, non-null `!`, `@ts-ignore`, `@ts-expect-error`. Grep patterns are in the "Grep kit" below. Non-null assertions in tests are acceptable; in `lib/` and `app/api/` they are not.
4. **Generics used as assertions.** `function f<T>(...): Promise<T> { return json() as T }` performs no validation — the caller invents the type. Take a schema parameter instead and derive the return type from it.
5. **Impossible states.** Boolean flags plus optional fields (`{ ok: boolean; url: string | null }`) should be discriminated unions (`{ ok: true; url: string } | { ok: false }`).
6. **Enums.** Never. Use `as const` value arrays plus a derived string-literal union; it composes with `z.enum(...)`.
7. **`satisfies` over annotations and assertions.** `const config = {...} satisfies Shape` keeps literal types while checking the constraint. Annotating (`const m: Record<string, number> = {...}`) throws the keys away; asserting (`as Shape`) throws the check away.
8. **Enforcement.** A rubric that only lives in a review document regresses. Type-aware ESLint (`no-unnecessary-type-assertion`, `no-unsafe-argument`, `consistent-type-assertions` with `objectLiteralTypeAssertions: "never"`) is what holds the line.

## Grep kit

```bash
cd apps/web
rg -n '(:\s*any\b|<any>|any\[\]|Record<string,\s*any>|as any)' -g '*.ts' -g '*.tsx'
rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx'
rg -n '\w!\.|\w!\)|\w!\]|\w!;' -g '*.ts' -g '*.tsx' | rg -v '!='   # non-null assertions
rg -n ' as unknown as ' -g '*.ts' -g '*.tsx'
rg -n 'json\(\)\) as|json\(\) as|JSON\.parse\(.*\) as' -g '*.ts' -g '*.tsx'
rg -n '^\s*(export )?(const )?enum ' -g '*.ts' -g '*.tsx'
rg -c ' as [A-Z][A-Za-z0-9_<>\[\]\.]*' -g '*.ts' -g '*.tsx' . | sort -t: -k2 -rn | head
```

Exclude `*.test.*` when counting production debt; report test-only hits separately.

## Repo conventions

- **zod is not a direct dependency yet** (it resolves transitively at 3.25.76 via `x402`/`thirdweb`). Add it explicitly to `apps/web/package.json` before importing it; do not rely on the transitive copy.
- **The good in-repo boundary patterns to copy:** `app/api/admin/fleet/*/route.ts` (body fields declared `unknown`, narrowed field by field, real `400 invalid json`), `lib/onairos/context.ts` `validateHandoff(input: unknown)`, `lib/miniapps/creativeDocs.ts` `normalizeImageDoc(raw: unknown)`.
- **The pattern to stop reproducing:** `const body = (await request.json().catch(() => ({}))) as { name?: string }` followed by `body.name?.trim()`. A non-string field throws a `TypeError` → 500 instead of a 400.
- **Supabase rows are untyped** (`lib/supabase.ts` returns a bare `SupabaseClient`), which is why `data as SomeRow` appears ~69 times. Prefer generating `Database` types over adding another hand-written row interface.
- Route responses are untyped; clients re-declare and cast them. Put the shape in one module used by both sides, and have the route return it with `satisfies`.

## Reporting

Group findings High / Medium / Low, each with: where (`path:line`), why it bites at runtime (not "this is unidiomatic"), and a minimal diff. Distinguish a real failure path from a type-honesty issue, and say which it is — a cast that a downstream regex or `typeof` check happens to defend is Low, not High. Close with a sequencing list that puts the zero-error compiler flags first.
