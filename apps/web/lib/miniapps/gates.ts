/**
 * MA5 gate chain. Access to an app runs, server-side and in order:
 *   visibility → password → x402 → session
 * Each gate short-circuits with its own challenge/error response. The chain
 * runs on every load — a `suspended` registry flip blocks the next request.
 *
 * The x402 gate implementation lives in lib/payments/x402 and mints receipt
 * proof after settlement; the ordering and short-circuit contract here must
 * not change.
 */
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { BASE_HEADERS, esc, forbidden, notFound, page } from "./html";
import type { RegistryApp } from "./registry";
import { verifyToken, type MiniAppRole } from "./tokens";

export interface MiniSession {
  userId: string;
  resourceId: string;
  role: MiniAppRole;
  grantId?: string;
}

export type GateOutcome =
  | { ok: true; session: MiniSession }
  | { ok: false; response: NextResponse };

export function cookieName(app: string): string {
  return `mini_${app}`;
}

/**
 * Origin for redirects. Behind the mini-host rewrite, request.nextUrl.origin
 * is the internal server origin (e.g. localhost under `next start`), so
 * redirects must use the configured mini origin instead.
 */
export function externalOrigin(request: NextRequest): string {
  return request.headers.get("x-mini-host") === "1"
    ? env.miniappOrigin()
    : request.nextUrl.origin;
}

export function sessionFromCookie(
  request: NextRequest,
  app: string
): MiniSession | null {
  const raw = request.cookies.get(cookieName(app))?.value;
  if (!raw) return null;
  const claims = verifyToken(raw, app);
  if (!claims) return null;
  return {
    userId: claims.userId,
    resourceId: claims.resourceId,
    role: claims.role ?? "owner",
    grantId: claims.grantId,
  };
}

/* ---------------------------------------------------------------- gate 1 */

/** Visibility/status: only published rows load; draft and suspended 404. */
export function visibilityGate(app: RegistryApp): NextResponse | null {
  if (app.status !== "published") return notFound();
  return null;
}

/* ---------------------------------------------------------------- gate 2 */

const PW_COOKIE_PREFIX = "mini_pw_";

function passwordProof(app: RegistryApp): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(`pw:${app.slug}:${app.password_hash ?? ""}`)
    .digest("base64url");
}

export function hashPassword(password: string, saltHex: string): string {
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  return `scrypt:${saltHex}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

function passwordChallenge(app: RegistryApp): NextResponse {
  const body = page(
    app.name || app.slug,
    `<h1>${esc(app.name || app.slug)}</h1><p class="when" style="white-space:normal">This app is password protected.</p><form method="post" class="addrow"><input type="hidden" name="action" value="__password"><input type="password" name="password" placeholder="Password" maxlength="200" autocomplete="off"><button>Open</button></form>`
  );
  return new NextResponse(body, {
    status: 401,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export interface PasswordGateResult {
  response: NextResponse;
  /** true when a correct password was just accepted (MA9: gate_settled). */
  settled: boolean;
}

/**
 * Password gate. `submitted` is the password from a `__password` form post;
 * on success the response redirect carries a path-scoped proof cookie so the
 * cleartext is never re-sent.
 */
export function passwordGate(
  request: NextRequest,
  app: RegistryApp,
  basePath: string,
  submitted?: string
): PasswordGateResult | null {
  if (!app.password_hash) return null;
  const proof = passwordProof(app);
  const cookie = request.cookies.get(`${PW_COOKIE_PREFIX}${app.slug}`)?.value;
  if (cookie === proof) return null;
  if (submitted !== undefined) {
    if (!verifyPassword(submitted, app.password_hash)) {
      return { response: passwordChallenge(app), settled: false };
    }
    const response = NextResponse.redirect(
      new URL(basePath, externalOrigin(request)),
      303
    );
    response.cookies.set(`${PW_COOKIE_PREFIX}${app.slug}`, proof, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: basePath,
      maxAge: 60 * 60,
    });
    return { response, settled: true };
  }
  return { response: passwordChallenge(app), settled: false };
}

/* ---------------------------------------------------------------- gate 3 */

/**
 * x402 hook. The real gate lives in lib/payments/x402 (verify payment, write
 * x402_receipts, mint receipt proof) and is bound lazily on first use — a
 * static import would be a cycle, since the payments module uses this file's
 * helpers. The loader only knows "null = pass, response = short-circuit".
 */
export type X402Gate = (
  request: NextRequest,
  app: RegistryApp
) => Promise<NextResponse | null>;

let x402Impl: X402Gate | null = null;

export function setX402Gate(gate: X402Gate): void {
  x402Impl = gate;
}

export async function x402Gate(
  request: NextRequest,
  app: RegistryApp
): Promise<NextResponse | null> {
  if (!x402Impl) {
    const { x402PaymentGate } = await import("../payments/x402");
    x402Impl = x402PaymentGate;
  }
  return x402Impl(request, app);
}

/* ---------------------------------------------------------------- gate 4 */

export function sessionGate(
  request: NextRequest,
  app: RegistryApp
): GateOutcome {
  const session = sessionFromCookie(request, app.slug);
  if (!session) {
    return {
      ok: false,
      response: forbidden("no session — open this from your card"),
    };
  }
  return { ok: true, session };
}

/* ----------------------------------------------------------------- chain */

export async function runGateChain(
  request: NextRequest,
  supabase: SupabaseClient,
  app: RegistryApp,
  basePath: string,
  submittedPassword?: string
): Promise<GateOutcome> {
  const visibility = visibilityGate(app);
  if (visibility) return { ok: false, response: visibility };

  const password = passwordGate(request, app, basePath, submittedPassword);
  if (password) {
    await logGateEvent(
      supabase,
      app.id,
      null,
      password.settled ? "gate_settled" : "gate_challenged",
      "password"
    );
    return { ok: false, response: password.response };
  }

  const payment = await x402Gate(request, app);
  if (payment) {
    await logGateEvent(supabase, app.id, null, "gate_challenged", "x402");
    return { ok: false, response: payment };
  }

  return sessionGate(request, app);
}

/** MA9 gate ledger — best-effort, never blocks the request. */
export async function logGateEvent(
  supabase: SupabaseClient,
  appId: string,
  userId: string | null,
  kind: "gate_challenged" | "gate_settled" | "app_opened",
  ref?: string
): Promise<void> {
  const { error } = await supabase.from("miniapp_gate_events").insert({
    app_id: appId,
    user_id: userId,
    kind,
    ref: ref ?? null,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "gate event insert failed", error: error.message })
    );
  }
}

