/**
 * Operator mailbox backfill: run `ensureMailboxOnBox` for every ubuntu box so
 * each user ends up with an inbox, a primary agent_addresses row, the
 * draft-only key in `.hermes/.env`, and the mail MCP in the box config —
 * closing the cohort that predated per-box mail wiring (signup paths that
 * passed no username, boxes provisioned before the ensure existed).
 *
 * Stopped boxes are resumed so the box writes land; the idle sweeper reclaims
 * them afterwards (C6 — never force-stopped). Per-box failures are collected,
 * never fatal to the sweep. `user_id` targets a single box; `dry` reports the
 * plan without touching anything; `generate_handles` lets users with no
 * username (the phone-signup cohort) receive an address synthesized as
 * `u<id8>@<domain>` — without it they are reported and skipped, since no
 * address can be addressed.
 *
 * Pages with `after` (a provider_box_id cursor); repeat the returned
 * `continuation` body to finish a fleet that outruns the deadline.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { resume } from "@/lib/box/client";
import { kindFor, toComputeEnvironment } from "@/lib/compute/environments";
import {
  ensureMailboxOnBox,
  provisionEmail,
} from "@/lib/provisioning/email";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = 100;
const DEADLINE_MS = 150_000;
/** Awake box states — commands land without a resume. */
const AWAKE_STATES = new Set(["ready", "idle"]);

type BoxRow = {
  user_id: string;
  provider_box_id: string;
  environment: string | null;
  state: string;
};

type EnsureOutcome =
  | "ensured"
  | "would_ensure"
  | "would_synthesize"
  | "already"
  | "no_username"
  | "error";

type EnsureResult = {
  user_id: string;
  box_id: string;
  outcome: EnsureOutcome;
  error?: string;
};

async function fetchPage(
  supabase: ReturnType<typeof serviceClient>,
  userId: string | null,
  after: string | null,
): Promise<BoxRow[]> {
  let query = supabase
    .from("boxes")
    .select("user_id, provider_box_id, environment, state")
    .not("provider_box_id", "is", null)
    .order("provider_box_id")
    .limit(PAGE + 1);
  if (userId) query = query.eq("user_id", userId);
  if (after) query = query.gt("provider_box_id", after);
  const { data, error } = await query;
  if (error) throw new Error(`boxes page failed: ${error.message}`);
  return ((data ?? []) as BoxRow[]).filter(
    (row) => kindFor(toComputeEnvironment(row.environment)) === "box",
  );
}

async function usernamesFor(
  supabase: ReturnType<typeof serviceClient>,
  rows: BoxRow[],
): Promise<Map<string, string>> {
  const ids = rows.map((row) => row.user_id);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .in("id", ids);
  if (error) throw new Error(`users lookup failed: ${error.message}`);
  const map = new Map<string, string>();
  for (const user of (data ?? []) as { id: string; username: string | null }[]) {
    if (user.username) map.set(user.id, user.username);
  }
  return map;
}

async function addressedFor(
  supabase: ReturnType<typeof serviceClient>,
  rows: BoxRow[],
): Promise<Set<string>> {
  const ids = rows.map((row) => row.user_id);
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("agent_addresses")
    .select("user_id")
    .in("user_id", ids)
    .eq("is_primary", true)
    .is("retired_at", null);
  if (error) throw new Error(`agent_addresses lookup failed: ${error.message}`);
  return new Set((data ?? []).map((row: { user_id: string }) => row.user_id));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: unknown;
    dry?: unknown;
    generate_handles?: unknown;
    after?: unknown;
  };
  if (body.user_id !== undefined && typeof body.user_id !== "string") {
    return NextResponse.json(
      { error: "user_id must be a string" },
      { status: 400 },
    );
  }
  if (body.after !== undefined && typeof body.after !== "string") {
    return NextResponse.json(
      { error: "after must be a provider_box_id" },
      { status: 400 },
    );
  }
  const userId = body.user_id ?? null;
  const dry = body.dry === true;
  const generateHandles = body.generate_handles === true;
  const after = body.after ?? null;

  const supabase = serviceClient();
  let rows: BoxRow[];
  let usernames: Map<string, string>;
  let addressed: Set<string>;
  try {
    rows = await fetchPage(supabase, userId, after);
    usernames = await usernamesFor(supabase, rows);
    addressed = await addressedFor(supabase, rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "lookup failed" },
      { status: 500 },
    );
  }
  const overflow = rows.length > PAGE ? rows.splice(PAGE) : [];

  const deadline = Date.now() + DEADLINE_MS;
  const results: EnsureResult[] = [];
  let processed = 0;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    processed += 1;
    const base = { user_id: row.user_id, box_id: row.provider_box_id };
    const username = usernames.get(row.user_id);
    if (addressed.has(row.user_id)) {
      results.push({ ...base, outcome: "already" });
      continue;
    }
    if (!username && !generateHandles) {
      results.push({ ...base, outcome: "no_username" });
      continue;
    }
    if (dry) {
      results.push({
        ...base,
        outcome: username ? "would_ensure" : "would_synthesize",
      });
      continue;
    }
    try {
      if (!AWAKE_STATES.has(row.state)) {
        await resume(row.provider_box_id);
      }
      if (username) {
        await ensureMailboxOnBox(supabase, row.user_id, row.provider_box_id);
      } else {
        // provisionEmail derives the address and installs on the user's
        // boxes row — which is this box here, so a second ensure would mint
        // a redundant draft key.
        const provisioned = await provisionEmail(
          supabase,
          row.user_id,
          `u${row.user_id.slice(0, 8)}`,
        );
        if (provisioned.installedBoxId !== row.provider_box_id) {
          await ensureMailboxOnBox(supabase, row.user_id, row.provider_box_id);
        }
      }
      results.push({ ...base, outcome: "ensured" });
    } catch (error) {
      results.push({
        ...base,
        outcome: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const pending = rows.slice(processed).concat(overflow);
  // `after` is exclusive (gt) — resume at the last processed id, not the
  // first pending one, or the first unprocessed box would be skipped.
  const cursor = rows[processed - 1]?.provider_box_id ?? after;
  const count = (outcome: EnsureOutcome) =>
    results.filter((r) => r.outcome === outcome).length;
  return NextResponse.json({
    dry,
    targeted: rows.length + overflow.length,
    processed,
    counts: {
      ensured: count("ensured"),
      would_ensure: count("would_ensure"),
      would_synthesize: count("would_synthesize"),
      already: count("already"),
      no_username: count("no_username"),
      error: count("error"),
    },
    errors: results.filter((r) => r.outcome === "error"),
    results,
    continuation: pending.length > 0 ? { after: cursor } : null,
  });
}
