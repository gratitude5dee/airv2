/**
 * MA4 Settings usage: how much of the public media quota is used, and the
 * public prefix it lives under. Read-only; the row is provisioned lazily on
 * first upload, so a user with no bucket just sees zeros.
 */
import { NextRequest, NextResponse } from "next/server";
import { requestSession } from "@/lib/auth/surface";
import { serviceClient } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: bucket } = await supabase
    .from("user_buckets")
    .select("prefix, bytes_used, quota_bytes")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!bucket) {
    return NextResponse.json({
      bytes_used: 0,
      quota_bytes: 2147483648,
      prefix: null,
      public_base: null,
    });
  }
  return NextResponse.json({
    bytes_used: bucket.bytes_used as number,
    quota_bytes: bucket.quota_bytes as number,
    prefix: bucket.prefix as string,
    public_base: publicUrl(bucket.prefix as string),
  });
}
