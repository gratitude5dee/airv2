/**
 * Web chat (M6): create a Hermes run on the user's own box. The box target
 * (hosted_url/_token/API_SERVER_KEY) stays server-side; the browser only
 * ever sees the run id (C3).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { startChatRun } from "@/lib/chat/relay";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "@/lib/creative/parse";
import { createCreativeJob } from "@/lib/creative/jobs";
import { executeCreativeJob } from "@/lib/creative/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty input" }, { status: 400 });
  }
  const supabase = serviceClient();

  // M16: an explicit /imagine, /animate, or /zap short-circuits before the
  // Hermes run. Ordinary prose ("make me a picture") falls through unchanged.
  const command = parseExplicitGenerationCommand(input);
  if (command) {
    if ("ambiguous" in command) {
      // Deterministic rejection — no model or provider call happens.
      return NextResponse.json({ creative_line: AMBIGUOUS_COMMAND_LINE });
    }
    try {
      const job = await createCreativeJob(supabase, userId, "web", command.mode);
      after(async () => {
        await executeCreativeJob(supabase, job.id, userId, {
          mode: command.mode,
          cleanedText: command.cleanedText,
          text: input,
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

  try {
    const runId = await startChatRun(supabase, userId, input, "web");
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
