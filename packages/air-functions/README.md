# @air/functions

The SDK a mini-app's `functions/index.ts` imports (V11 §11). One dependency-free
file: `src/index.ts`.

```ts
import { air } from "@air/functions";

const app = air.router();

app.post("/api/rsvp", async (c) => {
  const { principal, role } = c.user;            // set by the Dispatcher
  if (role === "anon") return c.json({ error: "sign in" }, 401);
  const { going } = await c.body<{ going: boolean }>();
  await c.db
    .prepare("insert or replace into rsvp (principal, going) values (?1, ?2)")
    .bind(principal, going ? 1 : 0)
    .run();
  return c.json({ ok: true });
});

export default app;
```

- `air.user(req)` — `{ principal, role, app, version }` from `X-Air-*` (Dispatcher-owned).
- `air.db(env)` / `c.db` — the app's D1 database (`"db": true` in `air.json`).
- `air.kv(env)` / `c.kv` — the app's KV namespace (`"kv": true`).
- `air.ai.chat({ model: "fast" | "balanced" | "deep", messages })` — the owner's
  gateway, metered to the app's daily cap.
- `air.state.get/put(resource)` — the owner's app state (owner writes, guests read).
- `air.actions.append(name, payload)` — a typed action for the owner's agent.
- `air.media.put(bytes, { filename, contentType })` — a public media file.

Everything platform-side is a `fetch` to `https://air.internal/v1/*`; the Outbound
Worker authenticates it. No token, key, or credential exists inside user code.

The Build Service resolves `@air/functions` to `packages/create-kit/functions/index.ts`,
a byte-for-byte copy of `src/index.ts` (pinned by `apps/web/lib/functions/sdk.test.ts`).
After editing `src/index.ts`: `cp src/index.ts ../create-kit/functions/index.ts`.
