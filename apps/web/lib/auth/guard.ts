/**
 * The one auth module: every request guard returns a typed principal or
 * throws a GuardError carrying the status the route answers with. Routes
 * render the error through `guardResponse`, so a guard is two lines:
 *
 *   const auth = await requireCron(request).catch(guardResponse);
 *   if (auth instanceof NextResponse) return auth;
 *
 * Guards are async even when their check is synchronous so every call site
 * uses the same idiom.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { museEnabled } from "../muse/auth";
import { storeSessionUserId } from "../miniapps/storeSession";
import { sessionUserId } from "./user";

export type GuardStatus = 401 | 403 | 404;

export class GuardError extends Error {
  readonly status: GuardStatus;
  readonly code: string;

  constructor(status: GuardStatus, code = "unauthorized") {
    super(code);
    this.name = "GuardError";
    this.status = status;
    this.code = code;
  }

  toResponse(): NextResponse {
    // 404 carries no body: a guarded route denies its existence the same
    // way an unknown path does (the muse worker convention).
    if (this.status === 404) return new NextResponse(null, { status: 404 });
    return NextResponse.json({ error: this.code }, { status: this.status });
  }
}

/** Turn a thrown GuardError into the route's response. Anything that is not
 * a GuardError (a real failure, not an auth miss) is rethrown so it still
 * surfaces as a 500. */
export function guardResponse(error: unknown): NextResponse {
  if (error instanceof GuardError) return error.toResponse();
  throw error;
}

export interface OwnerPrincipal {
  readonly kind: "owner";
  readonly userId: string;
}

export interface BoxPrincipal {
  readonly kind: "box";
  readonly userId: string;
  readonly boxId: string;
}

export interface AdminPrincipal {
  readonly kind: "admin";
}

export interface CronPrincipal {
  readonly kind: "cron";
}

export interface StorePrincipal {
  readonly kind: "store";
  readonly userId: string;
}

export interface WorkerPrincipal {
  readonly kind: "worker";
  readonly worker: string;
}

export type Principal =
  | OwnerPrincipal
  | BoxPrincipal
  | AdminPrincipal
  | CronPrincipal
  | StorePrincipal
  | WorkerPrincipal;

function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function secretEqual(token: string, expected: string | null): boolean {
  if (!token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The owner's web session (air_session cookie). */
export async function requireOwner(
  request: NextRequest
): Promise<OwnerPrincipal> {
  const userId = sessionUserId(request);
  if (!userId) throw new GuardError(401);
  return { kind: "owner", userId };
}

/** Look up the calling box by its gateway bearer token; null when the
 * credential is absent or unknown. Database failures propagate — an
 * unreachable store is a 500, not an auth miss. */
export async function tryBoxPrincipal(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<BoxPrincipal | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data: box, error } = await supabase
    .from("boxes")
    .select("user_id, provider_box_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (error) throw new Error(`box lookup failed: ${error.message}`);
  if (!box) return null;
  return {
    kind: "box",
    userId: box.user_id as string,
    boxId: box.provider_box_id as string,
  };
}

/** The calling box — 401 unless the bearer token maps to a boxes row. */
export async function requireBox(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<BoxPrincipal> {
  const principal = await tryBoxPrincipal(supabase, request);
  if (!principal) throw new GuardError(401);
  return principal;
}

/** The box credential wins when present (the box is the caller); the owner's
 * session cookie is the fallback for routes a human also calls (trade,
 * store/search). */
export async function requireBoxOrOwner(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<BoxPrincipal | OwnerPrincipal> {
  const box = await tryBoxPrincipal(supabase, request);
  if (box) return box;
  return requireOwner(request);
}

/** ADMIN_API_KEY bearer. */
export async function requireAdmin(
  request: NextRequest
): Promise<AdminPrincipal> {
  if (!secretEqual(bearerToken(request), env.adminApiKey())) {
    throw new GuardError(401);
  }
  return { kind: "admin" };
}

/** CRON_SECRET bearer (the scheduler). */
export async function requireCron(
  request: NextRequest
): Promise<CronPrincipal> {
  if (!secretEqual(bearerToken(request), env.cronSecret())) {
    throw new GuardError(401);
  }
  return { kind: "cron" };
}

/** The mini-store session cookie (storeSessionUserId). */
export async function requireStoreSession(
  request: NextRequest
): Promise<StorePrincipal> {
  const userId = storeSessionUserId(request);
  if (!userId) throw new GuardError(401);
  return { kind: "store", userId };
}

/** Internal workers authenticate per worker kind. Muse worker routes answer
 * 404 on failure so a disabled muse or a bad token hides the route. */
export async function requireWorker(
  request: NextRequest,
  worker: "muse"
): Promise<WorkerPrincipal> {
  if (worker === "muse") {
    if (
      !museEnabled() ||
      !secretEqual(bearerToken(request), env.museWorkerToken())
    ) {
      throw new GuardError(404);
    }
    return { kind: "worker", worker };
  }
  throw new GuardError(404);
}
