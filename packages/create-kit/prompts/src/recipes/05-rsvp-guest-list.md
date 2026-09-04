### RSVP / guest list (Functions)

Many people write, so state cannot be the owner's 256 KiB resource. This shape needs a Functions backend: `functions/index.ts` with `hono` + `zod`, one D1 table, `POST /api/rsvp` and `GET /api/guests`. Front end: `beautiful/records-table` or a `.panel` list of `.item` rows, `beautiful/entity-chip` for each guest, `beautiful/button` to submit.

```ts
// functions/index.ts
import { Hono } from "hono";
import { z } from "zod";
import { air } from "@air/functions";
const app = new Hono();
const Rsvp = z.object({ name: z.string().min(1).max(60), going: z.boolean() });
app.post("/api/rsvp", async (c) => {
  const body = Rsvp.parse(await c.req.json());
  await air.db(c).prepare("insert into rsvp(principal,name,going) values(?,?,?) on conflict(principal) do update set name=excluded.name, going=excluded.going")
    .bind(air.user(c.req.raw).principal, body.name, body.going ? 1 : 0).run();
  return c.json({ ok: true });
});
export default app;
```

The guest never sees another guest's principal; names only. The owner sees counts and the list. Rate limits and identity are the Dispatcher's; the app trusts `X-Air-Role` via `air.user()` and nothing else.
