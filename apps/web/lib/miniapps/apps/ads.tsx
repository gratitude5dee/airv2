/**
 * Ads mini-app (redesign Phase 3, spec §4): the owner-only registry surface
 * over the decision-gated ad_writes flow. Everything here only PROPOSES —
 * pause/resume forms file an ad_write + its Needs-You decision through
 * requestAdWrite; nothing executes from this surface. Spend-ceiling gating
 * stays server-side (approveAdWrite refuses past the ceiling); a zero
 * ceiling is surfaced up front because approvals would fail closed.
 */
import { NextResponse } from "next/server";
import { AdWriteError, requestAdWrite } from "@/lib/ads/approvals";
import { committedExposureCents, spendCeilingCents } from "@/lib/ads/spend";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

interface AdAccountRow {
  id: string;
  provider: string;
  account_ref: string;
  label: string | null;
  status: string;
}

interface AdCampaignRow {
  id: string;
  account_id: string;
  campaign_ref: string;
  name: string | null;
  daily_budget_cents: number;
  status: string;
}

interface AdWriteRow {
  id: string;
  kind: string;
  campaign_ref: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ceilingBanner(ceilingCents: number, committedCents: number): string {
  if (ceilingCents === 0) {
    return `<div class="card pending"><strong>Ad writes are blocked</strong><div class="muted">No spend ceiling is set, so approvals fail closed. Ask your operator to set one.</div></div>`;
  }
  return `<div class="card"><strong>Spend ceiling ${esc(usd(ceilingCents))}</strong> <span class="when">over 30 days</span><div class="muted">${esc(usd(committedCents))} committed. Every write is a proposal — approvals stay in Needs You.</div></div>`;
}

function campaignCard(campaign: AdCampaignRow): string {
  const paused = campaign.status !== "active";
  const propose = paused
    ? `<form method="post"><input type="hidden" name="action" value="propose_status"><input type="hidden" name="account" value="${esc(campaign.account_id)}"><input type="hidden" name="campaign" value="${esc(campaign.campaign_ref)}"><input type="hidden" name="status" value="active"><button>Propose resume</button></form>`
    : `<form method="post"><input type="hidden" name="action" value="propose_status"><input type="hidden" name="account" value="${esc(campaign.account_id)}"><input type="hidden" name="campaign" value="${esc(campaign.campaign_ref)}"><input type="hidden" name="status" value="paused"><button class="ghost">Propose pause</button></form>`;
  return `<div class="card"><strong>${esc(campaign.name ?? campaign.campaign_ref)}</strong> <span class="when">${esc(campaign.status)}</span><div class="muted">${esc(usd(campaign.daily_budget_cents))}/day</div>${propose}</div>`;
}

function writeCard(write: AdWriteRow): string {
  return `<div class="card"><strong>${esc(write.kind)}</strong> <span class="when">${esc(write.status)}</span>${write.campaign_ref ? `<div class="muted">${esc(write.campaign_ref)}</div>` : ""}${write.error ? `<div class="muted">${esc(write.error)}</div>` : ""}</div>`;
}

function renderAds(
  accounts: AdAccountRow[],
  campaigns: AdCampaignRow[],
  writes: AdWriteRow[],
  ceilingCents: number,
  committedCents: number,
  note: string | null,
  lite: boolean
): string {
  const accountList =
    accounts.length > 0
      ? accounts
          .map(
            (a) =>
              `<div class="item"><strong class="grow">${esc(a.label ?? a.account_ref)}</strong><span class="when">${esc(a.provider)} · ${esc(a.status)}</span></div>`
          )
          .join("")
      : `<p class="muted">No ad accounts connected yet — ask your agent to set one up.</p>`;
  const campaignList =
    campaigns.length > 0
      ? campaigns.map(campaignCard).join("")
      : `<p class="muted">No campaigns yet.</p>`;
  const writeList =
    writes.length > 0 ? writes.map(writeCard).join("") : "";
  const body = `<section class="panel">
${note ? `<div class="card">${esc(note)}</div>` : ""}
${ceilingBanner(ceilingCents, committedCents)}
<h2>Accounts</h2>${accountList}
<h2>Campaigns</h2>${campaignList}
${writeList ? `<h2>Recent proposals</h2>${writeList}` : ""}
${promptBar("Ask your agent — e.g. draft a campaign for my new drop…")}</section>`;
  return renderShell({ title: "Ads", kicker: "Campaigns", body, lite });
}

async function loadAndRender(
  ctx: MiniAppContext,
  note: string | null
): Promise<NextResponse> {
  const userId = ctx.session.userId;
  const [{ data: accounts }, { data: campaigns }, { data: writes }, ceiling, committed] =
    await Promise.all([
      ctx.supabase
        .from("ad_accounts")
        .select("id, provider, account_ref, label, status")
        .eq("user_id", userId),
      ctx.supabase
        .from("ad_campaigns")
        .select("id, account_id, campaign_ref, name, daily_budget_cents, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      ctx.supabase
        .from("ad_writes")
        .select("id, kind, campaign_ref, status, error, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      spendCeilingCents(ctx.supabase, userId),
      committedExposureCents(ctx.supabase, userId),
    ]);
  return shellHtml(
    renderAds(
      (accounts ?? []) as AdAccountRow[],
      (campaigns ?? []) as AdCampaignRow[],
      (writes ?? []) as AdWriteRow[],
      ceiling,
      committed,
      note,
      ctx.session.via === "card"
    )
  );
}

export const ads: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("owner only");
    }
    const note = ctx.request.nextUrl.searchParams.get("proposed")
      ? "Proposed — approve it in Needs You before anything changes."
      : null;
    return loadAndRender(ctx, note);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("owner only");
    }
    const action = String(form.get("action") ?? "");
    if (action === "prompt") {
      await runPrompt(ctx, String(form.get("text") ?? ""));
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
    }
    if (action === "propose_status") {
      const status = form.get("status") === "active" ? "active" : "paused";
      try {
        await requestAdWrite(ctx.supabase, ctx.session.userId, {
          accountId: String(form.get("account") ?? ""),
          kind: "set_status",
          campaignRef: String(form.get("campaign") ?? ""),
          status,
        });
      } catch (error) {
        if (error instanceof AdWriteError) {
          return loadAndRender(ctx, error.message);
        }
        throw error;
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(`${ctx.basePath}?proposed=1`, externalOrigin(ctx.request)),
          303
        )
      );
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },
};
