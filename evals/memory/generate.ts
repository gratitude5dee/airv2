/**
 * Synthetic 90-day iMessage archive generator (R-EV-11 / MEM-11/MEM-29).
 * Deterministic (fixed seed, fixed end date) so the committed output
 * regenerates byte-identically — regenerate with:
 *
 *   npx tsx evals/memory/generate.ts
 *
 * Emits into evals/memory/archive/:
 *   messages.jsonl       IngestMessage rows — what POST /api/me/imessage-history
 *                        accepts in chunks
 *   threads/<h>/<m>.md   rendered partitions via the real
 *                        mergeThreadArchive/renderThreadArchive — the exact
 *                        documents OpenViking indexes under
 *                        viking://resources/context/imessage-history/threads/
 *   manifest.json        message id → indexed partition URI (the artefact map
 *                        the scorer resolves expected ids against)
 *   queries.jsonl        30 recall queries with expected message ids
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  archivePartition,
  mergeThreadArchive,
  renderThreadArchive,
  type ArchiveMessage,
  type ThreadArchive,
} from "../../apps/web/lib/imessage/archive";

const HERE = new URL(".", import.meta.url).pathname;
const ARCHIVE_DIR = join(HERE, "archive");
/** Archive covers the 90 days ending on this fixed date. */
const END = Date.UTC(2026, 8, 25);
const DAYS = 90;
const SEED = 0xa1b5eed;

/** mulberry32 — tiny seeded PRNG, deterministic across platforms. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Thread {
  key: string;
  chatId: string;
  label: string;
  /** Display name for inbound messages. */
  from: string;
  /** Avg active days out of 10 and msgs per active day [min, max]. */
  activity: number;
  volume: [number, number];
  chatter: string[];
}

const CHATTER: Record<string, string[]> = {
  priya: [
    "call when you're free — label thing",
    "send me the new stems when you have them",
    "the venue moved load-in to 4",
    "did the merch numbers come in",
    "remind me to flag the ticketing add-on",
    "lunch next week?",
  ],
  alex: [
    "drummer can't make Thursday",
    "new demo is up — bridge is different",
    "borrow your DI box Saturday?",
    "setlist order draft in the folder",
    "that take from Tuesday was the one",
    "we're loud enough lol",
  ],
  sam: [
    "picking up groceries on the way",
    "did you see the kitchen light flicker again",
    "plants watered",
    "movie night Friday?",
    "your package arrived — left it inside",
    "out with Dana tonight, back by 11",
  ],
  mum: [
    "call your aunt when you get a chance",
    "dad says hi",
    "did the tomatoes take",
    "sending photos from the garden",
    "Sunday lunch still on?",
  ],
  dentist: [
    "Reminder: cleaning scheduled — reply C to confirm",
    "Your insurance claim has been processed",
    "We have a cancellation Friday morning if you'd like it",
  ],
  landlord: [
    "rent receipt attached — thank you",
    "water shutoff Tuesday 10-noon for the stack repair",
    "the hallway paint crew starts Monday",
  ],
  riley: [
    "bike's ready for pickup",
    "swapped the cassette — wear was worse than it looked",
    "try the pressure we set last time first",
  ],
  dana: [
    "counter came back — $1,900 guarantee on the 21st",
    "hotel block is confirmed for crew",
    "poster proof attached — approve today if possible",
    "routing sheet updated for the second leg",
  ],
};

const THREADS: Thread[] = [
  { key: "priya", chatId: "chat-priya", label: "Priya", from: "Priya Shah", activity: 5, volume: [2, 6], chatter: CHATTER["priya"]! },
  { key: "alex", chatId: "chat-alex", label: "Alex", from: "Alex Rivera", activity: 6, volume: [3, 8], chatter: CHATTER["alex"]! },
  { key: "sam", chatId: "chat-sam", label: "Sam", from: "Sam Chen", activity: 8, volume: [3, 9], chatter: CHATTER["sam"]! },
  { key: "mum", chatId: "chat-mum", label: "Mum", from: "Mum", activity: 4, volume: [2, 5], chatter: CHATTER["mum"]! },
  { key: "dentist", chatId: "chat-dentist", label: "Bright Smile Dental", from: "Bright Smile Dental", activity: 1, volume: [1, 2], chatter: CHATTER["dentist"]! },
  { key: "landlord", chatId: "chat-landlord", label: "Mr Okafor", from: "Mr Okafor", activity: 2, volume: [1, 3], chatter: CHATTER["landlord"]! },
  { key: "riley", chatId: "chat-riley", label: "Riley", from: "Riley (Bike Shop)", activity: 2, volume: [1, 4], chatter: CHATTER["riley"]! },
  { key: "dana", chatId: "chat-dana", label: "Dana", from: "Dana Reyes", activity: 4, volume: [2, 5], chatter: CHATTER["dana"]! },
];

