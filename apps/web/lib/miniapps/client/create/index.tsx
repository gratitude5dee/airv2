/**
 * Island entry (V11 §5.1): mounts the Create studio on `#create[data-payload]`
 * when served from a shell page under `script-src 'self'`, the same way
 * `image-editor.js` and `identity-booth.js` hydrate. The store page imports
 * `CreateStudio` directly; this entry exists for the first-party module path.
 */
import { createRoot } from "react-dom/client";
import { CreateStudio } from "./CreateStudio";

interface Payload {
  slug?: string | null;
}

function mount(): void {
  const el = document.getElementById("create");
  if (!el) return;
  let payload: Payload = {};
  try {
    payload = JSON.parse(el.dataset["payload"] ?? "{}") as Payload;
  } catch {
    payload = {};
  }
  createRoot(el).render(<CreateStudio slug={payload.slug ?? null} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
