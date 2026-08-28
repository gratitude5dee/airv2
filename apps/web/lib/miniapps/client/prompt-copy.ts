/**
 * Get started slide client: copy a sample prompt to the clipboard, and
 * optionally close the mini-app so the owner can paste it into iMessage.
 * Served same-origin as /creator-os/prompt-copy.js under script-src 'self' —
 * no network, no other origins, only navigator.clipboard and window.close().
 */

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Webview fallback: clipboard API can be unavailable outside secure
  // contexts — a transient textarea + execCommand still works there.
  return new Promise((resolve, reject) => {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (ok) resolve();
    else reject(new Error("copy failed"));
  });
}

function flash(button: HTMLButtonElement, label: string): void {
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

for (const card of document.querySelectorAll<HTMLElement>(".prompt")) {
  const prompt = card.getAttribute("data-prompt") ?? "";
  for (const button of card.querySelectorAll<HTMLButtonElement>(
    "button[data-copy]"
  )) {
    button.addEventListener("click", () => {
      void copyText(prompt)
        .then(() => {
          flash(button, "Copied");
          if (button.hasAttribute("data-close")) {
            // Messages extension webviews and window.open'd tabs close;
            // a plain browser tab ignores this and the "Copied" flash stands.
            window.setTimeout(() => window.close(), 350);
          }
        })
        .catch(() => flash(button, "Press & hold to copy"));
    });
  }
}
