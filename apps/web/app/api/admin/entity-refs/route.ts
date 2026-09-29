/**
 * Operator path for @entity refs (logos): seed or re-point a user's
 * registered name, list their refs, or remove one. The owner-facing path
 * is the "Create Brand Guide" onboarding panel (upload_logo action); this
 * route exists for pre-seeding and fixes.
 *
 * POST accepts either a multipart upload (image -> guarded ingest -> ref)
 * or JSON pointing at an existing creative_assets row. All asset lookups
 * are scoped to the named user — a foreign asset_id is a 400, not a leak.
 */
import { NextRequest, NextResponse } from "next/server";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";
import { parseBody } from "@/lib/http/body";
import {
  deleteEntityRef,
  entityRefViews,
  isEntityRefName,
  registerEntityRef,
  type EntityRefKind,
} from "@/lib/identity/entityRefs";
import { ingestUploadedMedia } from "@/lib/creative/store";
import { guardMediaUpload, MediaGuardError } from "@/lib/storage/guard";
import { serviceClient } from "@/lib/supabase";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JsonPost = z.object({
  user_id: z.string().uuid(),
  kind: z.literal("logo").default("logo"),
  name: z.string().min(1).max(64),
  label: z.string().max(120).optional(),
  asset_id: z.string().uuid(),
});

const JsonDelete = z.object({
  user_id: z.string().uuid(),
  kind: z.literal("logo").default("logo"),
  name: z.string().min(1).max(64),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = request.nextUrl.searchParams.get("user_id")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const refs = await entityRefViews(serviceClient(), userId);
  return NextResponse.json({ refs });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const supabase = serviceClient();

  const multipart = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .includes("multipart/form-data");
  const form = multipart ? await request.formData().catch(() => null) : null;

  let userId: string;
  let kind: EntityRefKind;
  let name: string;
  let label: string | null;
  let assetId: string;

  if (multipart) {
    if (!form) return NextResponse.json({ error: "invalid request" }, { status: 400 });
    userId = String(form.get("user_id") ?? "").trim();
    kind = "logo";
    name = String(form.get("name") ?? "").trim().toLowerCase();
    const rawLabel = String(form.get("label") ?? "").trim();
    label = rawLabel || null;
    const file = form.get("image") ?? form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "image file required" }, { status: 400 });
    }
    let bytes: Buffer;
    try {
      bytes = guardMediaUpload(
        Buffer.from(await file.arrayBuffer()),
        file.type || "application/octet-stream"
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof MediaGuardError ? error.message : "rejected" },
        { status: 422 }
      );
    }
    const asset = await ingestUploadedMedia(supabase, userId, bytes, file.type);
    assetId = asset.id;
  } else {
    const parsed = await parseBody(request, JsonPost);
    if (!parsed.ok) return parsed.response;
    userId = parsed.data.user_id;
    kind = parsed.data.kind;
    name = parsed.data.name.trim().toLowerCase();
    label = parsed.data.label?.trim() || null;
    assetId = parsed.data.asset_id;
  }

  if (!isEntityRefName(name)) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }
  // A same-named row is an operator 409: typos shouldn't silently re-point
  // a ref users may already be typing. The panel path upserts instead.
  const existing = await supabase
    .from("entity_refs")
    .select("name")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("name", name)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({ error: "name already registered" }, { status: 409 });
  }
  const result = await registerEntityRef(supabase, userId, {
    kind,
    name,
    assetId,
    label,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, name: result.name });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(request, JsonDelete);
  if (!parsed.ok) return parsed.response;
  const removed = await deleteEntityRef(
    serviceClient(),
    parsed.data.user_id,
    parsed.data.kind,
    parsed.data.name.trim().toLowerCase()
  );
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "delete failed" }, { status: 502 });
}
