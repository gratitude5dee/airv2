/**
 * V5 vault fill dispatch. The authenticated owner asks for one login field
 * (or the current TOTP code) to be typed into the focused input of the box's
 * headed browser. The control plane pre-checks the site grant against the
 * frontmost page and dispatches `air-vault type` — the CLI re-checks the
 * grant and delivers the value in-process over CDP. The response is the safe
 * receipt only; the value never transits this route (C19). Card-kind
 * fields additionally require the single-use fill ticket minted on a
 * purchase_review approval (V6, C20) — the CLI requires-and-burns it, so
 * without an owner approval the fill fails box-side and nothing is typed.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { VaultCliError, appendVaultEvent } from "@/lib/vault/client";
import { typeVaultField, typeVaultTotp } from "@/lib/vault/fill";
import { readSiteGrants } from "@/lib/browser/grants";
import { probeBrowser } from "@/lib/browser/probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const FIELD_RE = /^[a-z_][a-z0-9_]*$/;

// Card-kind fields only fill under a burned fill ticket (C20); the CLI is
// the enforcer — this set just shapes the request validation and receipts.
const CARD_FIELDS = new Set([
  "number",
  "cvv",
  "expiry_month",
  "expiry_year",
  "zip",
]);

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
  // login and card items are fillable. Card fields go to the CLI, which
  // requires-and-burns the owner-approved fill ticket (C20); a login item
  // never types card-named fields and vice versa.
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
  const cardFill = item.kind === "card" && !totp && CARD_FIELDS.has(field);
  const loginFill = item.kind === "login" && (totp || !CARD_FIELDS.has(field));
  if (!cardFill && !loginFill) {
    return NextResponse.json(
      {
        error: "invalid request",
        message: "that field cannot be typed for this item kind",
      },
      { status: 400 }
    );
  }
  if (cardFill) {
    // Receipt trail (§V6): the attempt is recorded before the CLI decides.
    await appendVaultEvent(supabase, userId, "fill_requested", itemId, field);
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
      // Card fills are host-bound by the fill ticket, not site_grants —
      // the CLI matches the frontmost page against the approved host.
      const granted =
        cardFill ||
        (grants[itemId] ?? []).some(
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
      const status = [
        "site_not_granted",
        "fill_ticket_required",
        "host_mismatch",
        "cvv_not_last",
        "field_not_allowed",
      ].includes(error.code)
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
