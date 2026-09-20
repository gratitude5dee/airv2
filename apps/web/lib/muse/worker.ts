import { env } from "../env";
import { museInternalToken } from "./auth";

/** Private control-plane → Worker call. Values are never logged or retried. */
export async function callMuseWorker(
  path: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  const token = museInternalToken();
  if (!token) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${env.museOrigin()}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
