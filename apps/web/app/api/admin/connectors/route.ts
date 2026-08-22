/**
 * Operator connector health: every `connections` row folded into per-toolkit
 * counts by status (pending/active/revoked/error) plus a platform-wide roll-up,
 * so the dashboard can see which integrations users actually connect and which
 * ones keep erroring. No account identifiers leave this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;
const STATUSES = ["pending", "active", "revoked", "error"] as const;
type Status = (typeof STATUSES)[number];

type StatusCounts = Record<Status, number>;

interface ToolkitRow extends StatusCounts {
  toolkit: string;
  total: number;
  users: number;
}

function zeroCounts(): StatusCounts {
  return { pending: 0, active: 0, revoked: 0, error: 0 };
}

function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const rowsAll: { user_id: unknown; toolkit: unknown; status: unknown }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("connections")
      .select("user_id, toolkit, status, provider")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const page = data ?? [];
    rowsAll.push(...page);
    if (page.length < PAGE) break;
  }

  const toolkits = new Map<string, { counts: StatusCounts; users: Set<string> }>();
  const totals = zeroCounts();
  let unknownStatus = 0;
  for (const row of rowsAll) {
    const toolkit = String(row.toolkit ?? "unknown");
    let entry = toolkits.get(toolkit);
    if (!entry) {
      entry = { counts: zeroCounts(), users: new Set<string>() };
      toolkits.set(toolkit, entry);
    }
    entry.users.add(String(row.user_id));
    const status = String(row.status ?? "");
    if (isStatus(status)) {
      entry.counts[status] += 1;
      totals[status] += 1;
    } else {
      unknownStatus += 1;
    }
  }

  const rows: ToolkitRow[] = [...toolkits.entries()].map(
    ([toolkit, entry]) => ({
      toolkit,
      ...entry.counts,
      total: STATUSES.reduce((sum, status) => sum + entry.counts[status], 0),
      users: entry.users.size,
    })
  );
  rows.sort((a, b) => b.total - a.total || a.toolkit.localeCompare(b.toolkit));

  return NextResponse.json({
    statuses: [...STATUSES],
    totals: { ...totals, unknown: unknownStatus },
    toolkits: rows,
  });
}
