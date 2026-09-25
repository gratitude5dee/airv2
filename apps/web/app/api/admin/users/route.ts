/**
 * Operator user directory: id, username, status, and verified handle
 * addresses so the dashboard can label per-user rows with a human name
 * instead of a raw uuid. Identity metadata only — no message content,
 * prompts, or memory (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;

interface UserRow {
  user_id: string;
  username: string | null;
  status: string;
  created_at: string;
  handles: Array<{ platform: string; address: string }>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const supabase = serviceClient();

  const users = new Map<string, UserRow>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, status, created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = data ?? [];
    for (const row of rows) {
      users.set(row.id as string, {
        user_id: row.id as string,
        username: (row.username as string | null) ?? null,
        status: row.status as string,
        created_at: row.created_at as string,
        handles: [],
      });
    }
    if (rows.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("handles")
      .select("user_id, platform, address")
      .not("verified_at", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break; // directory still useful without handles
    const rows = data ?? [];
    for (const row of rows) {
      users
        .get(row.user_id as string)
        ?.handles.push({
          platform: row.platform as string,
          address: row.address as string,
        });
    }
    if (rows.length < PAGE) break;
  }

  return NextResponse.json({ users: [...users.values()] });
}
