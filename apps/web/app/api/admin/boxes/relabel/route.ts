/**
 * Backfill provider-side box names from usernames: every box whose owner
 * has a username is renamed `air-<username>` (the same label setUsername
 * applies), so boxes provisioned before the username was set, or whose
 * original rename failed, become navigable in the provider dashboard.
 * Best-effort per box: a rename failure is counted and logged, never fatal.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { renameBox } from "@/lib/box/client";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = 1000;

export interface RelabelReport {
  relabeled: number;
  /** Boxes whose owner has no username, or with no provider box id. */
  skipped: number;
  failed: number;
  failures: Array<{ provider_box_id: string; error: string }>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();

  const usernames = new Map<string, string>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .not("username", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      return NextResponse.json(
        { error: `user list failed: ${error.message}` },
        { status: 500 },
      );
    }
    const rows = data ?? [];
    for (const row of rows) {
      const username = row.username as string | null;
      if (username) usernames.set(row.id as string, username);
    }
    if (rows.length < PAGE) break;
  }

  const report: RelabelReport = {
    relabeled: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("boxes")
      .select("user_id, provider_box_id")
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      return NextResponse.json(
        { error: `box list failed: ${error.message}` },
        { status: 500 },
      );
    }
    const rows = data ?? [];
    for (const row of rows) {
      const providerBoxId = (row.provider_box_id as string | null) ?? null;
      const username = usernames.get(row.user_id as string);
      if (!providerBoxId || !username) {
        report.skipped += 1;
        continue;
      }
      try {
        await renameBox(providerBoxId, `air-${username}`);
        report.relabeled += 1;
      } catch (renameError) {
        const message =
          renameError instanceof Error
            ? renameError.message
            : String(renameError);
        report.failed += 1;
        report.failures.push({ provider_box_id: providerBoxId, error: message });
        console.error(
          JSON.stringify({
            msg: "box rename failed",
            user_id: row.user_id,
            box_id: providerBoxId,
            error: message,
          }),
        );
      }
    }
    if (rows.length < PAGE) break;
  }

  return NextResponse.json(report);
}
