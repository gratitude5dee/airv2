/**
 * Web chat (M6): create a Hermes run on the user's own box. The box target
 * (hosted_url/_token/API_SERVER_KEY) stays server-side; the browser only
 * ever sees the run id (C3).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { CHAT_SESSION_RE, startChatRun } from "@/lib/chat/relay";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "@/lib/creative/parse";
import { createCreativeJob } from "@/lib/creative/jobs";
import { executeCreativeJob } from "@/lib/creative/run";
import { parseMention } from "@/lib/bots/mentions";
import { listBots, toPublic, type BotRow } from "@/lib/bots/store";
import { startBotChatRun } from "@/lib/bots/chat";
import { attachmentMarker } from "@/lib/chat/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Creative work runs via after() inside this invocation's budget, which must
// exceed the 420s generation budget plus a possible resume (like the
// iMessage webhook's 800).
export const maxDuration = 800;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    via?: string;
    attachments?: unknown;
    session?: unknown;
  };
  // Threads (spec §3): an optional Hermes session id. Omitted means the
  // shared air-main conversation — the pre-threads wire shape is unchanged.
  let session: string | undefined;
  if (body.session !== undefined) {
    if (typeof body.session !== "string" || !CHAT_SESSION_RE.test(body.session)) {
      return NextResponse.json({ error: "bad session" }, { status: 400 });
    }
    session = body.session;
  }
  const typed = (body.input ?? "").trim();
  // V8: uploads referenced by box path (from /api/chat/upload), the same
  // marker shape the iMessage path emits — never raw bytes (C4). The path
  // must match exactly what the upload route mints.
  const attachments = Array.isArray(body.attachments)
    ? (body.attachments as { path?: unknown; mime?: unknown }[]).slice(0, 5)
    : [];
  const markers: string[] = [];
  for (const attachment of attachments) {
    if (
      typeof attachment.path !== "string" ||
      !/^\.hermes\/inbox\/\d+-[A-Za-z0-9._-]+$/.test(attachment.path)
    ) {
      return NextResponse.json({ error: "bad attachment" }, { status: 400 });
    }
    const mime =
      typeof attachment.mime === "string" &&
      /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(attachment.mime)
        ? attachment.mime
        : "application/octet-stream";
    markers.push(attachmentMarker(mime, attachment.path));
  }
  if (!typed && markers.length === 0) {
    return NextResponse.json({ error: "empty input" }, { status: 400 });
  }
  const trigger = body.via === "voice" ? "voice" : "web";
  const supabase = serviceClient();

  // M16: an explicit /imagine, /animate, or /zap short-circuits before the
  // Hermes run. Parsed against the user's typed text only — the attachment
  // markers are internal bookkeeping, not part of a creative prompt (and the
  // web lane stages no media inputs, so the combination is refused outright).
  const command = parseExplicitGenerationCommand(typed);
  if (command) {
    if ("ambiguous" in command) {
      // Deterministic rejection — no model or provider call happens.
      return NextResponse.json({ creative_line: AMBIGUOUS_COMMAND_LINE });
    }
    if (markers.length > 0) {
      return NextResponse.json({
        creative_line:
          "Attached files can't be used with /imagine, /animate, or /zap yet — send the command on its own and describe what you want.",
      });
    }
    try {
      const job = await createCreativeJob(supabase, userId, "web", command.mode);
      after(async () => {
        await executeCreativeJob(supabase, job.id, userId, {
          mode: command.mode,
          cleanedText: command.cleanedText,
          text: typed,
          mediaInputs: [],
        }).catch((error: unknown) => {
          console.error(
            JSON.stringify({
              msg: "creative job execution failed",
              user_id: userId,
              job_id: job.id,
              error: error instanceof Error ? error.message : String(error),
            })
          );
        });
      });
      return NextResponse.json({ creative_job_id: job.id, mode: command.mode });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "creative job start failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return NextResponse.json({ error: "run failed" }, { status: 500 });
    }
  }

  // Ordinary chat: the Hermes input is the typed text plus the attachment
  // path markers (references only, never bytes — C4).
  const input = [typed, ...markers].filter(Boolean).join("\n");

  // V7: an @mention validated against the caller's roster delegates the
  // turn to that bot's canonical chat; unknown @words are ordinary text.
  // A roster read failure degrades to the default agent (like the iMessage
  // path); only errors starting the delegated run itself surface.
  let delegate: BotRow | null = null;
  let delegateInput = input;
  try {
    const roster = await listBots(supabase, userId);
    const hit = parseMention(
      input,
      roster.filter((b) => b.status === "ready").map((b) => b.name)
    );
    if (hit) {
      const bot = roster.find((b) => b.name === hit.bot);
      if (bot && bot.status === "ready") {
        delegate = bot;
        delegateInput = hit.input;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "bot delegation skipped", user_id: userId, error: message })
    );
  }
  if (delegate) {
    try {
      const runId = await startBotChatRun(
        supabase,
        userId,
        delegate,
        delegateInput,
        "web"
      );
      return NextResponse.json({ run_id: runId, bot: toPublic(delegate) });
    } catch (error) {
      if (error instanceof StartLimitError) {
        return NextResponse.json({ error: "busy" }, { status: 429 });
      }
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(
        JSON.stringify({ msg: "bot delegation failed", user_id: userId, error: message })
      );
      return NextResponse.json({ error: "run failed" }, { status: 500 });
    }
  }

  try {
    const runId = await startChatRun(
      supabase,
      userId,
      input,
      "web",
      trigger,
      session
    );
    return NextResponse.json({ run_id: runId });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "web chat run failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