/** The 30 planted facts the recall queries target — slugs become message ids. */
const FACTS: {
  slug: string;
  thread: string;
  /** Day offset into the 90-day window. */
  day: number;
  side: "them" | "me";
  text: string;
}[] = [
  { slug: "coffee-order", thread: "sam", day: 12, side: "them", text: "usual order is the 2lb medium roast espresso beans from Temple — repeats every ~6 weeks" },
  { slug: "door-code", thread: "landlord", day: 20, side: "them", text: "door code for the unit is 4471 now — changed after the panel swap" },
  { slug: "wifi-pass", thread: "landlord", day: 20, side: "them", text: "guest wifi: Willow5G / maple-crest-2210" },
  { slug: "priya-flight", thread: "priya", day: 78, side: "them", text: "I'm landing Sep 30 at 18:40 on UA1142 — pickup?" },
  { slug: "priya-conf", thread: "priya", day: 78, side: "them", text: "confirmation code for the flight is XKJV92" },
  { slug: "monitor-return", thread: "sam", day: 60, side: "them", text: "monitor return window closes Oct 12 — must drop it at FedEx before then" },
  { slug: "license-renewal", thread: "mum", day: 40, side: "them", text: "your driver's license renewal is due Nov 15 — DMV site says allow 6 weeks" },
  { slug: "shoe-size", thread: "riley", day: 33, side: "them", text: "your On Cloud 6 in black is size 10.5 — I'll hold a pair when restocked" },
  { slug: "rehearsal-day", thread: "alex", day: 55, side: "them", text: "rehearsals move to Thursdays starting October, 7pm at the Lockout" },
  { slug: "dentist-ref", thread: "dentist", day: 70, side: "them", text: "appointment Sep 29 10:15, ref APT-77312" },
  { slug: "chain-lube", thread: "riley", day: 47, side: "them", text: "your chain is past due — I used Dumonde Lite; next swap due in ~400 miles" },
  { slug: "dana-venue", thread: "dana", day: 65, side: "them", text: "The Independent wants the 12/04 date — hold fee $800, contract by Friday" },
  { slug: "alex-baby", thread: "alex", day: 8, side: "them", text: "Maya had the baby — name is Noor, 7lb 4oz" },
  { slug: "mum-recipe", thread: "mum", day: 30, side: "them", text: "the lentil soup needs cumin, coriander, and the smoked paprika — not regular" },
  { slug: "priya-reimburse", thread: "priya", day: 44, side: "them", text: "I owe you $180 for the merch run — zelle you Friday" },
  { slug: "sam-anniversary", thread: "sam", day: 74, side: "them", text: "anniversary dinner is Oct 18 — I booked Liholiho, 8pm" },
  { slug: "landlord-plumber", thread: "landlord", day: 82, side: "them", text: "plumber comes Oct 2 between 9–12 for the kitchen tap" },
  { slug: "mum-meds", thread: "mum", day: 51, side: "them", text: "dad's cardiology follow-up is Nov 3 at UCSF, he wants you on the call" },
  { slug: "dana-splits", thread: "dana", day: 58, side: "them", text: "splits for the tour: you 70%, TM 15%, agent 15% — confirms the sheet" },
  { slug: "riley-size", thread: "riley", day: 15, side: "them", text: "frame size stays 56cm — same as last fit" },
  { slug: "alex-mix", thread: "alex", day: 26, side: "them", text: "final mix notes: bring the chorus up 2dB, delay the bridge vocal 1/8" },
  { slug: "sam-decaf", thread: "sam", day: 12, side: "them", text: "order the Decaf Colombia too this time — guests complained" },
  { slug: "dentist-insurance", thread: "dentist", day: 22, side: "them", text: "Delta Dental PPO on file, member DD-5541287" },
  { slug: "priya-call", thread: "priya", day: 62, side: "them", text: "call before the SJ show — want to lock the guest list by Wednesday" },
  { slug: "landlord-lease", thread: "landlord", day: 76, side: "them", text: "lease renewal paper goes out Oct 20 — same terms, +3%" },
  { slug: "alex-van", thread: "alex", day: 71, side: "them", text: "van needs new brake pads before the run — booked Oct 9 at Don's" },
  { slug: "dana-settime", thread: "dana", day: 80, side: "them", text: "set time 21:00, 75 min, soundcheck 17:30" },
  { slug: "mum-birthday", thread: "mum", day: 66, side: "them", text: "your aunt's 70th is Nov 8 — we're doing brunch at Zazie" },
  { slug: "riley-fit", thread: "riley", day: 36, side: "them", text: "cleat position moved 4mm back — knee pain should ease" },
  { slug: "sam-passport", thread: "sam", day: 86, side: "them", text: "your passport expires Mar 2027 — the Mexico trip needs it renewed" },
];

