/**
 * M8/CM8 deletion: pause live ad campaigns and cancel unfired slots at the
 * platforms first (deleting rows alone would leave live spend), delete the
 * Box (snapshots go with it), delete the AgentMail pod (inboxes/threads/
 * drafts go with it), revoke Composio connections and the session, remove
 * every stored asset object, release the line back to inventory, then
 * cascade-delete the user row (every table — slots, assets, campaigns,
 * connections, decisions, moments — references users(id) on delete cascade).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { deleteBox, stop } from "@/lib/box/client";
import { deletePod } from "@/lib/mail/client";
import { daytonaConfigured, deleteTenantKey } from "@/lib/daytona/client";
import {
  deleteConnectedAccount,
  deleteSession,
  listConnectedAccounts,
} from "@/lib/composio/client";
import { ASSETS_BUCKET, userPrefix } from "@/lib/assets/keys";
import { deletePrefix, r2Configured } from "@/lib/storage/r2";
import { appOriginLaneReady, teardownAppOrigin } from "@/lib/functions/deploy";
import { openAdsKey, updateCampaign } from "@/lib/ads/openai";
import {
  V9_SET_NULL_TABLES,
  V9_USER_TABLES,
  WAVE_TABLES,
  WAVE_TABLES_WITHOUT_USER_ID,
} from "@/lib/security/c18";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
  };
  const userId = body.user_id;
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, composio_session_id")
    .eq("id", userId)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const steps: Record<string, string> = {};

  // V11 CR16: a deleted publisher must never keep a serving origin, so the
  // app origins (live + draft Workers, KV pointer) go before anything else
  // is touched. Teardown is idempotent; if any app's origin cannot be torn
  // down the whole deletion aborts here, with nothing destroyed yet, and the
  // operator retries once the vendor is back.
  const { data: ownedApps, error: ownedAppsError } = await supabase
    .from("mini_apps")
    .select("id, slug")
    .eq("owner_user_id", userId);
  if (ownedAppsError) {
    steps["app_origin"] = `error: owned-app lookup failed; nothing deleted`;
    return NextResponse.json({ ok: false, steps, retry: true }, { status: 502 });
  }
  const ownedSlugs = (ownedApps ?? []).map((app) => app.slug as string);
  const ownedIds = (ownedApps ?? []).map((app) => app.id as string);
  if (ownedSlugs.length > 0 && !appOriginLaneReady()) {
    // Missing credentials say nothing about what was deployed earlier: the
    // ledger does. Any version with a Worker digest means an origin may
    // still serve, and only a configured lane can take it down.
    const { data: deployedRows, error: deployedError } = await supabase
      .from("miniapp_versions")
      .select("id")
      .in("app_id", ownedIds)
      .not("worker_sha256", "is", null)
      .limit(1);
    if (deployedError) {
      steps["app_origin"] = `error: deployed-version lookup failed; nothing deleted`;
      return NextResponse.json({ ok: false, steps, retry: true }, { status: 502 });
    }
    if ((deployedRows ?? []).length > 0) {
      steps["app_origin"] =
        "error: app origin lane not configured but deployed versions exist; nothing deleted";
      return NextResponse.json({ ok: false, steps, retry: true }, { status: 503 });
    }
  }
  if (ownedSlugs.length > 0 && appOriginLaneReady()) {
    const failed: string[] = [];
    for (const slug of ownedSlugs) {
      try {
        await teardownAppOrigin(slug);
      } catch {
        failed.push(slug);
      }
    }
    if (failed.length > 0) {
      steps["app_origin"] = `error: ${failed.length} of ${ownedSlugs.length} app(s) still serving; nothing deleted`;
      return NextResponse.json({ ok: false, steps, retry: true }, { status: 502 });
    }
    steps["app_origin"] = `tore down ${ownedSlugs.length} app(s)`;
  } else {
    steps["app_origin"] =
      ownedSlugs.length > 0 ? "lane not configured; no deployed versions" : "none";
  }

  // CM8: neutralize live state before rows disappear. Unfired slots are
  // cancelled so a sweep racing this deletion cannot publish; active
  // campaigns are paused at the platform so no orphaned spend survives the
  // row cascade.
  await supabase
    .from("content_slots")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .in("status", ["proposed", "scheduled", "parked"]);
  steps["slots"] = "cancelled";

  try {
    const { data: activeCampaigns } = await supabase
      .from("ad_campaigns")
      .select("id, account_id, campaign_ref")
      .eq("user_id", userId)
      .eq("status", "active");
    let pausedCount = 0;
    const failures: string[] = [];
    // One guard per campaign: a single failing pause must not leave the
    // rest of the user's campaigns spending after the row cascade.
    for (const campaign of activeCampaigns ?? []) {
      try {
        const { data: account } = await supabase
          .from("ad_accounts")
          .select("provider, api_key_sealed")
          .eq("id", campaign.account_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (account?.provider === "openai" && account.api_key_sealed) {
          const apiKey = openAdsKey(account.api_key_sealed as string);
          await updateCampaign(apiKey, campaign.campaign_ref as string, {
            status: "paused",
          });
          pausedCount += 1;
        }
        await supabase
          .from("ad_campaigns")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", campaign.id);
      } catch (error) {
        failures.push(
          `${campaign.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    steps["campaigns"] =
      `paused ${pausedCount} of ${(activeCampaigns ?? []).length}` +
      (failures.length > 0 ? `; failed: ${failures.join(", ")}` : "");
  } catch (error) {
    steps["campaigns"] = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // V7 bots: profiles live inside the box (deleted below) and bots/rooms
  // rows reference users(id) on delete cascade — record the count so the
  // checklist shows what the cascade is about to reap.
  const { count: botCount } = await supabase
    .from("bots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  steps["bots"] = `cascading ${botCount ?? 0}`;

  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (box?.provider_box_id) {
    try {
      // The provider soft-deletes running boxes; stop (archive) first so the
      // delete actually releases compute.
      try {
        await stop(box.provider_box_id as string);
      } catch {
        // already stopped/archived
      }
      await deleteBox(box.provider_box_id as string);
      steps["box"] = "deleted";
    } catch (error) {
      steps["box"] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    steps["box"] = "none";
  }

  // P1-11: revoke the user's Daytona child key — it dies with the account.
  if (daytonaConfigured()) {
    try {
      await deleteTenantKey(userId);
      steps["daytona_key"] = "revoked";
    } catch (error) {
      steps["daytona_key"] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    steps["daytona_key"] = "not configured";
  }

  // V8: cal.com webhook "deregistration" — registration is owner-side at
  // cal.com (the control plane only mints the sealed verification secret;
  // there is no API-side registration to delete). Mark the accounts revoked
  // before the cascade so a webhook racing this deletion fails verification
  // the moment the sealed secret rows disappear.
  const { count: calcomAccounts } = await supabase
    .from("calendar_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "calcom");
  if ((calcomAccounts ?? 0) > 0) {
    await supabase
      .from("calendar_accounts")
      .update({ status: "revoked" })
      .eq("user_id", userId)
      .eq("provider", "calcom");
    steps["calcom_webhook"] = `${calcomAccounts} account(s) revoked; sealed secret dies with the cascade — remove the webhook in the cal.com dashboard (owner-registered; no API-side registration exists)`;
  } else {
    steps["calcom_webhook"] = "none";
  }

  const { data: address } = await supabase
    .from("agent_addresses")
    .select("agentmail_pod_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (address?.agentmail_pod_id) {
    try {
      await deletePod(address.agentmail_pod_id as string);
      steps["agentmail_pod"] = "deleted";
    } catch (error) {
      steps["agentmail_pod"] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    steps["agentmail_pod"] = "none";
  }

  try {
    const accounts = await listConnectedAccounts(userId);
    for (const account of accounts) {
      await deleteConnectedAccount(account.id);
    }
    if (user.composio_session_id) {
      await deleteSession(user.composio_session_id as string);
    }
    steps["composio"] = `revoked ${accounts.length}`;
  } catch (error) {
    steps["composio"] = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // CM2: remove every stored asset object under the user's prefix (masters
  // and delivery derivatives) — added in the same PR as the bucket.
  try {
    let removed = 0;
    for (const folder of ["masters", "deliveries"]) {
      const prefix = `${userPrefix(userId)}${folder}`;
      // Bounded: remove() can silently skip paths, so break on any page
      // that makes no progress rather than re-listing forever.
      for (let page = 0; page < 100; page += 1) {
        const { data: objects, error } = await supabase.storage
          .from(ASSETS_BUCKET)
          .list(prefix, { limit: 100 });
        if (error || !objects || objects.length === 0) break;
        const removal = await supabase.storage
          .from(ASSETS_BUCKET)
          .remove(objects.map((object) => `${prefix}/${object.name}`));
        if (removal.error || !removal.data || removal.data.length === 0) break;
        removed += removal.data.length;
      }
    }
    steps["assets"] = `removed ${removed}`;
  } catch (error) {
    steps["assets"] = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // MA11: published bundles live at apps/<slug>/<version>/ on R2, outside
  // the user's u/<username>/ prefix — delete each owned app's bundle tree
  // before the mini_apps rows cascade away (the slugs are the only pointer).
  try {
    if (ownedSlugs.length > 0 && r2Configured()) {
      let removed = 0;
      for (const slug of ownedSlugs) {
        removed += await deletePrefix(`apps/${slug}/`);
      }
      steps["bundles"] = `removed ${removed} object(s) across ${ownedSlugs.length} app(s)`;
    } else {
      steps["bundles"] = ownedSlugs.length > 0 ? "r2 not configured" : "none";
    }
  } catch (error) {
    steps["bundles"] = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // MA8: the Stripe Connect Standard account belongs to the merchant — the
  // platform never custodies funds and never deletes their account; the
  // merchants row (the only link) cascades with the user row below.
  const { count: merchantCount } = await supabase
    .from("merchants")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  steps["merchant"] =
    (merchantCount ?? 0) > 0
      ? "link row cascades; the Connect account stays with the merchant"
      : "none";

  // MA4: delete every public media object under the user's R2 prefix
  // (u/<username>/ — includes media/, apps/, and mini-app icon uploads).
  try {
    const { data: bucket } = await supabase
      .from("user_buckets")
      .select("prefix")
      .eq("user_id", userId)
      .maybeSingle();
    if (bucket && r2Configured()) {
      const removed = await deletePrefix(bucket.prefix as string);
      steps["public_media"] = `removed ${removed}`;
    } else {
      steps["public_media"] = bucket ? "r2 not configured" : "none";
    }
  } catch (error) {
    steps["public_media"] = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  await supabase
    .from("lines")
    .update({ assigned_user_id: null, assigned_at: null })
    .eq("assigned_user_id", userId);
  steps["line"] = "released";

  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);
  steps["user"] = deleteError ? `error: ${deleteError.message}` : "deleted";

  // V8 hardening item 3 — deletion completeness audit: after the cascade,
  // every wave table must hold zero rows for the user (room_members has no
  // user_id; it is reaped through rooms(id)/bots(id) cascades verified by
  // the migration test in lib/admin/deletion.test.ts).
  if (!deleteError) {
    const orphaned: string[] = [];
    for (const table of WAVE_TABLES) {
      if ((WAVE_TABLES_WITHOUT_USER_ID as readonly string[]).includes(table)) {
        continue;
      }
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) > 0) orphaned.push(`${table}:${count}`);
    }
    steps["table_audit"] =
      orphaned.length === 0
        ? "zero rows in every wave table"
        : `ORPHANED ${orphaned.join(", ")}`;

    // MA11 — V9 completeness: every mini-app table keyed to the user must
    // be empty after the cascade; set-null tables must hold no rows still
    // pointing at the deleted user.
    const v9Orphaned: string[] = [];
    for (const { table, column } of V9_USER_TABLES) {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, userId);
      if ((count ?? 0) > 0) v9Orphaned.push(`${table}:${count}`);
    }
    for (const { table, column } of V9_SET_NULL_TABLES) {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, userId);
      if ((count ?? 0) > 0) v9Orphaned.push(`${table}:${count} (expected set null)`);
    }
    steps["v9_table_audit"] =
      v9Orphaned.length === 0
        ? "zero rows in every v9 table"
        : `ORPHANED ${v9Orphaned.join(", ")}`;
  }

  console.log(
    JSON.stringify({ msg: "user deleted", user_id: userId, steps })
  );
  return NextResponse.json({ ok: !deleteError, steps });
}
