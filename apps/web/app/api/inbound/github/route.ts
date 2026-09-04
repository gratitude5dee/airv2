/**
 * GitHub App webhook → verify `X-Hub-Signature-256` over the raw body
 * (before any DB write) → dedupe by `X-GitHub-Delivery` → dispatch → 200.
 * Same discipline as every other inbound webhook (goal.md §MA2.3): a bad
 * signature rejects before any write, a redelivery of a processed event
 * acknowledges without reprocessing. The delivery id is held as a lease
 * while its handler runs and marked final only when it succeeds, so a
 * failed attempt — even one whose release never landed — is run again by
 * the redelivery rather than acknowledged forever.
 *
 * Events that matter:
 *   installation               deleted / suspend / unsuspend → installation row
 *   installation_repositories  removed → the links those repositories fed
 *   push                       to a linked branch of a `static` link → stage
 *                              a draft from the new head (build links stage
 *                              through their own Actions run instead)
 * Everything else is acknowledged and ignored. A sync failure is recorded on
 * the link (`last_error`) and still answers 200 — GitHub does not retry
 * webhooks, and the next push is the retry.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { githubAppConfigured, verifyWebhookSignature } from "@/lib/github/app";
import {
  linksForRepo,
  markInstallation,
  pushTargets,
  syncStaticLink,
  type PushEvent,
} from "@/lib/create/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELIVERY_ID_RE = /^[A-Za-z0-9-]{1,128}$/;

const installationEvent = z.object({
  action: z.string(),
  installation: z.object({ id: z.number().int() }),
});
type InstallationEvent = z.infer<typeof installationEvent>;

const installationRepositoriesEvent = z.object({
  action: z.string(),
  installation: z.object({ id: z.number().int() }),
  repositories_removed: z.array(z.object({ id: z.number().int() })).optional(),
});
type InstallationRepositoriesEvent = z.infer<typeof installationRepositoriesEvent>;

const pushEvent = z.object({
  ref: z.string(),
  after: z.string().regex(/^[0-9a-f]{40}$/),
  deleted: z.boolean().optional(),
  repository: z.object({ id: z.number().int(), full_name: z.string() }),
  installation: z.object({ id: z.number().int() }).optional(),
});

/**
 * How long one processing attempt may hold a delivery before a redelivery
 * is allowed to take it over. A push sync (zipball → R2) finishes well
 * inside this; a handler that died without releasing does not hold the id
 * forever.
 */
const DELIVERY_LEASE_SECONDS = 15 * 60;

/**
 * Claim the delivery id for this attempt (RPC `github_delivery_claim`,
 * migration 0091). False when the delivery was already processed, or is
 * being processed right now under a live lease. A delivery whose earlier
 * attempt failed — and whose release never landed — comes back true once
 * that lease has expired, so no failure mode turns into a permanent
 * "duplicate" for an event that never ran.
 */
async function claimDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  event: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("github_delivery_claim", {
    p_delivery_id: deliveryId,
    p_event: event,
    p_lease_seconds: DELIVERY_LEASE_SECONDS,
  });
  if (error) throw new Error(`delivery claim failed: ${error.message}`);
  return data === true;
}

/**
 * Mark the delivery final: from here a redelivery is a duplicate for good.
 * Only the successful dispatch path reaches this, so a row without
 * `processed_at` is by definition an attempt that did not finish.
 */
async function completeDelivery(supabase: SupabaseClient, deliveryId: string): Promise<void> {
  const { error } = await supabase
    .from("github_deliveries")
    .update({ processed_at: new Date().toISOString() })
    .eq("delivery_id", deliveryId);
  if (error) {
    // The lease still expires; the worst case is one re-run of an
    // idempotent handler after DELIVERY_LEASE_SECONDS.
    console.error(
      JSON.stringify({ msg: "github delivery complete failed", delivery: deliveryId, error: error.message })
    );
  }
}

/**
 * Give a delivery back when its handler threw, so a redelivery runs it again
 * right away. Best effort: if this delete fails too, the row is left as an
 * unfinished attempt and the lease expiry hands it to the next redelivery.
 */
async function releaseDelivery(supabase: SupabaseClient, deliveryId: string): Promise<void> {
  const { error } = await supabase
    .from("github_deliveries")
    .delete()
    .eq("delivery_id", deliveryId);
  if (error) {
    console.error(
      JSON.stringify({ msg: "github delivery release failed", delivery: deliveryId, error: error.message })
    );
  }
}

async function onInstallation(supabase: SupabaseClient, body: InstallationEvent): Promise<void> {
  const id = body.installation.id;
  switch (body.action) {
    case "deleted":
      await markInstallation(supabase, id, { removed_at: new Date().toISOString() });
      return;
    case "suspend":
      await markInstallation(supabase, id, { suspended_at: new Date().toISOString() });
      return;
    case "unsuspend":
      await markInstallation(supabase, id, { suspended_at: null });
      return;
    default:
      return;
  }
}

async function onInstallationRepositories(
  supabase: SupabaseClient,
  body: InstallationRepositoriesEvent
): Promise<void> {
  const removed = (body.repositories_removed ?? []).map((repo) => repo.id);
  if (removed.length === 0) return;
  const { error } = await supabase
    .from("github_repo_links")
    .delete()
    .eq("installation_id", body.installation.id)
    .in("repo_id", removed);
  if (error) throw new Error(`link removal failed: ${error.message}`);
}

async function onPush(
  supabase: SupabaseClient,
  body: PushEvent
): Promise<{ synced: string[]; failed: string[] }> {
  const links = await linksForRepo(supabase, body.repository.id);
  const synced: string[] = [];
  const failed: string[] = [];
  for (const link of pushTargets(links, body)) {
    try {
      const result = await syncStaticLink(supabase, link, body.after);
      synced.push(result.slug);
    } catch (error) {
      failed.push(link.id);
      console.error(
        JSON.stringify({
          msg: "github push sync failed",
          link: link.id,
          repo: body.repository.full_name,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  }
  return { synced, failed };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!githubAppConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  const event = request.headers.get("x-github-event") ?? "";
  if (!DELIVERY_ID_RE.test(deliveryId) || !event) {
    return NextResponse.json({ error: "missing delivery headers" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = serviceClient();
  if (!(await claimDelivery(supabase, deliveryId, event))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  let response: NextResponse;
  try {
    response = await dispatch(supabase, event, body);
  } catch (error) {
    await releaseDelivery(supabase, deliveryId);
    throw error;
  }
  await completeDelivery(supabase, deliveryId);
  return response;
}

async function dispatch(
  supabase: SupabaseClient,
  event: string,
  body: object
): Promise<NextResponse> {
  switch (event) {
    case "installation": {
      const parsed = installationEvent.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "malformed event" }, { status: 400 });
      await onInstallation(supabase, parsed.data);
      return NextResponse.json({ ok: true });
    }
    case "installation_repositories": {
      const parsed = installationRepositoriesEvent.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "malformed event" }, { status: 400 });
      await onInstallationRepositories(supabase, parsed.data);
      return NextResponse.json({ ok: true });
    }
    case "push": {
      const parsed = pushEvent.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "malformed event" }, { status: 400 });
      const result = await onPush(supabase, parsed.data);
      return NextResponse.json({ ok: true, ...result });
    }
    default:
      return NextResponse.json({ ok: true, ignored: event });
  }
}