export const QUERIES: { id: string; query: string; expected: string[] }[] = [
  { id: "M01", query: "what do I usually order for espresso beans?", expected: ["m-coffee-order"] },
  { id: "M02", query: "what's the door code for my place now?", expected: ["m-door-code"] },
  { id: "M03", query: "guest wifi password at home?", expected: ["m-wifi-pass"] },
  { id: "M04", query: "when does Priya land and what's her flight confirmation?", expected: ["m-priya-flight", "m-priya-conf"] },
  { id: "M05", query: "Priya's flight confirmation code?", expected: ["m-priya-conf"] },
  { id: "M06", query: "when does the monitor return window close?", expected: ["m-monitor-return"] },
  { id: "M07", query: "when is my driver's license renewal due?", expected: ["m-license-renewal"] },
  { id: "M08", query: "what size On Cloud runners do I wear?", expected: ["m-shoe-size"] },
  { id: "M09", query: "what day are rehearsals moving to?", expected: ["m-rehearsal-day"] },
  { id: "M10", query: "what's my dental appointment reference?", expected: ["m-dentist-ref"] },
  { id: "M11", query: "which chain lube did Riley put on?", expected: ["m-chain-lube"] },
  { id: "M12", query: "what hold fee did Dana quote for The Independent?", expected: ["m-dana-venue"] },
  { id: "M13", query: "what did Alex name the baby?", expected: ["m-alex-baby"] },
  { id: "M14", query: "what goes in mum's lentil soup?", expected: ["m-mum-recipe"] },
  { id: "M15", query: "how much does Priya owe me for the merch run?", expected: ["m-priya-reimburse"] },
  { id: "M16", query: "when is the anniversary dinner and where?", expected: ["m-sam-anniversary"] },
  { id: "M17", query: "when is the plumber coming?", expected: ["m-landlord-plumber"] },
  { id: "M18", query: "when is dad's cardiology follow-up?", expected: ["m-mum-meds"] },
  { id: "M19", query: "what are the tour splits Dana confirmed?", expected: ["m-dana-splits"] },
  { id: "M20", query: "what frame size does Riley have me at?", expected: ["m-riley-size"] },
  { id: "M21", query: "what were Alex's final mix notes?", expected: ["m-alex-mix"] },
  { id: "M22", query: "what extra coffee did Sam ask for?", expected: ["m-sam-decaf"] },
  { id: "M23", query: "what dental insurance is on file?", expected: ["m-dentist-insurance"] },
  { id: "M24", query: "what did Priya want to lock before the SJ show?", expected: ["m-priya-call"] },
  { id: "M25", query: "when do the lease renewal papers go out?", expected: ["m-landlord-lease"] },
  { id: "M26", query: "when is the van booked for brake pads?", expected: ["m-alex-van"] },
  { id: "M27", query: "what's our set time and soundcheck?", expected: ["m-dana-settime"] },
  { id: "M28", query: "when is aunt's 70th and where?", expected: ["m-mum-birthday"] },
  { id: "M29", query: "how far did Riley move my cleats?", expected: ["m-riley-fit"] },
  { id: "M30", query: "when does my passport expire?", expected: ["m-sam-passport"] },
];

