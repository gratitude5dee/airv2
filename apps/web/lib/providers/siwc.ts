/**
 * Sign in with ChatGPT (SIWC) — OpenAI's OAuth flow for sharing a user's own
 * ChatGPT plan allowance with an agent client
 * (developers.openai.com/siwc/token-sharing-open-source).
 *
 * The credential bundle is sealed at rest with PROVIDER_VAULT_KEY — the same
 * discipline as provider_keys: never plaintext in Postgres, never echoed to
 * a browser, never delivered to a box. The gateway opens it server-side per
 * request and rides the existing upstream /responses path with the user's
 * token as the Bearer (see app/api/gateway/v1/[...path]/route.ts).
 *
 * Flow shape (the doc's loopback-redirect assumption becomes a paste-back,
 * since our callback listener can't run on the user's device):
 *   1. beginSiwc() mints state + OIDC nonce + PKCE verifier, stores them
 *      sealed in provider_oauth_attempts, and returns the authorize URL.
 *   2. The user signs in on auth.openai.com; their browser lands on a dead
 *      http://127.0.0.1:PORT/auth/callback page (expected) — they copy the
 *      URL bar and paste it into the app (the `gh auth login` headless
 *      pattern).
 *   3. finishSiwc() parses code/state/client_id out of the pasted URL,
 *      exchanges the code server-side, validates the id_token against
 *      OpenAI's JWKS, requires the chatgpt.tokens.use.direct scope, and
 *      seals the credential bundle into provider_oauth.
 *
 * Registration: the first authorize call carries client_id=
 * dynamic_agent_client + the user's ext_agent_host_id + agent_name_hint
 * ("air"); the issued oaiapp_* client_id comes back in the callback and is
 * reused for re-auth with id_token_hint/login_hint.
 */
import {
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
  randomUUID,
} from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret, sealSecret } from "../crypto/secretbox";
import { env } from "../env";

export const SIWC_DYNAMIC_CLIENT = "dynamic_agent_client";
const SIWC_SCOPE =
  "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const SIWC_REQUIRED_SCOPE = "chatgpt.tokens.use.direct";
const SIWC_RESOURCE = "https://api.openai.com/v1";
const SIWC_ISSUER = "https://auth.openai.com";
const AGENT_NAME_HINT = "air";

/** Attempts older than this are dead state — a user who walked away from
 * consent starts over (and gets a fresh state/PKCE pair). */
const ATTEMPT_TTL_MS = 30 * 60 * 1000;
/** Refresh this far ahead of expiry — a token that dies mid-turn still serves. */
const REFRESH_LEEWAY_MS = 120 * 1000;

/** The sealed credential record — the doc's ~/.config file carried as a
 * sealed Postgres row (the server is the registered host). */
interface SiwcBundle {
  email: string | null;
  issuer: string;
  subject: string;
  client_id: string;
  ext_agent_host_id: string;
  id_token: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scopes: string[];
  saved_at: string;
}

interface SiwcAttempt {
  nonce: string;
  verifier: string;
  redirect_uri: string;
  client_id: string;
  host_id: string;
}

export interface SiwcStatus {
  connected: boolean;
  accountLabel: string | null;
  /** Account-specific model ids from the public model endpoint. */
  models: string[];
  /** Rebuilt authorize URL while a sign-in attempt is pending. */
  pendingUrl: string | null;
}

export type SiwcResult =
  | { ok: true; account: string | null }
  | { ok: false; error: string };

function randUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function vaultKeyOrNull(): string | null {
  return env.providerVaultKey();
}

function authorizeUrl(attempt: SiwcAttempt, state: string, first: boolean): string {
  const params = new URLSearchParams({
    client_id: attempt.client_id,
    response_type: "code",
    redirect_uri: attempt.redirect_uri,
    scope: SIWC_SCOPE,
    resource: SIWC_RESOURCE,
    state,
    nonce: attempt.nonce,
    code_challenge_method: "S256",
    code_challenge: pkceChallenge(attempt.verifier),
    ext_agent_host_id: attempt.host_id,
  });
  if (first) params.set("agent_name_hint", AGENT_NAME_HINT);
  return `${env.siwcAuthBase()}/api/accounts/authorize?${params.toString()}`;
}

