/**
 * Bots roster CRUD (V7). Postgres metadata answers first — the roster renders
 * name/title/avatar even when the box sleeps; live presence/previews are a
 * best-effort second pass over /p/<name>/api/sessions that never wakes the
 * box (Vault-tab lock discipline: metadata first, live data after wake).
 * Bot api_server_keys never leave the server (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { listSessions } from "@/lib/hermes/client";
import { botTarget, BOT_CHAT_SESSION, isValidBotName } from "@/lib/bots/client";
import { provisionBot, deleteBot, applyModelTier } from "@/lib/bots/provision";
import { getBot, listBots, toPublic, type BotPublic } from "@/lib/bots/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

interface RosterEntry extends BotPublic {
  presence?: "active" | "idle";
  preview?: string;
  last_active?: number;
}

const BOT_TIERS = ["fast", "balanced", "deep"] as const;
const AVATAR_KINDS = ["geometric", "image", "generated", "pet"] as const;

const optionalString = z.union([z.string(), z.null()]).optional();

const CreateBotSchema = z.object({
  name: z.string(),
  title: optionalString,
  description: optionalString,
  clone_from: optionalString,
  model_tier: z.enum(BOT_TIERS).optional(),
  group_label: optionalString,
  avatar_kind: z.enum(AVATAR_KINDS).optional(),
  avatar_ref: optionalString,
  skills: z.array(z.string()).optional(),
});

const PatchBotSchema = z.object({
  name: z.string(),
  title: optionalString,
  description: optionalString,
  model_tier: z.enum(BOT_TIERS).nullable().optional(),
  group_label: optionalString,
  avatar_kind: z.enum(AVATAR_KINDS).nullable().optional(),
  avatar_ref: optionalString,
});

const DeleteBotSchema = z.object({
  name: z.string(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const bots = await listBots(supabase, userId);
  const roster: RosterEntry[] = bots.map(toPublic);

  // Live previews only when the box is already awake — never wake for a
  // roster render (the box sleeps most of the time; metadata is enough).
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, hosted_url, hosted_token, api_server_key, state")
    .eq("user_id", userId)
    .maybeSingle();
  const awake = box?.state === "ready" || box?.state === "idle";
  if (awake && box?.hosted_url && box.hosted_token) {
    const boxTarget = {
      hostedUrl: box.hosted_url as string,
      hostedToken: box.hosted_token as string,
      apiServerKey: box.api_server_key as string,
    };
    await Promise.all(
      roster.map(async (entry, index) => {
        const bot = bots[index];
        if (!bot || bot.status !== "ready") return;
        try {
          const sessions = await listSessions(
            botTarget(boxTarget, bot.name, bot.api_server_key)
          );
          const canonical = sessions.find((s) => s.id === BOT_CHAT_SESSION);
          if (canonical?.preview) entry.preview = canonical.preview.slice(0, 140);
          const lastActive = canonical?.last_active ?? undefined;
          if (lastActive) {
            entry.last_active = lastActive;
            entry.presence =
              Date.now() / 1000 - lastActive < 600 ? "active" : "idle";
          }
        } catch {
          // Box answered for metadata but not this profile — degrade quietly.
        }
      })
    );
  }
  return NextResponse.json({ bots: roster, box_awake: awake });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, CreateBotSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name.trim().toLowerCase();
  if (!isValidBotName(name)) {
    return NextResponse.json(
      { error: "name must be [a-z0-9-]{2,32} and not 'default'" },
      { status: 400 }
    );
  }
  const tier = body.model_tier;
  const avatarKind = body.avatar_kind;
  const supabase = serviceClient();
  const existing = await getBot(supabase, userId, name);
  if (existing) {
    return NextResponse.json({ error: "name already in use" }, { status: 409 });
  }
  if (body.clone_from) {
    const source =
      body.clone_from === "default"
        ? null
        : await getBot(supabase, userId, body.clone_from);
    if (body.clone_from !== "default" && !source) {
      return NextResponse.json({ error: "clone source not found" }, { status: 404 });
    }
  }
  try {
    const bot = await provisionBot(supabase, userId, {
      name,
      title: body.title?.slice(0, 80),
      description: body.description?.slice(0, 500),
      cloneFrom: body.clone_from ?? undefined,
      modelTier: tier,
      groupLabel: body.group_label?.slice(0, 40),
      avatarKind,
      avatarRef: body.avatar_ref?.slice(0, 200),
      skills: body.skills?.slice(0, 20),
    });
    return NextResponse.json({ bot: toPublic(bot) }, { status: 201 });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box is rate limited" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "bot provisioning failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "provisioning failed" }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, PatchBotSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name.trim().toLowerCase();
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const patch: Record<string, string | null> = {};
  if (body.title !== undefined) patch.title = body.title?.slice(0, 80) ?? null;
  if (body.description !== undefined) {
    patch.description = body.description?.slice(0, 500) ?? null;
  }
  if (body.group_label !== undefined) {
    patch.group_label = body.group_label?.slice(0, 40) ?? null;
  }
  if (body.avatar_kind !== undefined) {
    if (body.avatar_kind === null) {
      patch.avatar_kind = null;
    } else if (AVATAR_KINDS.includes(body.avatar_kind)) {
      patch.avatar_kind = body.avatar_kind;
    }
  }
  if (body.avatar_ref !== undefined) {
    patch.avatar_ref = body.avatar_ref?.slice(0, 200) ?? null;
  }
  if (body.model_tier !== undefined) {
    const tier = body.model_tier;
    patch.model_tier = tier;
    // Re-pin in the profile config on the box; requires a wake.
    try {
      const box = await ensureBoxAwake(supabase, userId);
      await applyModelTier(box, bot.name, tier);
    } catch (error) {
      if (error instanceof StartLimitError) {
        return NextResponse.json({ error: "box is rate limited" }, { status: 429 });
      }
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(
        JSON.stringify({ msg: "bot tier re-pin failed", user_id: userId, error: message })
      );
      return NextResponse.json({ error: "tier update failed" }, { status: 502 });
    } finally {
      // Re-arm the box's idle shut-off deadline (ensureBoxAwake cleared it).
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ bot: toPublic(bot) });
  }
  const { data, error } = await supabase
    .from("bots")
    .update(patch)
    .eq("id", bot.id)
    .select(
      "id, user_id, name, title, description, avatar_kind, avatar_ref, model_tier, api_server_key, status, group_label, created_at"
    )
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ bot: toPublic(data as typeof bot) });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, DeleteBotSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const name = body.name.trim().toLowerCase();
  if (name === "default") {
    return NextResponse.json({ error: "default is undeletable" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    await deleteBot(supabase, userId, bot);
    return NextResponse.json({ deleted: name });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box is rate limited" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "bot delete failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "delete failed" }, { status: 502 });
  }
}
