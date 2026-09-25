/**
 * Seed the eval fixture box — writes the state
 * `results/wzrdmail-luna-seeded/COMPARISON.md` describes in prose so a fresh
 * box can run the suite against real, citable data:
 *
 *   - `~/.hermes/calendar/events.json` — 6 events over the next 8 days,
 *     written through `calendar/sync.py upsert` (never hand-edited).
 *   - CRM people store — 8 contacts (producer, A&R, booking, merch vendor,
 *     tour manager, superfan, press, venue) at the mini-app path
 *     `.hermes/miniapps/crm/people.json`, plus a copy at the legacy
 *     `~/.hermes/people/people.json` the comparison prose names.
 *   - `~/.hermes/context/onairos.md` — interests / personality /
 *     growth-areas profile, indexed into OpenViking.
 *   - `~/.hermes/connected-tools.md` — left truthful: "Connected: nothing
 *     yet." (the seeded user has no OAuth integrations; nothing is faked).
 *
 * Usage:
 *
 *   BOX_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     EVAL_USER_ID=<supabase user id> npx tsx evals/agent-suite/seed.ts
 *
 * Box resolution: EVAL_BOX_ID if set, else the `boxes` row for EVAL_USER_ID.
 * Only ascii-provider boxes are seeded (tenki `tk_…` ids are not supported).
 */
import { requireEnv, supaSelect, type Supa } from "./lib";

const BOX_API = (process.env.BOX_API_BASE ?? "https://ascii.dev/api/box/v1").replace(/\/$/, "");
const BOX_KEY = requireEnv("BOX_API_KEY");

// ---------------------------------------------------------------- box REST

/** Run a shell command on the box through the ascii control plane. */
async function boxCmd(boxId: string, command: string, timeoutSeconds = 120): Promise<string> {
  const res = await fetch(`${BOX_API}/boxes/${boxId}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOX_KEY}` },
    body: JSON.stringify({ command, timeoutSeconds }),
  });
  const body = (await res.json()) as {
    exitCode?: number | null;
    stdout?: string;
    stderr?: string;
  };
  if (!res.ok) {
    throw new Error(`box command failed (${res.status}): ${(body.stderr ?? "").slice(0, 400)}`);
  }
  if (body.exitCode !== 0) {
    throw new Error(`box command exit ${body.exitCode}: ${(body.stderr ?? "").slice(0, 400)}`);
  }
  return body.stdout ?? "";
}

async function boxWriteFile(boxId: string, path: string, content: string): Promise<void> {
  const res = await fetch(`${BOX_API}/boxes/${boxId}/files`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BOX_KEY}` },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`write ${path} failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
}

async function resolveBoxId(supa: Supa, userId: string): Promise<string> {
  const rows = await supaSelect<{ provider_box_id: string }>(
    supa,
    "boxes",
    `select=provider_box_id&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`
  );
  const id = rows[0]?.provider_box_id;
  if (!id) throw new Error(`no box found for user ${userId} — provision it first`);
  if (id.startsWith("tk_")) {
    throw new Error(
      `box ${id} is on tenki — this seeder only speaks the ascii box REST API; set EVAL_BOX_ID to an ascii box`
    );
  }
  return id;
}

// --------------------------------------------------------------- the seed

/** Box home — ascii boxes run as `user`, not `ubuntu`. */
const HOME = "/home/user";