async function readAttempt(
  supabase: SupabaseClient,
  userId: string
): Promise<{ state: string; attempt: SiwcAttempt } | null> {
  const vaultKey = vaultKeyOrNull();
  if (!vaultKey) return null;
  const { data } = await supabase
    .from("provider_oauth_attempts")
    .select("state, attempt_sealed, created_at")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  if (!data?.attempt_sealed) return null;
  const age = Date.now() - Date.parse(String(data.created_at));
  if (!(age < ATTEMPT_TTL_MS)) {
    const { error: _expired } = await supabase
      .from("provider_oauth_attempts")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "openai");
    return null;
  }
  try {
    const attempt = JSON.parse(
      openSecret(String(data.attempt_sealed), vaultKey)
    ) as SiwcAttempt;
    return { state: String(data.state), attempt };
  } catch {
    return null;
  }
}

/** Rebuild a pending attempt's authorize URL for re-render (the deck shows
 * the link until the attempt completes or expires). */
export async function pendingSiwcUrl(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const pending = await readAttempt(supabase, userId);
  if (!pending) return null;
  const first = pending.attempt.client_id === SIWC_DYNAMIC_CLIENT;
  return authorizeUrl(pending.attempt, pending.state, first);
}

export async function beginSiwc(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const vaultKey = vaultKeyOrNull();
  if (!vaultKey) {
    return { ok: false, error: "Sign-in isn't enabled on this deployment." };
  }
  // Re-auth reuses the issued client + host id; a first registration
  // introduces itself as dynamic_agent_client with a fresh host id.
  const { data: existing } = await supabase
    .from("provider_oauth")
    .select("client_id, host_id, bundle_sealed")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  const attempt: SiwcAttempt = {
    nonce: randUrlSafe(24),
    verifier: randUrlSafe(64),
    redirect_uri: env.siwcRedirectUri(),
    client_id:
      typeof existing?.client_id === "string" && existing.client_id
        ? existing.client_id
        : SIWC_DYNAMIC_CLIENT,
    host_id:
      typeof existing?.host_id === "string" && existing.host_id
        ? existing.host_id
        : `urn:uuid:${randomUUID()}`,
  };
  const state = randUrlSafe(24);
  const { error } = await supabase.from("provider_oauth_attempts").upsert(
    {
      user_id: userId,
      provider: "openai",
      state,
      attempt_sealed: sealSecret(JSON.stringify(attempt), vaultKey),
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) return { ok: false, error: "Couldn't start sign-in — try again." };
  return { ok: true, url: authorizeUrl(attempt, state, attempt.client_id === SIWC_DYNAMIC_CLIENT) };
}

/** The RS256 id_token check — verify via OpenAI's JWKS, then iss/aud/exp/
 * nonce. Hand-rolled on node:crypto so no new dependency ships to the app. */
async function validateIdToken(
  idToken: string,
  clientId: string,
  nonce: string
): Promise<{ sub: string; email: string | null } | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSignature] = parts;
  if (!rawHeader || !rawPayload || !rawSignature) return null;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(rawHeader, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(rawPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const jwks = await fetch(env.siwcJwksUrl(), { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  const key = (jwks?.keys as Array<{ kid?: string }> | undefined)?.find(
    (entry) => entry.kid === header.kid
  );
  if (!key) return null;
  try {
    const verified = createVerify("RSA-SHA256")
      .update(`${rawHeader}.${rawPayload}`)
      .verify(
        createPublicKey({ key, format: "jwk" }),
        Buffer.from(rawSignature, "base64url")
      );
    if (!verified) return null;
  } catch {
    return null;
  }
  if (payload["iss"] !== SIWC_ISSUER) return null;
  const aud = payload["aud"];
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(clientId)) return null;
  if (typeof payload["exp"] !== "number" || payload["exp"] * 1000 < Date.now())
    return null;
  if (payload["nonce"] !== nonce) return null;
  return {
    sub: String(payload["sub"] ?? ""),
    email: typeof payload["email"] === "string" ? payload["email"] : null,
  };
}

/** Account-specific model list from the public models endpoint, cached on
 * the row so Choose Model can render the picker without a live call. */
async function discoverModels(accessToken: string): Promise<string[]> {
  const res = await fetch(`${env.siwcApiBase()}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return [];
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ id?: unknown }>;
  } | null;
  return (body?.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function storeBundle(
  supabase: SupabaseClient,
  userId: string,
  bundle: SiwcBundle,
  models: string[]
): Promise<boolean> {
  const vaultKey = vaultKeyOrNull();
  if (!vaultKey) return false;
  const { error } = await supabase.from("provider_oauth").upsert(
    {
      user_id: userId,
      provider: "openai",
      bundle_sealed: sealSecret(JSON.stringify(bundle), vaultKey),
      account_label: bundle.email,
      client_id: bundle.client_id,
      host_id: bundle.ext_agent_host_id,
      id_token_sub: bundle.subject,
      expires_at: new Date(Date.now() + bundle.expires_in * 1000).toISOString(),
      models_cache: models,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  return !error;
}

/**
 * Finish the paste-back: the callback URL the user's browser died on carries
 * code + state + (on first registration) the issued client_id.
 */
export async function finishSiwc(
  supabase: SupabaseClient,
  userId: string,
  pastedUrl: string
): Promise<SiwcResult> {
  const vaultKey = vaultKeyOrNull();
  if (!vaultKey) {
    return { ok: false, error: "Sign-in isn't enabled on this deployment." };
  }
  const pending = await readAttempt(supabase, userId);
  if (!pending) {
    return {
      ok: false,
      error: "That sign-in attempt expired — start it again.",
    };
  }
  let url: URL;
  try {
    url = new URL(pastedUrl.trim());
  } catch {
    return { ok: false, error: "Paste the full address bar URL after sign-in." };
  }
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const { error: _cancelled } = await supabase
      .from("provider_oauth_attempts")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "openai");
    return {
      ok: false,
      error:
        oauthError === "access_denied"
          ? "Sign-in was cancelled — no account connected."
          : `ChatGPT sign-in failed (${oauthError}).`,
    };
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return {
      ok: false,
      error: "That URL doesn't carry a sign-in code — copy the whole address bar.",
    };
  }
  if (state !== pending.state) {
    return { ok: false, error: "Sign-in state mismatch — start it again." };
  }
  // Registration returns the issued client_id; re-auth may omit it, and a
  // mismatched one is rejected rather than silently re-binding the account.
  const issuedClientId = url.searchParams.get("client_id");
  if (pending.attempt.client_id === SIWC_DYNAMIC_CLIENT) {
    if (!issuedClientId) {
      return {
        ok: false,
        error: "Registration didn't complete — no client id in the callback.",
      };
    }
  } else if (issuedClientId && issuedClientId !== pending.attempt.client_id) {
    return { ok: false, error: "Account mismatch — sign-in rejected." };
  }
  const clientId = issuedClientId ?? pending.attempt.client_id;
  const redirectUri = `${url.protocol}//${url.host}${url.pathname}`;
  if (redirectUri !== pending.attempt.redirect_uri) {
    return {
      ok: false,
      error: "Callback URI doesn't match the sign-in attempt.",
    };
  }

  const tokenRes = await fetch(
    `${env.siwcAuthBase()}/api/accounts/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: pending.attempt.verifier,
        redirect_uri: pending.attempt.redirect_uri,
        resource: SIWC_RESOURCE,
      }).toString(),
    }
  ).catch(() => null);
  if (!tokenRes?.ok) {
    return {
      ok: false,
      error: "Code exchange failed — the code may have expired, start again.",
    };
  }
  const tokens = (await tokenRes.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  } | null;
  if (!tokens?.access_token || !tokens.id_token) {
    return { ok: false, error: "ChatGPT didn't return credentials." };
  }
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(SIWC_REQUIRED_SCOPE)) {
    return {
      ok: false,
      error:
        "Your ChatGPT account didn't grant plan usage — enable ChatGPT plan sharing and try again.",
    };
  }
  const identity = await validateIdToken(
    tokens.id_token,
    clientId,
    pending.attempt.nonce
  );
  if (!identity?.sub) {
    return { ok: false, error: "Sign-in couldn't be verified — try again." };
  }
  const bundle: SiwcBundle = {
    email: identity.email,
    issuer: SIWC_ISSUER,
    subject: identity.sub,
    client_id: clientId,
    ext_agent_host_id: pending.attempt.host_id,
    id_token: tokens.id_token,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? "",
    token_type: tokens.token_type ?? "Bearer",
    expires_in: tokens.expires_in ?? 3600,
    scopes,
    saved_at: new Date().toISOString(),
  };
  const models = await discoverModels(tokens.access_token);
  if (!(await storeBundle(supabase, userId, bundle, models))) {
    return { ok: false, error: "Couldn't save the connection — try again." };
  }
  const { error: _consumed } = await supabase
    .from("provider_oauth_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "openai");
  return { ok: true, account: identity.email };
}

async function readBundle(
  supabase: SupabaseClient,
  userId: string
): Promise<{ bundle: SiwcBundle; expiresAt: string | null } | null> {
  const vaultKey = vaultKeyOrNull();
  if (!vaultKey) return null;
  const { data } = await supabase
    .from("provider_oauth")
    .select("bundle_sealed, expires_at")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  if (!data?.bundle_sealed) return null;
  try {
    return {
      bundle: JSON.parse(openSecret(String(data.bundle_sealed), vaultKey)),
      expiresAt: (data.expires_at as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * The gateway's entry point: a currently-valid access token, refreshing the
 * rotating credential when the saved one is near expiry. Null means the
 * caller falls back to its platform path.
 */
export async function siwcAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; models: string[] } | null> {
  const { data: row } = await supabase
    .from("provider_oauth")
    .select("models_cache, expires_at")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  if (!row) return null;
  const read = await readBundle(supabase, userId);
  if (!read) return null;
  const models = Array.isArray(row.models_cache)
    ? (row.models_cache as unknown[]).filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  const expiresMs = read.expiresAt ? Date.parse(read.expiresAt) : 0;
  if (expiresMs - REFRESH_LEEWAY_MS > Date.now()) {
    return { accessToken: read.bundle.access_token, models };
  }
  const refreshed = await refreshSiwc(supabase, userId, read.bundle, models);
  return refreshed ? { accessToken: refreshed, models } : null;
}

/** Rotating refresh: access token, expiry, scopes and the new refresh token
 * are replaced together (the old refresh token dies with the grant). */
async function refreshSiwc(
  supabase: SupabaseClient,
  userId: string,
  bundle: SiwcBundle,
  models: string[]
): Promise<string | null> {
  if (!bundle.refresh_token) return null;
  const res = await fetch(`${env.siwcAuthBase()}/api/accounts/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: bundle.client_id,
      refresh_token: bundle.refresh_token,
      resource: SIWC_RESOURCE,
    }).toString(),
  }).catch(() => null);
  if (!res?.ok) return null;
  const tokens = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
    scope?: string;
  } | null;
  if (!tokens?.access_token) return null;
  const next: SiwcBundle = {
    ...bundle,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? bundle.refresh_token,
    id_token: tokens.id_token ?? bundle.id_token,
    expires_in: tokens.expires_in ?? bundle.expires_in,
    scopes: tokens.scope
      ? tokens.scope.split(/\s+/).filter(Boolean)
      : bundle.scopes,
    saved_at: new Date().toISOString(),
  };
  if (!(await storeBundle(supabase, userId, next, models))) return null;
  return next.access_token;
}

export async function siwcStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<SiwcStatus> {
  const { data } = await supabase
    .from("provider_oauth")
    .select("account_label, models_cache")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .maybeSingle();
  const models = Array.isArray(data?.models_cache)
    ? (data?.models_cache as unknown[]).filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  if (data) {
    return {
      connected: true,
      accountLabel: (data.account_label as string | null) ?? null,
      models,
      pendingUrl: null,
    };
  }
  return {
    connected: false,
    accountLabel: null,
    models,
    pendingUrl: await pendingSiwcUrl(supabase, userId),
  };
}

/** True when the pin names a model the account actually advertises. */
export function siwcModelAllowed(models: string[], slug: string): boolean {
  return models.includes(slug);
}

export async function disconnectSiwc(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("provider_oauth")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "openai");
  const { error: _attempt } = await supabase
    .from("provider_oauth_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "openai");
  return !error;
}
