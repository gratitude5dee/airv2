/**
 * Web chat (M6): create a Hermes run on the user's own box. The box target
 * (hosted_url/_token/API_SERVER_KEY) stays server-side; the browser only
 * ever sees the run id (C3).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { migrationBusyResponse } from "@/lib/migration/admission";
import { CHAT_SESSION_RE, isCreateSession, startChatRun } from "@/lib/chat/relay";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "@/lib/creative/parse";
import { createCreativeJob, updateCreativeJob } from "@/lib/creative/jobs";
import { executeCreativeJob } from "@/lib/creative/run";
import { attachIdentityReferences } from "@/lib/identity/resolve";
import { recordReferenceUses } from "@/lib/identity/twin";
import {
  parseTwinCommand,
  runTwinCommand,
  TWIN_HELP_LINE,
  twinBuilderLink,
  twinStatusLine,
} from "@/lib/identity/twinCommand";
import { parseMention } from "@/lib/bots/mentions";
import { listBots, toPublic, type BotRow } from "@/lib/bots/store";
import { startBotChatRun } from "@/lib/bots/chat";
import { attachmentMarker } from "@/lib/chat/attachments";
import { parseTradeCommand } from "@/lib/trade/parse";
import { runTradeCommand } from "@/lib/trade/imessage";
import { mintSignedLink } from "@/lib/miniapps/cards";
import { log } from "@/lib/log";

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
    // Create threads take turns only through /api/create/turn (Kit prompt,
    // create-<tier> model, project budget) — never as plain chat.
    if (isCreateSession(body.session)) {
      return NextResponse.json({ error: "create session" }, { status: 400 });
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

  // /twin: the digital twin speaks (voice clone + lip-sync) or poses (an
  // identity-anchored image). Bare /twin answers inline with status and a
  // link into the builder; renders run like creative jobs and the chat
  // follows them over the same SSE route.
  const twinCommand = parseTwinCommand(typed);
  if (twinCommand) {
    if (twinCommand.kind === "card" || twinCommand.kind === "status") {
      let status: string;
      if (twinCommand.kind === "status") {
        status = await twinStatusLine(supabase, userId, twinCommand.handle);
      } else {
        const { data: me } = await supabase
          .from("users")
          .select("username")
          .eq("id", userId)
          .maybeSingle();
        const username = (me as { username?: unknown } | null)?.username;
        status =
          typeof username === "string" && username
            ? await twinStatusLine(supabase, userId, username)
            : "pick a username first — your twin is bound to your @name.";
      }
      return NextResponse.json({
        creative_line: `${status}\n${TWIN_HELP_LINE}\nBuild or update it here: ${twinBuilderLink(userId)}`,
      });
    }
    try {
      const job = await createCreativeJob(
        supabase,
        userId,
        "web",
        "twin",
        undefined,
        undefined,
        { twinKind: twinCommand.kind === "speak" ? "speak" : "image" }
      );
      after(async () => {
        try {
          const result = await runTwinCommand(supabase, userId, twinCommand, {
            channel: "web",
            jobId: job.id,
          });
          if (!result.ok && result.jobId === null) {
            await updateCreativeJob(supabase, job.id, {
              status: "refused",
              error: result.line,
            });
          }
        } catch (error) {
          log.error("twin job execution failed", {user_id: userId,
              job_id: job.id,
              error: error instanceof Error ? error.message : String(error),});
        }
      });
      return NextResponse.json({ creative_job_id: job.id, mode: "twin" });
    } catch (error) {
      log.error("twin job start failed", {user_id: userId,
          error: error instanceof Error ? error.message : String(error),});
      return NextResponse.json({ error: "run failed" }, { status: 500 });
    }
  }

  // M16: an explicit /imagine, /animate, or /zap short-circuits before the
  // Hermes run. Parsed against the user's typed text only — the attachment
  // markers are internal bookkeeping, not part of a creative prompt (and the
  // web lane stages no media inputs, so the combination is refused outright).
  // @username mentions resolve server-side to the twin's approved images.
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
    const attached = await attachIdentityReferences(supabase, userId, {
      mode: command.mode,
      cleanedText: command.cleanedText,
      text: typed,
      mediaInputs: [],
    });
    if (attached.problem) {
      return NextResponse.json({ creative_line: attached.problem });
    }
    try {
      const job = await createCreativeJob(supabase, userId, "web", command.mode);
      await recordReferenceUses(supabase, job.id, userId, attached.uses);
      after(async () => {
        await executeCreativeJob(supabase, job.id, userId, attached.turn).catch((error: unknown) => {
          log.error("creative job execution failed", {user_id: userId,
              job_id: job.id,
              error: error instanceof Error ? error.message : String(error),});
        });
      });
      return NextResponse.json({ creative_job_id: job.id, mode: command.mode });
    } catch (error) {
      log.error("creative job start failed", {user_id: userId,
          error: error instanceof Error ? error.message : String(error),});
      return NextResponse.json({ error: "run failed" }, { status: 500 });
    }
  }

  // /trade (docs/trade/plan.md §4.1): deterministic arms answer inline —
  // the web lane is already owner-session scoped, so no tier check applies;
  // bare `/trade` links to the mini-app, and freeform `/trade ...` text
  // continues to the Hermes run for the box-side trade skill.
  const tradeCommand = parseTradeCommand(typed);
  if (tradeCommand) {
    if (tradeCommand.kind === "card") {
      return NextResponse.json({
        creative_line: `Trade is one tap away — ${mintSignedLink(userId, "trade", "default")}`,
      });
    }
    let tradeAnswer: string | null = null;
    try {
      const { handled } = await runTradeCommand(
        supabase,
        async (text) => {
          tradeAnswer = tradeAnswer ? `${tradeAnswer}\n${text}` : text;
        },
        { userId, senderTier: 0 },
        tradeCommand
      );
      if (handled) {
        return NextResponse.json({
          creative_line: tradeAnswer ?? "Done.",
        });
      }
    } catch (error) {
      log.error("trade web command failed", {user_id: userId,
          error: error instanceof Error ? error.message : String(error),});
      return NextResponse.json({
        creative_line: "Couldn't reach trading — try again.",
      });
    }
    // trade.kind === "agent": falls through to the normal run.
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
    log.error("bot delegation skipped", {user_id: userId, error: message});
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
      const busy = migrationBusyResponse(error);
      if (busy) return busy;
      if (error instanceof StartLimitError) {
        return NextResponse.json({ error: "busy" }, { status: 429 });
      }
      const message = error instanceof Error ? error.message : "unknown error";
      log.error("bot delegation failed", {user_id: userId, error: message});
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
    const busy = migrationBusyResponse(error);
    if (busy) return busy;
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    log.error("web chat run failed", {user_id: userId, error: message});
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