export const QUERY_COUNT = QUERIES.length;

export type Query = (typeof QUERIES)[number];

function iso(dayOffset: number, minutesIntoDay: number): string {
  return new Date(
    END - (DAYS - 1 - dayOffset) * 86_400_000 + minutesIntoDay * 60_000
  ).toISOString();
}

/** Build the archive: chatter + planted facts, deterministic by seed. */
export function buildMessages(): ArchiveMessage[] {
  const rand = rng(SEED);
  const factByThreadDay = new Map<string, (typeof FACTS)[number][]>();
  for (const fact of FACTS) {
    const key = `${fact.thread}:${fact.day}`;
    factByThreadDay.set(key, [...(factByThreadDay.get(key) ?? []), fact]);
  }

  const messages: ArchiveMessage[] = [];
  let seq = 0;
  for (const thread of THREADS) {
    for (let day = 0; day < DAYS; day++) {
      const active = rand() * 10 < thread.activity;
      const facts = factByThreadDay.get(`${thread.key}:${day}`) ?? [];
      if (!active && !facts.length) continue;
      const burst = facts.length + (active
        ? Math.floor(rand() * (thread.volume[1] - thread.volume[0] + 1)) +
          thread.volume[0]
        : 0);
      let minute = Math.floor(7 * 60 + rand() * 13 * 60);
      let factIndex = 0;
      for (let i = 0; i < burst; i++) {
        const fact =
          factIndex < facts.length && (i >= burst - facts.length || rand() < 0.4)
            ? facts[factIndex++]
            : undefined;
        const fromMe = fact ? fact.side === "me" : rand() < 0.45;
        const text =
          fact?.text ??
          thread.chatter[Math.floor(rand() * thread.chatter.length)]!;
        const id = fact ? `m-${fact.slug}` : `x-${seq++}`;
        messages.push({
          id,
          chat_id: thread.chatId,
          chat: thread.label,
          ts: iso(day, minute),
          from: fromMe ? "me" : thread.from,
          is_from_me: fromMe,
          text,
        });
        minute += 1 + Math.floor(rand() * 14);
      }
    }
  }
  return messages.sort((a, b) => a.ts.localeCompare(b.ts));
}

export function buildArchive(messages: ArchiveMessage[]): {
  partitions: Map<string, ThreadArchive>;
  rendered: Map<string, string>;
} {
  const partitions = new Map<string, ThreadArchive>();
  for (const message of messages) {
    const partition = archivePartition(message);
    partitions.set(partition, mergeThreadArchive(partitions.get(partition) ?? null, [message]));
  }
  const rendered = new Map<string, string>();
  for (const [partition, archive] of partitions) {
    rendered.set(`${partition}.md`, renderThreadArchive(archive));
  }
  return { partitions, rendered };
}

const VIKING_PREFIX = "viking://resources/context/imessage-history/threads/";

export interface Manifest {
  schema: 1;
  end: string;
  days: number;
  messages: number;
  /** message id → indexed partition URI. */
  artefacts: Record<string, string>;
}

export function buildManifest(messages: ArchiveMessage[]): Manifest {
  const artefacts: Record<string, string> = {};
  for (const message of messages) {
    if (message.id) {
      artefacts[message.id] = `${VIKING_PREFIX}${archivePartition(message)}`;
    }
  }
  return {
    schema: 1,
    end: new Date(END).toISOString().slice(0, 10),
    days: DAYS,
    messages: messages.length,
    artefacts,
  };
}

export function writeArchive(dir: string): Manifest {
  const messages = buildMessages();
  const { rendered } = buildArchive(messages);
  const manifest = buildManifest(messages);

  for (const [name, content] of rendered) {
    const path = join(dir, "threads", name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  writeFileSync(
    join(dir, "messages.jsonl"),
    messages.map((message) => JSON.stringify(message)).join("\n") + "\n"
  );
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    join(dir, "queries.jsonl"),
    QUERIES.map((query) => JSON.stringify(query)).join("\n") + "\n"
  );
  return manifest;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const manifest = writeArchive(ARCHIVE_DIR);
  console.log(
    `wrote ${manifest.messages} messages across ` +
      `${Object.keys(manifest.artefacts).length} artefacts (${QUERY_COUNT} queries)`
  );
}
