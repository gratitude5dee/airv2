/**
 * V5 vault fill dispatch. The authenticated owner asks for one login field
 * (or the current TOTP code) to be typed into the focused input of the box's
 * headed browser. The control plane pre-checks the site grant against the
 * frontmost page and dispatches `air-vault type` — the CLI re-checks the
 * grant and delivers the value in-process over CDP. The response is the safe
 * receipt only; the value never transits this route (C19). Card fields are
 * refused everywhere until V6's fill tickets (C20) — see lib/vault/fill's
 * mintFillTicket seam.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { VaultCliError } from "@/lib/vault/client";
import { typeVaultField, typeVaultTotp } from "@/lib/vault/fill";
import { readSiteGrants } from "@/lib/browser/grants";
import { probeBrowser } from "@/lib/browser/probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const FIELD_RE = /^[a-z_][a-z0-9_]*$/;

// Card-kind fields never fill in V5 (C20); the CLI refuses them too.
const CARD_FIELDS = new Set(["number", "cvv", "expiry_month", "expiry_year"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.userId;
  const body = (await request.json().catch(() => null)) as {
    item_id?: unknown;
    field?: unknown;
    totp?: unknown;
  } | null;
  const itemId = typeof body?.item_id === "string" ? body.item_id : "";
  const totp = body?.totp === true;
  const field = typeof body?.field === "string" ? body.field : "";
  if (!ID_RE.test(itemId) || (!totp && !FIELD_RE.test(field))) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  // Ownership + kind gate from the metadata mirror: only the owner's own
  // login items are fillable (cards are metadata-visible but refused, C20).
  const { data: item } = await supabase
    .from("vault_items")
    .select("id, kind")
    .eq("user_id", userId)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (item.kind !== "login" || (!totp && CARD_FIELDS.has(field))) {
    return NextResponse.json(
      {
        error: "fill_ticket_required",
        message: "only login fields can be typed in V5",
      },
      { status: 403 }
    );
  }

  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      // Advisory pre-check for a friendly error; the CLI is the enforcer.
      const [grants, probe] = await Promise.all([
        readSiteGrants(box.boxId),
        probeBrowser(box.boxId),
      ]);
      if (!probe.running || !probe.currentUrl) {
        return NextResponse.json(
          { error: "browser_unreachable", message: "no page is open" },
          { status: 409 }
        );
      }
      const host = new URL(probe.currentUrl).hostname.replace(/^www\./, "");
      const granted = (grants[itemId] ?? []).some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`)
      );
      if (!granted) {
        return NextResponse.json(
          {
            error: "site_not_granted",
            message: `${host} is not allowed for this login — flip "Allow agent sign-in" first`,
            host,
          },
          { status: 403 }
        );
      }
      const receipt = totp
        ? await typeVaultTotp(box.boxId, userId, itemId)
        : await typeVaultField(box.boxId, userId, itemId, field);
      return NextResponse.json({ ok: true, receipt });
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "start_limit_reached" }, { status: 429 });
    }
    if (error instanceof VaultCliError) {
      const status =
        error.code === "site_not_granted" || error.code === "fill_ticket_required"
          ? 403
          : error.code === "browser_unreachable"
            ? 409
            : 400;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status }
      );
    }
    console.error(
      JSON.stringify({
        msg: "vault fill failed",
        user_id: userId,
        item_id: itemId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "fill failed" }, { status: 502 });
  }
}
