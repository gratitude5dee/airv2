/**
 * Client entry for the native Onairos sign-in on the onboarding mini-app's
 * onairos step (MA9.2). Bundled to public/creator-os/onairos-connect.js by
 * scripts/build-onairos-connect.mjs and mounted onto #onairos-connect.
 *
 * The SDK runs its consent/auth flow in the browser; on completion this
 * posts the opaque handoff ({ api_url, token }) back to the mini-app as a
 * regular form post. Persona fetching and persistence stay server-side in
 * lib/onairos/sync.ts — no persona data or key material is handled here
 * beyond the short-lived handoff token the SDK returns to the page.
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { OnairosButton, initializeApiKey } from "onairos";

function submitHandoff(apiUrl: string, token: string): void {
  const form = document.createElement("form");
  form.method = "post";
  form.style.display = "none";
  const add = (name: string, value: string): void => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  add("action", "onairos_handoff");
  add("api_url", apiUrl);
  add("token", token);
  document.body.appendChild(form);
  form.submit();
}

function ConnectApp({ apiKey }: { apiKey: string }): React.ReactElement {
  const [phase, setPhase] = useState<
    "loading" | "ready" | "submitting" | "error"
  >("loading");
  useEffect(() => {
    let cancelled = false;
    initializeApiKey({ apiKey })
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);
  if (phase === "loading") {
    return <p className="muted">Loading Onairos sign-in…</p>;
  }
  if (phase === "error") {
    return (
      <p className="muted">
        Onairos sign-in didn&apos;t load — use the iMessage option below.
      </p>
    );
  }
  if (phase === "submitting") {
    return <p className="muted">Connecting your context…</p>;
  }
  return (
    <OnairosButton
      webpageName="air by WZRD.tech"
      requestData={["preferences", "personality"]}
      autoFetch={false}
      onComplete={(data, error) => {
        if (error || !data || !data.token || !data.apiUrl) return;
        setPhase("submitting");
        submitHandoff(data.apiUrl, data.token);
      }}
    />
  );
}

const mount = document.getElementById("onairos-connect");
const apiKey = mount?.dataset.apiKey ?? "";
if (mount && apiKey) {
  createRoot(mount).render(
    <StrictMode>
      <ConnectApp apiKey={apiKey} />
    </StrictMode>
  );
}
