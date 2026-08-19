/**
 * MA1 renderer module contract. Each first-party app is a module at
 * lib/miniapps/apps/<slug>.tsx; the loader route resolves the slug against
 * the registry, runs the gate chain, then dispatches here. Modules render
 * plain server HTML (no client storage, C17) and receive an already-verified
 * session — they never parse tokens themselves.
 *
 * Sessions D–I: add your module here and register it in ./index.ts; flip the
 * registry row to status='published' in your migration.
 */
import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniSession } from "../gates";
import type { RegistryApp } from "../registry";

export interface MiniAppContext {
  request: NextRequest;
  supabase: SupabaseClient;
  app: RegistryApp;
  session: MiniSession;
  /**
   * External base path for this app — `/mini/<slug>` on the main origin,
   * `/<slug>` on mini.wzrd.tech. Use for redirects and cookie paths.
   */
  basePath: string;
}

export interface MiniAppModule {
  /** GET with a valid session: render the view. */
  render(ctx: MiniAppContext): Promise<NextResponse>;
  /** POST with a valid session: apply one action. Absent = no POSTs (404). */
  action?(ctx: MiniAppContext, form: FormData): Promise<NextResponse>;
  /**
   * Actions a guest session may perform (MA4). Anything else from a guest is
   * 403 and never reaches `action`. Default: none — guests are read-only.
   */
  guestActions?: readonly string[];
  /**
   * MA8: a public storefront-style surface. The loader still runs the
   * visibility/password/x402 gates, but an anonymous visitor with no
   * session gets a synthetic guest session for the app's owner instead of
   * a 403 — the module renders only intended-public data.
   */
  publicAccess?: boolean;
}
