/**
 * MA9.2 — the browser SDK bundle is built against the same-origin relay
 * (/api/mini/onairos, see app/api/mini/onairos/[...path]/route.ts), so an
 * apiUrl it hands back may point at the relay instead of the Onairos API.
 * The server-side handoff contract (lib/onairos/context.ts) only accepts
 * https onairos hosts, so the relay prefix is mapped back to the upstream
 * host before the handoff is posted.
 */

export const ONAIROS_PROXY_PATH = "/api/mini/onairos";
export const ONAIROS_UPSTREAM = "https://api2.onairos.uk";

/** Map a relay-based apiUrl back to the canonical Onairos API URL; absolute
 * onairos URLs pass through untouched. */
export function canonicalApiUrl(apiUrl: string, origin: string): string {
  let url: URL;
  try {
    url = new URL(apiUrl, origin);
  } catch {
    return apiUrl;
  }
  if (
    url.origin === origin &&
    (url.pathname === ONAIROS_PROXY_PATH ||
      url.pathname.startsWith(`${ONAIROS_PROXY_PATH}/`))
  ) {
    return `${ONAIROS_UPSTREAM}${url.pathname.slice(ONAIROS_PROXY_PATH.length)}${url.search}`;
  }
  return apiUrl;
}
