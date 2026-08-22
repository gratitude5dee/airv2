/**
 * Operator feedback inbox: the bug reports and feature requests owners submit
 * from the feedback mini-app (lib/miniapps/apps/feedback.tsx), newest first,
 * optionally filtered by status or kind.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["bug", "feature"] as const;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  if (kind && !(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json(
      { error: "kind must be bug or feature" },
      { status: 400 }
    );
  }
  const status = params.get("status");
  if (status && !/^[a-z_]{1,32}$/.test(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const limitParam = params.get("limit");
  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be an integer 1-${MAX_LIMIT}` },
      { status: 400 }
    );
  }

  const supabase = serviceClient();
  let query = supabase
    .from("feedback_items")
    .select("id, user_id, kind, title, body, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (kind) query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ items: [], counts: {}, unavailable: true });
  }

  const items = data ?? [];
  const counts: Record<string, number> = {};
  for (const row of items) {
    const key = String(row.status ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return NextResponse.json({ counts, items });
}
