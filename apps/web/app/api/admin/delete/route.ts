/**
 * M8 deletion: delete the Box (snapshots go with it), delete the AgentMail
 * pod (inboxes/threads/drafts go with it), revoke Composio connections and
 * the session, release the line back to inventory, then cascade-delete the
 * user row (every table references users(id) on delete cascade).
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
