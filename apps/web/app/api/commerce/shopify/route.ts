/**
 * Shopify sync hook for the box-side `shopify-sync` skill (box-auth,
 * GATEWAY_TOKEN bearer like /api/browser/purchase).
 *  - GET: the published catalog with each product's external_refs, so the
 *    skill can compute a diff before pushing to Shopify.
 *  - POST {product_key, shopify_product_id, shopify_url?}: record the ref a
 *    successful Shopify write produced. Value-free — tokens never cross
 *    this route (C23).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { CommerceError } from "@/lib/commerce/merchants";
import {
  listProductsWithRefs,
  upsertExternalRef,
} from "@/lib/commerce/shopify";
import { guardResponse, requireBox } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}


export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;try {
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
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;const body = (await request.json().catch(() => null)) as {
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