const DAY = 86_400_000;
const at = (daysAhead: number, hour: number, minute = 0): string => {
  const d = new Date(Date.now() + daysAhead * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** The six events COMPARISON.md describes, spanning the next 8 days. */
const EVENTS: { title: string; starts_at: string; ends_at: string; location?: string }[] = [
  { title: "Studio session", starts_at: at(1, 19), ends_at: at(1, 23), location: "Luna Sound, Highland Park" },
  { title: "A&R call — Dana", starts_at: at(2, 11), ends_at: at(2, 11, 45) },
  { title: "Rehearsal", starts_at: at(3, 18), ends_at: at(3, 21), location: "The Warehouse" },
  { title: "Merch go-live", starts_at: at(4, 9), ends_at: at(4, 9, 30) },
  { title: "Flight to Austin — AA1142", starts_at: at(6, 8, 15), ends_at: at(6, 11, 40) },
  { title: "Show — Warehouse Live", starts_at: at(7, 20), ends_at: at(7, 23, 30), location: "Warehouse Live, Austin TX" },
];

interface SeedPerson {
  id: string;
  name: string;
  emails: string[];
  notes: string;
  tags: string[];
}

const PEOPLE: SeedPerson[] = [
  { id: "p-marcus-webb", name: "Marcus Webb", emails: ["marcus.webb@example.com"], notes: "Producer on the last two singles; prefers late sessions", tags: ["music"] },
  { id: "p-dana-whitfield", name: "Dana Whitfield", emails: ["dana.whitfield@example.com"], notes: "A&R at Northline; follow-ups go in email", tags: ["music"] },
  { id: "p-rio-tanaka", name: "Rio Tanaka", emails: ["rio.tanaka@example.com"], notes: "Booking agent — clubs and support slots", tags: ["touring"] },
  { id: "p-priya-nair", name: "Priya Nair", emails: ["priya.nair@example.com"], notes: "Merch vendor; drop pricing goes through her", tags: ["merch"] },
  { id: "p-theo-marchetti", name: "Theo Marchetti", emails: ["theo.marchetti@example.com"], notes: "Tour manager for the fall run", tags: ["touring"] },
  { id: "p-juno-alvarez", name: "Juno Alvarez", emails: ["juno.alvarez@example.com"], notes: "Superfan admin; handles the fan list", tags: ["community"] },
  { id: "p-casey-liu", name: "Casey Liu", emails: ["casey.liu@example.com"], notes: "Press contact — features and premieres", tags: ["press"] },
  { id: "p-nadia-ferreira", name: "Nadia Ferreira", emails: ["nadia.ferreira@example.com"], notes: "Venue contact at Warehouse Live", tags: ["touring"] },
];

/** people.json — the shape lib/crm/store.ts's readPeople parses. */
function peopleJson(): string {
  const now = new Date().toISOString();
  return `${JSON.stringify(
    {
      version: 1,
      // Name index up front so the names show inside a truncated tool preview.
      index: PEOPLE.map((p) => p.name),
      people: PEOPLE.map((p) => ({
        id: p.id,
        name: p.name,
        emails: p.emails,
        phones: [],
        sender_ids: [],
        photos: [],
        notes: p.notes,
        tags: p.tags,
        provenance: [{ source: "owner", at: now, note: "eval seed" }],
        created_at: now,
        updated_at: now,
      })),
    },
    null,
    2
  )}\n`;
}

/** The seeded Onairos profile — interests, voice, growth areas. */
const ONAIROS_MD = `# Onairos — Luna

## Interests
- Live electronic performance; hybrid DJ/instrument sets.
- Austin and LA venues for the fall tour.
- Merch drops timed around show announcements.
- AI-assisted mastering workflow (defensive; keeps stems local).

## Personality
- Direct, short sentences; hates filler and spec sheets.
- Fast context-switcher — asks about venues mid-conversation on email copy.
- Skeptical of anything that touches her files without saying so.

## Growth areas
- Delegates venue outreach late; should trust Rio earlier.
- Drops press follow-ups; Casey needs nudges.
- Doesn't log fan interactions — Juno's list is always stale.
`;

async function main(): Promise<void> {
  const userId = requireEnv("EVAL_USER_ID");
  const supa: Supa = {
    url: requireEnv("SUPABASE_URL").replace(/\/$/, ""),
    key: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
  const boxId = process.env.EVAL_BOX_ID ?? (await resolveBoxId(supa, userId));
  console.log(`[seed] box ${boxId}`);

  // Calendar — six events through the canonical upsert path. Deterministic
  // `local:seed-*` ids make a re-seed idempotent (upsert, not duplicate).
  const b64Upsert =
    "python3 -c 'import base64,sys;print(base64.b64encode(sys.stdin.buffer.read()).decode())'" +
    " | xargs -I{} python3 ~/.hermes/calendar/sync.py upsert {}";
  for (const ev of EVENTS) {
    const id = `local:seed-${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const payload = JSON.stringify({ id, title: ev.title, starts_at: ev.starts_at, ends_at: ev.ends_at, ...(ev.location ? { location: ev.location } : {}) });
    const out = await boxCmd(boxId, `printf '%s' '${payload.replace(/'/g, `'\\''`)}' | ${b64Upsert}`);
    console.log(`[seed] event "${ev.title}": ${out.trim().slice(0, 80)}`);
  }

  // People store — canonical mini-app path plus the legacy path the
  // comparison prose documents; both readers find the same contacts.
  const people = peopleJson();
  for (const path of [
    `${HOME}/.hermes/miniapps/crm/people.json`,
    `${HOME}/.hermes/people/people.json`,
  ]) {
    await boxCmd(boxId, `mkdir -p '${path.split("/").slice(0, -1).join("/")}'`);
    await boxWriteFile(boxId, path, people);
  }
  console.log(`[seed] people.json: ${PEOPLE.length} contacts`);

  // Onairos profile, indexed into OpenViking so memory queries can hit it.
  await boxCmd(boxId, `mkdir -p ${HOME}/.hermes/context`);
  await boxWriteFile(boxId, `${HOME}/.hermes/context/onairos.md`, ONAIROS_MD);
  const indexOut = await boxCmd(
    boxId,
    `ovctl add-resource ${HOME}/.hermes/context/onairos.md --to viking://resources/context/onairos 2>&1 || true`,
    660
  );
  console.log(`[seed] onairos.md indexed: ${indexOut.trim().slice(0, 120) || "(queued)"}`);

  // Connected-tools stays truthful — the seeded user has no OAuth accounts.
  await boxWriteFile(boxId, `${HOME}/.hermes/connected-tools.md`, "# Connected tools\n\nConnected: nothing yet.\n");

  console.log("[seed] done — the box now carries the wzrdmail-luna-seeded fixture");
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")
) {
  main().catch((error: unknown) => {
    console.error(`[seed] fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
