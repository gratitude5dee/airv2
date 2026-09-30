/**
 * "Sign in with Claude" — the user's Claude Pro/Max subscription, used
 * through the official `claude` CLI on their own box. Anthropic OAuth
 * credentials are licensed for the Claude Code client only, so they can
 * never be replayed as api.anthropic.com Bearer keys and never live in
 * Postgres — the plugin (claude-subscription-directsdk) spawns the
 * unmodified CLI per request and its credential store stays in ~/.claude.
 *
 * The login relay: `claude auth login` needs a TTY — runCommand has none,
 * so a detached `script(1)` pty runs it, the printed auth URL is read back
 * from its logfile, and the user's pasted Anthropic code is written to the
 * fifo feeding its stdin. State lives under ~/.hermes/providers/ (per-box
 * scratch, wiped on rebuild — a rebuild means re-signing in, which matches
 * the credential being box-local anyway).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureComputeAwake } from "../compute/awake";
import {
  restartServices,
  runCommand,
  type ComputeTarget,
} from "../compute/runtime";
import { kindFor, profileFor } from "../compute/environments";
import { openSecret, sealSecret } from "../crypto/secretbox";
import { harnessProfile } from "../agent/harness";
import { env } from "../env";
import { log } from "../log";

/** The pinned catalog from the plugin doc — the CLI's own picker replaces
 * this when its initialize handshake is available (MODELS_FILE). */
export const CLAUDE_MODELS: readonly { id: string; label: string }[] = [
  { id: "sonnet", label: "Sonnet 5 · 1M context" },
  { id: "opus", label: "Opus 5.5 · 1M context" },
  { id: "haiku", label: "Haiku 4.5" },
  { id: "claude-opus-5", label: "Opus 5 · 1M context" },
  { id: "claude-opus-4-8", label: "Opus 4.8 · 1M context" },
  { id: "fable", label: "Fable 5.1 · usage-credit plans only" },
];

export const CLAUDE_PROVIDER_ID = "claude-subscription-directsdk-experimental";
const DIR = ".hermes/providers";
const FIFO = `${DIR}/claude-in`;
const LOG = `${DIR}/claude-out.log`;
const MODELS_FILE = `${DIR}/claude-models.json`;

