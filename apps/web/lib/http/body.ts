import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";

export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<Parsed<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid json" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid request" },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
