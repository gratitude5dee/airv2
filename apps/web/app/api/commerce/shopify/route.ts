/**
 * Shopify sync hook for the box-side `shopify-sync` skill (box-auth,
 * gateway_token bearer like /api/browser/purchase).
 *  - GET: the published catalog with each product's external_refs, so the
 *    skill can compute a diff before pushing to Shopify.
 *  - POST {product_key, shopify_product_id, shopify_url?}: record the ref a
 *    successful Shopify write produced. Value-free — tokens never cross
 *    this route (C23).
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { CommerceError } from "@/lib/commerce/merchants";
import {
  listProductsWithRefs,
  upsertExternalRef,
} from "@/lib/commerce/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function callingBox(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return null;
  return { userId: box.user_id as string };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  try {
    const products = await listProductsWithRefs(supabase, box.userId);
    return json({ ok: true, products });
  } catch (error) {
    if (error instanceof CommerceError) {
      return json({ error: "commerce_error", message: error.message }, error.status);
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await callingBox(supabase, request);
  if (!box) return json({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as {
    product_key?: unknown;
    shopify_product_id?: unknown;
    shopify_url?: unknown;
  } | null;
  const productKey =
    typeof body?.product_key === "string" ? body.product_key.trim() : "";
  const externalId =
    typeof body?.shopify_product_id === "string"
      ? body.shopify_product_id.trim()
      : "";
  const shopifyUrl =
    typeof body?.shopify_url === "string" && body.shopify_url.trim()
      ? body.shopify_url.trim().slice(0, 500)
      : undefined;
  if (!productKey || !externalId) {
    return json({ error: "invalid request" }, 400);
  }
  try {
    await upsertExternalRef(supabase, box.userId, productKey, "shopify", {
      external_id: externalId.slice(0, 200),
      ...(shopifyUrl ? { url: shopifyUrl } : {}),
    });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof CommerceError) {
      return json({ error: "commerce_error", message: error.message }, error.status);
    }
    throw error;
  }
}
