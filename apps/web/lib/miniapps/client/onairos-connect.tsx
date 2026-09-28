/**
 * Thin entry for the native Onairos sign-in on the onboarding mini-app's
 * onairos step (MA9.2). Bundled to public/creator-os/onairos-connect.js by
 * scripts/build-onairos-connect.mjs and mounted onto #onairos-connect.
 *
 * R-PERF-07: react-dom + the ~3 MB `onairos` SDK are code-split into an
 * async chunk (./onairos-connect-app) so the onboarding slide doesn't pay
 * 2.4 MB before the first tap. The chunk loads on the first intent gesture
 * (pointer/focus/key) — by the time the user reaches the button it's warm —
 * or once the page goes idle so passive readers still get it.
 */
export {};

const mount = document.getElementById("onairos-connect");
const apiKey = mount?.dataset["apiKey"] ?? "";
const googleClientId = mount?.dataset["googleClientId"] ?? null;

let loading: Promise<void> | undefined;
function load(): void {
  loading ??= import("./onairos-connect-app")
    .then(({ mountOnairosConnect }) => {
      if (mount && apiKey) {
        mountOnairosConnect(mount, { apiKey, googleClientId });
      }
    })
    .catch((error: unknown) => {
      // Leave `loading` cleared so the next gesture retries the fetch.
      console.error(
        "onairos chunk failed:",
        error instanceof Error ? error.message : String(error)
      );
      loading = undefined;
    });
}

if (mount && apiKey) {
  for (const event of ["pointerdown", "focusin", "keydown"] as const) {
    document.addEventListener(event, load, { once: true, capture: true });
  }
  const idle = window.requestIdleCallback;
  if (idle) idle(load, { timeout: 8_000 });
  else setTimeout(load, 3_000);
}
