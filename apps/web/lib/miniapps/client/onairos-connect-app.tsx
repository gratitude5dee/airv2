/**
 * The heavy half of the Onairos sign-in mount (R-PERF-07): react-dom plus
 * the ~3 MB `onairos` SDK ride an async chunk so the onboarding slide never
 * pays them before the first tap. `onairos-connect.tsx` dynamic-imports
 * `mountOnairosConnect` on first intent or idle.
 */
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { OnairosButton, initializeApiKey } from "onairos";
import { canonicalApiUrl } from "@/lib/onairos/handoffUrl";

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

function ConnectApp({
  apiKey,
  googleClientId,
}: {
  apiKey: string;
  googleClientId: string | null;
}): React.ReactElement {
  const [phase, setPhase] = useState<
    "loading" | "ready" | "submitting" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    // Our own Google OAuth web client ID (public identifier): the SDK's
    // built-in one only authorizes Onairos's origins, so "Continue with
    // Google" is refused by Google on our domain without it.
    initializeApiKey({
      apiKey,
      ...(googleClientId
        ? {
            googleClientIds: {
              webClientId: googleClientId,
              serverClientId: googleClientId,
            },
          }
        : {}),
    })
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch((error: unknown) => {
        // Diagnostic only — the message never carries the key or a token.
        console.error(
          "onairos init failed:",
          error instanceof Error ? error.message : String(error)
        );
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, googleClientId, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (phase === "loading") {
    return <p className="muted">Loading Onairos sign-in…</p>;
  }
  if (phase === "error") {
    return (
      <p className="muted">
        Onairos sign-in couldn&apos;t reach the service —{" "}
        <button type="button" className="ghost" onClick={retry}>
          try again
        </button>{" "}
        or use the iMessage option below.
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
        if (error || !data || !data.token || !data.apiUrl) {
          if (error) {
            console.error(
              "onairos flow failed:",
              error instanceof Error ? error.message : String(error)
            );
            setPhase("error");
          }
          return;
        }
        setPhase("submitting");
        submitHandoff(
          canonicalApiUrl(data.apiUrl, window.location.origin),
          data.token
        );
      }}
    />
  );
}

export function mountOnairosConnect(
  mount: HTMLElement,
  config: { apiKey: string; googleClientId: string | null }
): void {
  createRoot(mount).render(
    <StrictMode>
      <ConnectApp
        apiKey={config.apiKey}
        googleClientId={config.googleClientId}
      />
    </StrictMode>
  );
}
