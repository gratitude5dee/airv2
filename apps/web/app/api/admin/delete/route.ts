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
import { deletePod } from "@/lib/agentmail/client";
import {
  deleteConnectedAccount,
  deleteSession,
  listConnectedAccounts,
} from "@/lib/composio/client";
import { ASSETS_BUCKET, userPrefix } from "@/lib/assets/keys";
import { openAdsKey, updateCampaign } from "@/lib/ads/openai";

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

  // CM8: neutralize live state before rows disappear. Unfired slots are
  // cancelled so a sweep racing this deletion cannot publish; active
  // campaigns are paused at the platform so no orphaned spend survives the
  // row cascade.
  await supabase
    .from("content_slots")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .in("status", ["proposed", "scheduled", "parked"]);
  steps.slots = "cancelled";

  {
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
    steps.campaigns =
      `paused ${pausedCount} of ${(activeCampaigns ?? []).length}` +
      (failures.length > 0 ? `; failed: ${failures.join(", ")}` : "");
  }

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
      steps.box = "deleted";
    } catch (error) {
      steps.box = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    steps.box = "none";
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
      steps.agentmail_pod = "deleted";
    } catch (error) {
      steps.agentmail_pod = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    steps.agentmail_pod = "none";
  }

  try {
    const accounts = await listConnectedAccounts(userId);
    for (const account of accounts) {
      await deleteConnectedAccount(account.id);
    }
    if (user.composio_session_id) {
      await deleteSession(user.composio_session_id as string);
    }
    steps.composio = `revoked ${accounts.length}`;
  } catch (error) {
    steps.composio = `error: ${error instanceof Error ? error.message : String(error)}`;
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
    steps.assets = `removed ${removed}`;
  } catch (error) {
    steps.assets = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  await supabase
    .from("lines")
    .update({ assigned_user_id: null, assigned_at: null })
    .eq("assigned_user_id", userId);
  steps.line = "released";

  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);
  steps.user = deleteError ? `error: ${deleteError.message}` : "deleted";

  console.log(
    JSON.stringify({ msg: "user deleted", user_id: userId, steps })
  );
  return NextResponse.json({ ok: !deleteError, steps });
}
