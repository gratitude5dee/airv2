/**
 * The control-plane side of `https://air.internal/v1/*` (goal-create-v11
 * §11.3). The Outbound Worker — never user code — calls these routes with
 * the app's runtime token as Bearer plus the identity headers the Dispatcher
 * set on the way in (X-Air-Principal / X-Air-Role / X-Air-App /
 * X-Air-Version). The token is the credential; the headers are trusted only
 * because the token's holder (the Outbound Worker) is the one that set them.
 * The app slug always comes from the token row, and every call leaves one
 * content-free `fn_request` ops row (`<slug>:<status>`) for the tab's ring.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getObject } from "../storage/r2";
import { recordOpsEvent } from "../security/limits";
import { IDENTITY_HEADERS } from "./identity";
import type { AppRole } from "./tokens";
import { authenticateRuntimeToken, type RuntimePrincipal } from "./runtime";

export const RESOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const ACTION_NAME_RE = /^[a-z0-9_.-]{1,64}$/;
export const STATE_MAX_BYTES = 256 * 1024;
export const ACTIONS_MAX_BYTES = 16 * 1024;
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const ACTION_LOG_MAX_ENTRIES = 200;

const ROLES: readonly AppRole[] = ["owner", "guest", "anon", "agent"];

export interface RuntimeCall {
  principal: RuntimePrincipal;
  role: AppRole;
  /** The Dispatcher's principal string (`p_…`, `g_…`, `anon:…`) or "". */
  actor: string;
  /** The version the calling Worker runs, when the Outbound relayed it. */
  version: string | null;
}

export class RuntimeApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/**
 * Resolve the calling app from the Bearer; a wrong or missing token is a
 * 401 with no hint. `X-Air-App`, when present, must agree with the token —
 * a mismatch means something between the Worker and us rewrote identity.
 */
export async function runtimeCall(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<RuntimeCall> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!bearer) throw new RuntimeApiError(401, "unauthorized");
  const principal = await authenticateRuntimeToken(supabase, bearer);
  if (!principal) throw new RuntimeApiError(401, "unauthorized");
  const app = request.headers.get(IDENTITY_HEADERS.app);
  if (app && app !== principal.slug) throw new RuntimeApiError(401, "unauthorized");
  const roleValue = request.headers.get(IDENTITY_HEADERS.role) ?? "anon";
  const role = (ROLES as readonly string[]).includes(roleValue)
    ? (roleValue as AppRole)
    : "anon";
  const version = request.headers.get(IDENTITY_HEADERS.version);
  return {
    principal,
    role,
    actor: request.headers.get(IDENTITY_HEADERS.principal) ?? "",
    version: version && /^[A-Za-z0-9_.-]{1,64}$/.test(version) ? version : null,
  };
}

export function runtimeJson(
  body: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Wrap a runtime route: auth, error mapping, and the content-free request
 * ring. Only the status code and slug are recorded — never a path, a body,
 * or a principal.
 */
export async function handleRuntime(
  request: NextRequest,
  supabase: SupabaseClient,
  handler: (call: RuntimeCall) => Promise<NextResponse>
): Promise<NextResponse> {
  let call: RuntimeCall | null = null;
  let response: NextResponse;
  try {
    call = await runtimeCall(request, supabase);
    response = await handler(call);
  } catch (error) {
    if (error instanceof RuntimeApiError) {
      response = runtimeJson({ error: error.code }, error.status);
    } else {
      console.error(
        JSON.stringify({
          msg: "functions runtime route failed",
          app: call?.principal.slug ?? null,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      response = runtimeJson({ error: "internal" }, 500);
    }
  }
  if (call) {
    await recordOpsEvent(
      supabase,
      "fn_request",
      call.principal.userId,
      `${call.principal.slug}:${response.status}`
    );
  }
  return response;
}

/** Read a bounded body; over the cap is a 413 before any parsing. */
export async function readBoundedText(
  request: NextRequest,
  maxBytes: number
): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new RuntimeApiError(413, "payload_too_large");
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length > maxBytes) throw new RuntimeApiError(413, "payload_too_large");
  return buffer.toString("utf8");
}

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new RuntimeApiError(400, "invalid_json");
  }
}

export interface DeclaredActions {
  actions: string[];
  guestActions: string[];
}

/**
 * The actions the running version's manifest.json declares (air.json
 * `actions` / `guestActions`, written by the Build Service). No manifest or
 * no version = no actions: nothing is ever accepted by default.
 */
export async function declaredActions(
  slug: string,
  version: string | null
): Promise<DeclaredActions> {
  const empty: DeclaredActions = { actions: [], guestActions: [] };
  if (!version) return empty;
  try {
    const object = await getObject(`apps/${slug}/${version}/manifest.json`);
    if (!object) return empty;
    const parsed = JSON.parse(object.body.toString("utf8")) as {
      actions?: unknown;
      guestActions?: unknown;
    };
    const strings = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    return { actions: strings(parsed.actions), guestActions: strings(parsed.guestActions) };
  } catch {
    return empty;
  }
}
