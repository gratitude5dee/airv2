/**
 * V5 Browser subtab state + actions. GET assembles the panel from Postgres
 * metadata (vault login mirror, last-used vault_events, automation rules,
 * browser-labeled agent_runs) plus box probes (current pages via the local
 * CDP list, named sessions, site grants, recordings). Everything returned is
 * metadata — no vault value, no box URL, no debug endpoint (C16/C19).
 * POST carries the owner's actions: navigate (a browser_navigate run),
 * focus, per-site grant toggles, and standing-rule toggles (C22).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";
import {
  focusBrowser,
  listRecordings,
  listSessions,
  probeBrowser,
  type BrowserProbe,
  type BrowserRecording,
} from "@/lib/browser/probe";
import { normalizeHost, readSiteGrants, setSiteGrant } from "@/lib/browser/grants";
import {
  DEFAULT_DAILY_CAP,
  RULE_PLATFORMS,
  RULE_PLAYBOOKS,
} from "@/lib/browser/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  const [{ data: logins }, { data: events }, { data: rules }, { data: runs }] =
    await Promise.all([
      supabase
        .from("vault_items")
        .select("id, name, masked, totp_enabled")
        .eq("user_id", userId)
        .eq("kind", "login")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("vault_events")
        .select("item_id, action, context, created_at")
        .eq("user_id", userId)
        .in("action", ["fill_approved", "fill_denied"])
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("automation_rules")
        .select("id, playbook, platform, enabled, daily_cap, used_today, last_reset_at")
        .eq("user_id", userId),
      supabase
        .from("agent_runs")
        .select("id, hermes_run_id, trigger, label, started_at, ended_at, outcome")
        .eq("user_id", userId)
        .not("label", "is", null)
        .order("started_at", { ascending: false })
        .limit(30),
    ]);

  // Latest fill event per item — the Site access panel's "last used".
  const lastUsed: Record<string, { action: string; at: string }> = {};
  for (const event of events ?? []) {
    const itemId = event.item_id as string | null;
    if (itemId && !lastUsed[itemId]) {
      lastUsed[itemId] = {
        action: event.action as string,
        at: event.created_at as string,
      };
    }
  }

  let probe: BrowserProbe = { running: false, pages: [], currentUrl: null };
  let sessions: string[] = [];
  let grants: Record<string, string[]> = {};
  let recordings: BrowserRecording[] = [];
  let boxAwake = true;
  try {
    const box = await ensureBoxAwake(supabase, userId);
    [probe, sessions, grants, recordings] = await Promise.all([
      probeBrowser(box.boxId).catch(
        (): BrowserProbe => ({ running: false, pages: [], currentUrl: null })
      ),
      listSessions(box.boxId).catch((): string[] => []),
      readSiteGrants(box.boxId),
      listRecordings(box.boxId).catch((): BrowserRecording[] => []),
    ]);
  } catch {
    boxAwake = false;
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  return NextResponse.json(
    {
      box_awake: boxAwake,
      browser: probe,
      sessions,
      logins: (logins ?? []).map((item) => ({
        ...item,
        hosts: grants[item.id as string] ?? [],
        last_used: lastUsed[item.id as string] ?? null,
      })),
      rules: rules ?? [],
      rule_options: { playbooks: RULE_PLAYBOOKS, platforms: RULE_PLATFORMS },
      activity: runs ?? [],
      recordings,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.userId;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = typeof body?.["action"] === "string" ? body["action"] : "";

  try {
    if (action === "navigate") {
      const url = typeof body?.["url"] === "string" ? body["url"].trim() : "";
      const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      let parsed: URL;
      try {
        parsed = new URL(withScheme);
      } catch {
        return NextResponse.json({ error: "invalid url" }, { status: 400 });
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "invalid url" }, { status: 400 });
      }
      const box = await ensureBoxAwake(supabase, userId);
      try {
        const run = await createRun(box.target, {
          input: `Open ${parsed.href} in the headed browser (use browser_navigate). Do nothing else.`,
          sessionId: MAIN_SESSION,
          metadata: { channel: "browser_tab" },
        });
        await supabase.from("agent_runs").insert({
          user_id: userId,
          hermes_run_id: run.run_id,
          trigger: "web",
          label: "browser_navigate",
        });
        return NextResponse.json({ ok: true, run_id: run.run_id });
      } finally {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
    }

    if (action === "run_playbook") {
      const playbook = typeof body?.["playbook"] === "string" ? body["playbook"] : "";
      if (!(RULE_PLAYBOOKS as readonly string[]).includes(playbook)) {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }
      const box = await ensureBoxAwake(supabase, userId);
      try {
        const run = await createRun(box.target, {
          input: `Run the ${playbook} playbook now: read and follow the ${playbook} skill.`,
          sessionId: MAIN_SESSION,
          metadata: { channel: "browser_tab" },
        });
        await supabase.from("agent_runs").insert({
          user_id: userId,
          hermes_run_id: run.run_id,
          trigger: "web",
          label: `playbook:${playbook}`,
        });
        return NextResponse.json({ ok: true, run_id: run.run_id });
      } finally {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
    }

    if (action === "focus") {
      const box = await ensureBoxAwake(supabase, userId);
      try {
        const focused = await focusBrowser(box.boxId);
        return NextResponse.json({ ok: focused });
      } finally {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
    }

    if (action === "grant") {
      const itemId = typeof body?.["item_id"] === "string" ? body["item_id"] : "";
      const host = typeof body?.["host"] === "string" ? body["host"] : "";
      const allow = body?.["allow"] === true;
      if (!ID_RE.test(itemId) || !normalizeHost(host)) {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }
      // The item must be the owner's own login (mirror check) before its id
      // is written into the box's grant file.
      const { data: item } = await supabase
        .from("vault_items")
        .select("id")
        .eq("user_id", userId)
        .eq("id", itemId)
        .eq("kind", "login")
        .is("deleted_at", null)
        .maybeSingle();
      if (!item) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      const box = await ensureBoxAwake(supabase, userId);
      try {
        const grants = await setSiteGrant(box.boxId, itemId, host, allow);
        await supabase.from("vault_events").insert({
          user_id: userId,
          item_id: itemId,
          action: allow ? "grant_site" : "revoke_site",
          context: normalizeHost(host),
        });
        return NextResponse.json({ ok: true, hosts: grants[itemId] ?? [] });
      } finally {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
    }

    if (action === "rule") {
      const playbook = typeof body?.["playbook"] === "string" ? body["playbook"] : "";
      const platform = typeof body?.["platform"] === "string" ? body["platform"] : "";
      const enabled = body?.["enabled"] === true;
      const cap =
        typeof body?.["daily_cap"] === "number" &&
        Number.isInteger(body["daily_cap"]) &&
        body["daily_cap"] >= 1 &&
        body["daily_cap"] <= 200
          ? body["daily_cap"]
          : DEFAULT_DAILY_CAP;
      if (
        !(RULE_PLAYBOOKS as readonly string[]).includes(playbook) ||
        !(RULE_PLATFORMS as readonly string[]).includes(platform)
      ) {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }
      const { data: rule, error } = await supabase
        .from("automation_rules")
        .upsert(
          {
            user_id: userId,
            playbook,
            platform,
            enabled,
            daily_cap: cap,
          },
          { onConflict: "user_id,playbook,platform" }
        )
        .select("id, playbook, platform, enabled, daily_cap, used_today")
        .single();
      if (error) {
        return NextResponse.json({ error: "rule update failed" }, { status: 502 });
      }
      return NextResponse.json({ ok: true, rule });
    }

    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "start_limit_reached" }, { status: 429 });
    }
    console.error(
      JSON.stringify({
        msg: "browser action failed",
        user_id: userId,
        action,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "browser action failed" }, { status: 502 });
  }
}
