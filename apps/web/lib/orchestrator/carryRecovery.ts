import type { SupabaseClient } from "@supabase/supabase-js";

const ORPHAN_AGE_MS = 60_000;
const SWEEP_OVERDUE_MS = 31_000;
const MAX_CARRIED_ROWS = 250;

interface CarriedRow {
  user_id: string;
  space_id: string;
  sender_id: string | null;
  received_at: string;
}

interface DestinationRow {
  user_id: string;
  space_id: string;
  phone: string;
}

interface LineRow {
  assigned_user_id: string;
  phone: string;
  mode: "dedicated" | "shared";
}

interface SenderRow {
  address: string;
  trust_tier: number;
}

/**
 * Restore the durable scheduling half of the carried-message invariant.
 *
 * A cancelled or failed chain first moves its already-drained input to
 * carried_messages, then reschedules flush_jobs. A process death or a racing
 * direct-completion cleanup can land between those writes, preserving the
 * user's input but leaving no job to consume it. The cron sweep calls this
 * before claiming overdue work so an old orphan is re-armed in the same tick.
 *
 * Message bodies are deliberately neither selected nor logged. Exact
 * per-space destinations win; the user's one configured line is a fallback.
 * Ambiguous destinations stay untouched for operator recovery.
 */
export async function recoverOrphanedCarriedJobs(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ restored: number; unresolved: number }> {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS).toISOString();
  const { data: carriedData, error: carriedError } = await supabase
    .from("carried_messages")
    .select("user_id, space_id, sender_id, received_at")
    .lt("received_at", cutoff)
    .order("received_at", { ascending: true })
    .limit(MAX_CARRIED_ROWS);
  if (carriedError) {
    throw new Error(`carried recovery read failed: ${carriedError.message}`);
  }

  const carried = (carriedData ?? []) as CarriedRow[];
  const bySpace = new Map<string, CarriedRow[]>();
  for (const row of carried) {
    const rows = bySpace.get(row.space_id) ?? [];
    rows.push(row);
    bySpace.set(row.space_id, rows);
  }
  const spaceIds = [...bySpace.keys()];
  if (spaceIds.length === 0) return { restored: 0, unresolved: 0 };

  const { data: liveData, error: liveError } = await supabase
    .from("flush_jobs")
    .select("space_id")
    .in("space_id", spaceIds);
  if (liveError) {
    throw new Error(`carried recovery job read failed: ${liveError.message}`);
  }
  const liveSpaces = new Set(
    ((liveData ?? []) as { space_id: string }[]).map((row) => row.space_id),
  );
  const orphanSpaces = spaceIds.filter((spaceId) => !liveSpaces.has(spaceId));
  if (orphanSpaces.length === 0) return { restored: 0, unresolved: 0 };

  const orphanRows = orphanSpaces.flatMap((spaceId) => bySpace.get(spaceId) ?? []);
  const userIds = [...new Set(orphanRows.map((row) => row.user_id))];
  const senderIds = [
    ...new Set(
      orphanRows
        .map((row) => row.sender_id)
        .filter((senderId): senderId is string => Boolean(senderId)),
    ),
  ];

  const [destinationsResult, linesResult, sendersResult] = await Promise.all([
    supabase
      .from("imessage_destinations")
      .select("user_id, space_id, phone")
      .in("user_id", userIds),
    supabase
      .from("lines")
      .select("assigned_user_id, phone, mode")
      .in("assigned_user_id", userIds),
    senderIds.length > 0
      ? supabase
          .from("senders")
          .select("address, trust_tier")
          .in("address", senderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [label, result] of [
    ["destinations", destinationsResult],
    ["lines", linesResult],
    ["senders", sendersResult],
  ] as const) {
    if (result.error) {
      throw new Error(`carried recovery ${label} read failed: ${result.error.message}`);
    }
  }

  const destinations = (destinationsResult.data ?? []) as DestinationRow[];
  const lines = (linesResult.data ?? []) as LineRow[];
  const senderTiers = new Map(
    ((sendersResult.data ?? []) as SenderRow[]).map((row) => [
      row.address,
      row.trust_tier,
    ]),
  );
  const linesByUser = new Map<string, LineRow[]>();
  for (const line of lines) {
    const rows = linesByUser.get(line.assigned_user_id) ?? [];
    rows.push(line);
    linesByUser.set(line.assigned_user_id, rows);
  }

  const runAt = new Date(now.getTime() - SWEEP_OVERDUE_MS).toISOString();
  const inserts: Record<string, unknown>[] = [];
  let unresolved = 0;
  for (const spaceId of orphanSpaces) {
    const rows = bySpace.get(spaceId) ?? [];
    const userId = rows[0]?.user_id;
    if (!userId) {
      unresolved += 1;
      continue;
    }
    const destination = destinations.find(
      (row) => row.user_id === userId && row.space_id === spaceId,
    );
    const userLines = linesByUser.get(userId) ?? [];
    const line = userLines.length === 1 ? userLines[0] : undefined;
    const phone = destination?.phone ??
      (line ? (line.mode === "shared" ? "shared" : line.phone) : undefined);
    if (!phone) {
      unresolved += 1;
      continue;
    }

    const rowSenderIds = [
      ...new Set(
        rows
          .map((row) => row.sender_id)
          .filter((senderId): senderId is string => Boolean(senderId)),
      ),
    ];
    const rowTiers = rowSenderIds.map((senderId) => senderTiers.get(senderId));
    const senderTier =
      rowSenderIds.length > 0 && rowTiers.every((tier) => tier !== undefined)
        ? Math.max(...(rowTiers as number[]))
        : null;
    inserts.push({
      space_id: spaceId,
      user_id: userId,
      phone,
      run_at: runAt,
      chain_started_at: null,
      cancelled_at: null,
      hermes_run_id: null,
      attempts: 0,
      sender_tier: senderTier,
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase
      .from("flush_jobs")
      .upsert(inserts, { onConflict: "space_id", ignoreDuplicates: true });
    if (error) {
      throw new Error(`carried recovery job restore failed: ${error.message}`);
    }
  }
  if (inserts.length > 0 || unresolved > 0) {
    console.info(
      JSON.stringify({
        msg: "orphaned carried jobs reconciled",
        restored: inserts.length,
        unresolved,
      }),
    );
  }
  return { restored: inserts.length, unresolved };
}
