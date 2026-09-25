/**
 * Island entry (V11 §5.1): mounts the Create studio on `#create[data-payload]`
 * when served from a shell page under `script-src 'self'`, the same way
 * `image-editor.js` and `identity-booth.js` hydrate. The store page imports
 * `CreateStudio` directly; this entry exists for the first-party module path.
 *
 * R-PERF-07: react-dom + the studio are dynamic imports so this script tag
 * stays a tiny shell — the shell page doesn't pay ~300 KB up front.
 */
export {};

interface Payload {
  slug?: string | null;
}

async function mount(): Promise<void> {
  const el = document.getElementById("create");
  if (!el) return;
  let payload: Payload = {};
  try {
    payload = JSON.parse(el.dataset["payload"] ?? "{}") as Payload;
  } catch {
    payload = {};
  }
  const [{ createRoot }, { CreateStudio }] = await Promise.all([
    import("react-dom/client"),
    import("./CreateStudio"),
  ]);
  createRoot(el).render(<CreateStudio slug={payload.slug ?? null} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void mount(), {
    once: true,
  });
} else {
  void mount();
}