const URL_RE = /https:\/\/[^\s"'<>]+/;

export interface ClaudeStatus {
  connected: boolean;
  accountLabel: string | null;
  models: string[];
  pendingUrl: string | null;
}

export type ClaudeResult =
  | { ok: true; account?: string }
  | { ok: false; error: string };

/** The auth URL `claude auth login` printed, if a login is mid-flight. */
function authUrlFromLog(out: string): string | null {
  const match = URL_RE.exec(out);
  return match ? match[0] : null;
}

async function claudeLoggedIn(target: ComputeTarget): Promise<string | null> {
  const status = await runCommand(target, `claude auth status 2>/dev/null`, 30);
  if (status.exitCode !== 0) return null;
  const text = status.stdout;
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(text)?.[0] ?? null;
  return /logged in|✓|✔/i.test(text) ? email ?? "Claude subscription" : null;
}

/**
 * Kick off `claude auth login` on the box and return the URL to show. When
 * the box lacks the CLI (older template) the caller sees the install note.
 */
export async function beginClaudeLogin(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let target: ComputeTarget;
  try {
    target = await ensureComputeAwake(supabase, userId);
  } catch {
    return {
      ok: false,
      error: "Your agent's computer is starting up — try again in a moment.",
    };
  }
  const already = await claudeLoggedIn(target);
  if (already) {
    const saved = await saveClaudeConnection(supabase, userId, already, null);
    return saved
      ? { ok: true, url: "" }
      : { ok: false, error: "Couldn't save the connection — try again." };
  }
  // pty + fifo relay: script(1) wraps the interactive CLI, its stdout lands
  // in LOG and the finish step writes the pasted code into FIFO. The fifo's
  // write end is held open (exec 3<>) so the CLI never sees EOF.
  const start = await runCommand(
    target,
    [
      `mkdir -p ${DIR}`,
      `rm -f ${FIFO} ${LOG}`,
      `mkfifo ${FIFO}`,
      `nohup bash -c 'exec 3<>${FIFO}; script -qec "claude auth login" <&3 >${LOG} 2>&1' >/dev/null 2>&1 &`,
      `for i in $(seq 1 15); do grep -qo 'https://' ${LOG} 2>/dev/null && break; sleep 1; done`,
      `cat ${LOG} 2>/dev/null`,
    ].join(" && "),
    30
  );
  if (start.exitCode !== 0) {
    log.error("claude login start failed", { user_id: userId,
      error: start.stderr.slice(0, 300) });
    return {
      ok: false,
      error: "Couldn't start Claude sign-in on your computer — try again.",
    };
  }
  const url = authUrlFromLog(start.stdout);
  if (!url) {
    return {
      ok: false,
      error:
        "Claude isn't installed on this computer yet — update to the latest template, or use WZRD Router for now.",
    };
  }
  // Mark the attempt — the sealed blob only carries the URL (Claude's real
  // auth state is box-side); the row makes the pending flow renderable.
  const vaultKey = env.providerVaultKey();
  if (vaultKey) {
    const { error } = await supabase.from("provider_oauth_attempts").upsert(
      {
        user_id: userId,
        provider: "anthropic",
        state: "claude-cli",
        attempt_sealed: sealSecret(JSON.stringify({ url }), vaultKey),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );
    if (error) {
      log.error("claude attempt mark failed", { user_id: userId });
    }
  }
  return { ok: true, url };
}

/**
 * Feed the user's pasted Anthropic code to the waiting `claude auth login`
 * and confirm login. On success the box's config is rebound to the
 * subscription provider and the row mirrors the connection for rendering.
 */
export async function finishClaudeLogin(
  supabase: SupabaseClient,
  userId: string,
  code: string
): Promise<ClaudeResult> {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 512 || /\s/.test(trimmed)) {
    return { ok: false, error: "Paste the code Anthropic showed after sign-in." };
  }
  let target: ComputeTarget;
  try {
    target = await ensureComputeAwake(supabase, userId);
  } catch {
    return {
      ok: false,
      error: "Your agent's computer is starting up — try again in a moment.",
    };
  }
  await runCommand(
    target,
    `[ -p ${FIFO} ] && printf '%s\\n' ${JSON.stringify(trimmed)} > ${FIFO} & sleep 6`,
    30
  );
  const label = await claudeLoggedIn(target);
  if (!label) {
    return {
      ok: false,
      error: "Claude didn't accept that code — start sign-in again.",
    };
  }
  if (!(await applyTokenProvider(supabase, userId, "anthropic"))) {
    return {
      ok: false,
      error: "Signed in, but the switch to Claude failed — try again.",
    };
  }
  const models = await readClaudeModels(target);
  const saved = await saveClaudeConnection(supabase, userId, label, models);
  if (!saved) {
    return { ok: false, error: "Connected, but couldn't save — try again." };
  }
  const { error: _consumed } = await supabase
    .from("provider_oauth_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "anthropic");
  return { ok: true, account: label };
}

async function readClaudeModels(target: ComputeTarget): Promise<string[]> {
  const read = await runCommand(target, `cat ${MODELS_FILE} 2>/dev/null`, 15);
  try {
    const parsed = JSON.parse(read.stdout) as unknown;
    if (Array.isArray(parsed)) {
      const ids = parsed.filter((id): id is string => typeof id === "string");
      if (ids.length > 0) return ids;
    }
  } catch {
    /* pinned catalog */
  }
  return CLAUDE_MODELS.map((model) => model.id);
}

async function saveClaudeConnection(
  supabase: SupabaseClient,
  userId: string,
  accountLabel: string,
  models: string[] | null
): Promise<boolean> {
  const vaultKey = env.providerVaultKey();
  if (!vaultKey) return false;
  // The sealed blob carries no credential — Anthropic OAuth lives in
  // ~/.claude on the box. This row is render metadata + the model cache.
  const { error } = await supabase.from("provider_oauth").upsert(
    {
      user_id: userId,
      provider: "anthropic",
      bundle_sealed: sealSecret(
        JSON.stringify({ kind: "claude-cli", account: accountLabel }),
        vaultKey
      ),
      account_label: accountLabel,
      client_id: null,
      host_id: null,
      id_token_sub: null,
      expires_at: null,
      models_cache: models ?? CLAUDE_MODELS.map((model) => model.id),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  return !error;
}

/**
 * model:-block rewrite done in the box's Hermes python (PyYAML-free line
 * surgery — comments and every other section are preserved byte for byte).
 * Managed keys (default/provider/base_url/api_key) are replaced right under
 * `model:`; the gateway binding is dropped entirely on the Claude lane and
 * restored verbatim when returning to the platform.
 *
 * `delegation` is untouched — its own provider stays on the box's gateway
 * binding, so `model: "fast"` child runs keep resolving server-side on the
 * platform (BYO is the owner-visible lane only).
 */
const REBIND_SCRIPT = String.raw`
import sys
path, default, provider, base_url, api_key = sys.argv[1:6]
lines = open(path).read().splitlines(keepends=True)
managed = ("default:", "provider:", "base_url:", "api_key:")
out, in_model, written = [], False, False
for line in lines:
    stripped = line.strip()
    if line.startswith("model:"):
        in_model = True
        out.append(line)
        out.append(f'  default: "{default}"\n')
        out.append(f'  provider: "{provider}"\n')
        if base_url:
            out.append(f'  base_url: "{base_url}"\n')
            out.append(f'  api_key: "{api_key}"\n')
        written = True
        continue
    if in_model and line and not line.startswith((" ", "\t")) and stripped.endswith(":"):
        in_model = False
    if in_model and any(stripped.startswith(k) for k in managed):
        continue
    out.append(line)
if written:
    open(path, "w").write("".join(out))
    print("rebound")
else:
    sys.exit("no model block")
`;

async function rebindModel(
  target: ComputeTarget,
  provider: string,
  model: string,
  baseUrl: string,
  apiKey: string
): Promise<boolean> {
  const profile = profileFor(target.environment);
  const config = `${profile.homeDir}/.hermes/config.yaml`;
  const python = `${profile.homeDir}/.hermes-venv/bin/python`;
  const script = Buffer.from(REBIND_SCRIPT).toString("base64");
  const res = await runCommand(
    target,
    `${python} -c "import base64,sys; exec(base64.b64decode(sys.argv[1]))" ${script} ${config} ${JSON.stringify(model)} ${JSON.stringify(provider)} ${JSON.stringify(baseUrl)} ${JSON.stringify(apiKey)}`,
    30
  );
  if (res.exitCode !== 0) {
    log.error("model rebind failed", { provider,
      error: res.stderr.slice(0, 300) });
    return false;
  }
  const services = harnessProfile("hermes").services[kindFor(target.environment)];
  const bounce = await restartServices(target, services);
  return bounce.exitCode === 0;
}

/**
 * Apply the owner's token-provider choice to the box's model config:
 *   anthropic → provider = the claude-subscription plugin, default = pin,
 *               gateway binding off (the plugin owns the upstream);
 *   wzrd/openai → provider = custom + the box's own GATEWAY_TOKEN binding —
 *               OpenAI-vs-WZRD differs only server-side (the gateway picks
 *               the upstream Bearer), so the box config is identical.
 */
export async function applyTokenProvider(
  supabase: SupabaseClient,
  userId: string,
  provider: "wzrd" | "openai" | "anthropic",
  model?: string | null
): Promise<boolean> {
  try {
    const target = await ensureComputeAwake(supabase, userId);
    if (provider === "anthropic") {
      return await rebindModel(target, CLAUDE_PROVIDER_ID, model ?? "sonnet", "", "");
    }
    const { data: box } = await supabase
      .from("boxes")
      .select("gateway_token")
      .eq("user_id", userId)
      .maybeSingle();
    const token = (box?.gateway_token as string | null) ?? null;
    if (!token) return false;
    return await rebindModel(
      target,
      "custom",
      "balanced",
      `${env.appOrigin()}/api/gateway/v1`,
      token
    );
  } catch (error) {
    log.error("applyTokenProvider failed", { user_id: userId, provider,
      error: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}

export async function claudeStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<ClaudeStatus> {
  const { data } = await supabase
    .from("provider_oauth")
    .select("account_label, models_cache")
    .eq("user_id", userId)
    .eq("provider", "anthropic")
    .maybeSingle();
  const models = Array.isArray(data?.models_cache)
    ? (data?.models_cache as unknown[]).filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  let pendingUrl: string | null = null;
  if (!data) {
    const { data: attempt } = await supabase
      .from("provider_oauth_attempts")
      .select("attempt_sealed")
      .eq("user_id", userId)
      .eq("provider", "anthropic")
      .maybeSingle();
    const vaultKey = env.providerVaultKey();
    if (attempt && vaultKey) {
      try {
        const parsed = JSON.parse(
          openSecret(String(attempt.attempt_sealed), vaultKey)
        ) as { url?: string };
        pendingUrl = typeof parsed.url === "string" ? parsed.url : null;
      } catch {
        pendingUrl = null;
      }
    }
  }
  return {
    connected: Boolean(data),
    accountLabel: (data?.account_label as string | null) ?? null,
    models,
    pendingUrl,
  };
}

export async function disconnectClaude(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const target = await ensureComputeAwake(supabase, userId);
    await runCommand(
      target,
      `claude auth logout >/dev/null 2>&1; rm -f ${FIFO} ${LOG} ${MODELS_FILE}`,
      30
    );
  } catch (error) {
    log.error("claude disconnect box cleanup failed", { user_id: userId,
      error: error instanceof Error ? error.message : "unknown" });
  }
  // Best-effort restore of the platform binding; the entitlement write is
  // the caller's job and the gateway keeps serving regardless.
  await applyTokenProvider(supabase, userId, "wzrd");
  const { error } = await supabase
    .from("provider_oauth")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "anthropic");
  const { error: _attempt } = await supabase
    .from("provider_oauth_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "anthropic");
  return !error;
}
