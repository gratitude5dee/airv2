/**
 * Which surface a session actually renders on. Links minted for Messages
 * carry `via: "card"`, but the marker describes where the link was *sent*,
 * not where it *opened*: on a Mac, tapping a card in Messages lands in
 * Safari — a full browser that can run the camera booth, the shader
 * backgrounds and everything else the lite render strips. Only the iOS
 * Messages extension (a WKWebView) needs the lite path.
 *
 * WebKit in-app webviews never carry Safari's `Safari/` product token
 * (Safari, SFSafariViewController, Chrome and Firefox on iOS all do);
 * Android WebViews mark themselves with `; wv)`. A missing or unrecognised
 * User-Agent keeps the card marker — the constrained render is the safe
 * default.
 */
export function isFullBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  if (/\bwv\b/.test(userAgent)) return false;
  if (/\bSafari\//.test(userAgent)) return true;
  return /\bFirefox\//.test(userAgent) && !/AppleWebKit\//.test(userAgent);
}

export function resolveVia(
  via: "card" | undefined,
  userAgent: string | null
): "card" | undefined {
  return via === "card" && isFullBrowser(userAgent) ? undefined : via;
}

/**
 * A phone or tablet, by user agent. Such a surface gets the full render —
 * the intro film, the camera booth, swipe navigation — but never the WebGL
 * backdrop: a GPU context and its textures are the largest single thing the
 * page can ask for, and on iOS the Messages extension that may be hosting
 * it is killed ("Unable to Load App") rather than throttled when the budget
 * runs out. The canvas gradient underneath carries the page without it.
 *
 * Unknown agents count as mobile: doing without a decorative backdrop is
 * the safe default, the same posture resolveVia takes.
 */
export function isHandheld(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /iPhone|iPad|iPod|Android|Mobile\//i.test(userAgent);
}
