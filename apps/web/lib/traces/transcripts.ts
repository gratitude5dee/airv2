/**
 * MA9.3 `include=transcripts` — the one place trace export crosses the C4
 * boundary on purpose: the OWNER's session transcripts, pulled from their own
 * box over the existing allowlisted Hermes session paths (api/sessions,
 * api/sessions/:id/messages), streamed straight into their download. The
 * bytes transit the response only — never Postgres, never a log line.
 */
import type { HermesBoxTarget } from "@/lib/hermes/client";
import { listSessions, sessionMessages } from "@/lib/hermes/client";
import type { TraceWindow } from "./receipts";

export interface TranscriptLine {
  kind: "transcript_message";
  session_id: string;
  session_title: string | null;
  role: string;
  content: string;
  ts: string | null;
}

const toIso = (epoch: number | null | undefined): string | null =>
  typeof epoch === "number"
    ? new Date(epoch > 1e12 ? epoch : epoch * 1000).toISOString()
    : null;

export async function* transcriptLines(
  target: HermesBoxTarget,
  window: TraceWindow = {}
): AsyncGenerator<TranscriptLine> {
  const sessions = await listSessions(target);
  for (const session of sessions) {
    const lastActive = toIso(session.last_active);
    const started = toIso(session.started_at);
    if (window.from && lastActive && lastActive < window.from) continue;
    if (window.to && started && started >= window.to) continue;
    const messages = await sessionMessages(target, session.id).catch(
      () => []
    );
    for (const message of messages) {
      const ts = toIso(message.created_at);
      if (window.from && ts && ts < window.from) continue;
      if (window.to && ts && ts >= window.to) continue;
      yield {
        kind: "transcript_message",
        session_id: session.id,
        session_title: session.title ?? null,
        role: message.role,
        content: message.content,
        ts,
      };
    }
  }
}
