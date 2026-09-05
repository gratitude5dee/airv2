/**
 * Shared plumbing for `/api/create/functions/*`: who is calling (owner store
 * session, or the owner's Box via gateway bearer where the route allows an
 * agent), which app, and one error mapper. The Box may stage; only a store
 * session (the owner, on the mini origin) approves, sets secrets, rotates or
 * kills (CR4).
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storeSessionUserId } from "../miniapps/storeSession";
import { boxUserId } from "../auth/box";
import {
  ownedApp,
  publisherUsername,
  slugFor,
  PublishError,
} from "../miniapps/publish";
import type { RegistryApp } from "../miniapps/registry";
import { VersionError } from "../create/versions";
import { BackendError } from "./backend";
import { AppOriginRefusedError } from "./deploy";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const APPNAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export type Caller = { userId: string; via: "owner" | "box" };

export async function callerOf(
  request: NextRequest,
  supabase: SupabaseClient,
  allowBox: boolean
): Promise<Caller | null> {
  const owner = storeSessionUserId(request);
  if (owner) return { userId: owner, via: "owner" };
  if (!allowBox) return null;
  const box = await boxUserId(supabase, request);
  return box ? { userId: box, via: "box" } : null;
}

/** Resolve `slug` or `app` (appname) from a query or body to the owner's app. */
export async function appOf(
  supabase: SupabaseClient,
  userId: string,
  input: { slug?: unknown; app?: unknown }
): Promise<RegistryApp> {
  let slug = typeof input.slug === "string" ? input.slug : "";
  const appname = typeof input.app === "string" ? input.app : "";
  if (!slug && appname) {
    if (!APPNAME_RE.test(appname)) throw new PublishError("invalid app name", 400);
    slug = slugFor(await publisherUsername(supabase, userId), appname);
  }
  if (!SLUG_RE.test(slug)) throw new PublishError("invalid slug", 400);
  return ownedApp(supabase, userId, slug);
}

export function functionsErrorResponse(error: unknown): NextResponse {
  if (
    error instanceof BackendError ||
    error instanceof PublishError ||
    error instanceof VersionError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AppOriginRefusedError) {
    return NextResponse.json({ error: "app is being deleted" }, { status: 409 });
  }
  throw error;
}

export async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as unknown;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
