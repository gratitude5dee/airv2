/**
 * V11 §10 Lane C — the only module that talks to GitHub as the WZRD Tech Inc
 * GitHub App. It owns GITHUB_APP_PRIVATE_KEY and GITHUB_APP_WEBHOOK_SECRET;
 * nothing else reads them (CR6, C18).
 *
 * Authorization model: the owner installs the App on the repositories they
 * choose (GitHub's install screen is the consent UI); the App asks for
 * `contents:read` + `metadata:read` only. Every repository read here mints a
 * 1-hour installation token from a 10-minute App JWT and discards it with
 * the request — nothing token-shaped is persisted (docs/goal-create-v11.md
 * §10, github-create-sync design note). The one write the App performs is
 * the `build`-mode workflow file, on the branch the owner linked, and only
 * when the owner clicks Import (it needs `contents:write`, so the App
 * declares it; nothing else in this module writes).
 *
 * Surface (all under GITHUB_API_BASE):
 *   app/installations/{id}                       GET / DELETE
 *   app/installations/{id}/access_tokens         POST
 *   installation/repositories                    GET   (installation token)
 *   repos/{owner}/{repo}                         GET
 *   repos/{owner}/{repo}/branches/{branch}       GET
 *   repos/{owner}/{repo}/zipball/{ref}           GET   (follows the 302)
 *   repos/{owner}/{repo}/contents/{path}         GET / PUT
 *
 * Every call is server-side with a hard timeout and reports a typed
 * GitHubError. When the App is not configured the lane reports itself
 * unconfigured and /create hides the Connect button.
 */
import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export function githubAppConfigured(): boolean {
  return Boolean(
    env.githubAppId() &&
      env.githubAppSlug() &&
      env.githubAppPrivateKey() &&
      env.githubAppWebhookSecret()
  );
}

const API_TIMEOUT_MS = 15_000;
const ZIPBALL_TIMEOUT_MS = 60_000;
const APP_JWT_TTL_S = 9 * 60;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** RS256 App JWT, valid ~9 minutes (GitHub caps at 10), issued 60s in the past for clock skew. */
export function appJwt(now = Date.now()): string {
  const appId = env.githubAppId();
  const key = env.githubAppPrivateKey();
  if (!appId || !key) throw new GitHubError(503, "github app is not configured");
  const iat = Math.floor(now / 1000) - 60;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iat, exp: iat + 60 + APP_JWT_TTL_S, iss: appId })
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(key);
  return `${header}.${payload}.${b64url(signature)}`;
}

/** Where a signed-in owner is sent to install the App (state rides back to /setup). */
export function installUrl(state: string): string {
  const slug = env.githubAppSlug();
  if (!slug) throw new GitHubError(503, "github app is not configured");
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}

async function call<T>(
  path: string,
  init: {
    method?: string;
    token: string;
    body?: unknown;
    accept?: string;
    timeoutMs?: number;
  }
): Promise<{ status: number; data: T }> {
  const url = `${env.githubApiBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${init.token}`,
        accept: init.accept ?? "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "wzrd-create",
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : null,
      signal: AbortSignal.timeout(init.timeoutMs ?? API_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (error) {
    throw new GitHubError(
      502,
      `github unreachable: ${error instanceof Error ? error.message : "fetch failed"}`
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* not json */
    }
    throw new GitHubError(response.status, `github ${response.status}: ${message}`);
  }
  if (response.status === 204) return { status: 204, data: undefined as T };
  return { status: response.status, data: (await response.json()) as T };
}

export interface Installation {
  id: number;
  account: { login: string; type: "User" | "Organization" };
  suspended_at: string | null;
  /** Present when the App is installed on a subset of repositories. */
  repository_selection: "all" | "selected";
}

export async function getInstallation(installationId: number): Promise<Installation> {
  const { data } = await call<Installation>(`/app/installations/${installationId}`, {
    token: appJwt(),
  });
  return data;
}

/** Uninstall the App from the account; 404 (already gone) is success. */
export async function deleteInstallation(installationId: number): Promise<void> {
  try {
    await call<void>(`/app/installations/${installationId}`, {
      method: "DELETE",
      token: appJwt(),
    });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return;
    throw error;
  }
}

/**
 * A short-lived installation token, scoped to the given repositories and
 * permissions. It lives for one request path and is never stored.
 */
export async function installationToken(
  installationId: number,
  options: { repositoryIds?: number[]; permissions?: Record<string, "read" | "write"> } = {}
): Promise<string> {
  const { data } = await call<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      token: appJwt(),
      body: {
        ...(options.repositoryIds ? { repository_ids: options.repositoryIds } : {}),
        ...(options.permissions ? { permissions: options.permissions } : {}),
      },
    }
  );
  return data.token;
}

export interface Repository {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  archived: boolean;
}

/** Repositories the installation grants; a few pages at most (the owner picks). */
export async function listInstallationRepositories(
  installationId: number
): Promise<Repository[]> {
  const token = await installationToken(installationId, {
    permissions: { metadata: "read" },
  });
  const repos: Repository[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data } = await call<{ repositories: Repository[] }>(
      `/installation/repositories?per_page=100&page=${page}`,
      { token }
    );
    repos.push(...data.repositories);
    if (data.repositories.length < 100) break;
  }
  return repos.map((repo) => ({
    id: repo.id,
    full_name: repo.full_name,
    private: repo.private,
    default_branch: repo.default_branch,
    archived: repo.archived,
  }));
}

const FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function assertFullName(fullName: string): string {
  if (!FULL_NAME_RE.test(fullName) || fullName.includes("..")) {
    throw new GitHubError(400, "repository must be owner/name");
  }
  return fullName;
}

export async function getRepository(token: string, fullName: string): Promise<Repository> {
  const { data } = await call<Repository>(`/repos/${assertFullName(fullName)}`, { token });
  return data;
}

export async function branchHeadSha(
  token: string,
  fullName: string,
  branch: string
): Promise<string> {
  const { data } = await call<{ commit: { sha: string } }>(
    `/repos/${assertFullName(fullName)}/branches/${encodeURIComponent(branch)}`,
    { token }
  );
  return data.commit.sha;
}

/**
 * The repository tree at `ref` as a zip, capped at `maxBytes` — the cap is
 * enforced while streaming so an oversized archive costs its first bytes,
 * not the whole download. GitHub 302s to a codeload URL; `fetch` follows it.
 */
export async function downloadZipball(
  token: string,
  fullName: string,
  ref: string,
  maxBytes: number
): Promise<Buffer> {
  const url = `${env.githubApiBase()}/repos/${assertFullName(fullName)}/zipball/${encodeURIComponent(ref)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "wzrd-create",
      },
      signal: AbortSignal.timeout(ZIPBALL_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (error) {
    throw new GitHubError(
      502,
      `github unreachable: ${error instanceof Error ? error.message : "fetch failed"}`
    );
  }
  if (!response.ok) {
    throw new GitHubError(response.status, `github ${response.status}: archive unavailable`);
  }
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new GitHubError(413, `repository archive exceeds ${maxBytes} bytes`);
  }
  if (!response.body) throw new GitHubError(502, "github returned no archive body");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new GitHubError(413, `repository archive exceeds ${maxBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export interface RepoFile {
  path: string;
  sha: string;
  content: Buffer;
}

/** A single file's contents at `ref`, or null when absent (files only). */
export async function getFile(
  token: string,
  fullName: string,
  path: string,
  ref: string
): Promise<RepoFile | null> {
  try {
    const { data } = await call<{
      type: string;
      path: string;
      sha: string;
      content?: string;
      encoding?: string;
    }>(
      `/repos/${assertFullName(fullName)}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(ref)}`,
      { token }
    );
    if (data.type !== "file" || data.encoding !== "base64" || data.content === undefined) {
      return null;
    }
    return { path: data.path, sha: data.sha, content: Buffer.from(data.content, "base64") };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/** Create or update one file on `branch` (the only write the App performs). */
export async function putFile(
  token: string,
  fullName: string,
  input: { path: string; branch: string; message: string; content: Buffer; sha?: string | undefined }
): Promise<{ commitSha: string }> {
  const { data } = await call<{ commit: { sha: string } }>(
    `/repos/${assertFullName(fullName)}/contents/${input.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "PUT",
      token,
      body: {
        message: input.message,
        content: input.content.toString("base64"),
        branch: input.branch,
        ...(input.sha ? { sha: input.sha } : {}),
      },
    }
  );
  return { commitSha: data.commit.sha };
}

/**
 * Webhook authenticity: `X-Hub-Signature-256` is HMAC-SHA256 over the raw
 * body with the App's webhook secret. Constant-time compare; any shape
 * mismatch is a plain false (no oracle).
 */
export function verifyWebhookSignature(rawBody: Buffer | string, header: string | null): boolean {
  const secret = env.githubAppWebhookSecret();
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The install round trip's `state`: who started it and until when. Signed
 * with the state key so /setup can bind the arriving installation to the
 * session that asked for it and nothing else (an installation completed
 * from a stale or forged link is refused). 15-minute validity.
 */
const STATE_TTL_MS = 15 * 60_000;

function stateMac(payload: string): string {
  return createHmac("sha256", env.githubStateSigningKey())
    .update(`github-setup:${payload}`)
    .digest("base64url");
}

export function signSetupState(userId: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ u: userId, e: now + STATE_TTL_MS }));
  return `${payload}.${stateMac(payload)}`;
}

export function verifySetupState(state: string | null, now = Date.now()): string | null {
  if (!state) return null;
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const mac = Buffer.from(state.slice(dot + 1), "base64url");
  const expected = Buffer.from(stateMac(payload), "base64url");
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: unknown;
      e?: unknown;
    };
    if (typeof parsed.u !== "string" || typeof parsed.e !== "number") return null;
    if (parsed.e < now) return null;
    return parsed.u;
  } catch {
    return null;
  }
}
