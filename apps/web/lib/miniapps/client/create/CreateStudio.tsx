/**
 * V11 §5.1 Create surface (MC4: Vibe) — the owner's studio for one project.
 * Three regions in a full browser: Chat (prompt → `/api/create/turn`, the
 * run's event stream, the tier picker, the build log), Preview (an iframe on
 * the draft's app origin with device presets and the lite toggle, reloaded
 * whenever `draft_version` changes), and Project (Files, Versions, Functions,
 * Settings, Share). The lite layout is one column: preview,
 * prompt bar, Publish. Every write goes through the existing owner routes —
 * the surface never talks to a Box directly and never sees a model id.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  describeEgressRejection,
  egressHostRejection,
  normalizeEgressHost,
} from "../../../functions/egress";

export interface Finding {
  rule: string;
  severity?: "hard" | "soft";
  file: string;
  line?: number;
  hint: string;
}

interface VersionDetail {
  version: string;
  findings: Finding[];
  bytes?: number;
  files?: number;
  sha256?: string;
  qa_score?: number | null;
}

interface VersionSummary {
  version: string;
  lane: string;
  findings: number;
  qa_score: number | null;
  created_at: string;
  published_at: string | null;
  retired_at: string | null;
}

interface BuildState {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  version: string | null;
  error: string | null;
  findings: Finding[];
  sizes: { total?: number; js_gzip?: number; css_gzip?: number } | null;
  log: string[];
  started_at: string;
  finished_at: string | null;
}

interface BudgetMeter {
  budget_usd: number;
  spent_usd: number;
  remaining_usd: number;
}

export interface StatusResponse {
  slug: string;
  appname: string;
  name: string;
  status: string;
  visibility: string;
  lane: string;
  url: string;
  preview_url: string | null;
  live: VersionDetail | null;
  draft: VersionDetail | null;
  draft_version: string | null;
  qa_score: number | null;
  build: BuildState | null;
  budget: BudgetMeter;
  versions: VersionSummary[];
}

interface FunctionsDeclared {
  entry: string;
  db: boolean;
  kv: boolean;
  egress: string[];
  ai: { dailyCapUsd: number };
}

interface FunctionsApproved {
  egress: string[];
  db: boolean;
  kv: boolean;
  dailyCapUsd: number;
  secretNames: string[];
}

interface FunctionsSecret {
  name: string;
  set_at: string;
  live: boolean;
  draft: boolean;
}

/** Mirrors `functionsStatus` in lib/functions/tab.ts (metadata only). */
interface FunctionsStatus {
  slug: string;
  status: string;
  enabled: boolean;
  killed: boolean;
  killed_by: string | null;
  declared: FunctionsDeclared | null;
  approved: FunctionsApproved | null;
  pending: unknown | null;
  decision_id: string | null;
  resources: { db: string; kv: string };
  secrets: FunctionsSecret[];
  secrets_missing: { live: string[]; draft: string[] };
  cap: {
    daily_usd: number;
    spent_today_usd: number;
    min_usd: number;
    max_usd: number;
  } | null;
  limits: {
    egress_hosts: number;
    secrets: number;
    cpu_ms: number | null;
    subrequests: number | null;
  };
  token_ref: string | null;
  deployed_at: string | null;
  last_error: string | null;
  requests: Array<{ status: number; at: string }>;
}

/** Mirrors `SECRET_NAME_RE` in lib/functions/secrets.ts. */
const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

interface ProjectSummary {
  slug: string;
  appname: string;
  name: string;
  status: string;
  lane: string;
  draft: string | null;
  live: string | null;
}

type Tier = "fast" | "balanced" | "deep";
const TIERS: readonly Tier[] = ["fast", "balanced", "deep"];
const TIER_LABEL: Record<Tier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  deep: "Deep",
};

const DEVICES = [
  { id: "compact", label: "Messages compact", w: 390, h: 360 },
  { id: "expanded", label: "Messages expanded", w: 390, h: 760 },
  { id: "phone", label: "Phone", w: 390, h: 844 },
  { id: "desktop", label: "Desktop", w: 0, h: 0 },
] as const;
type DeviceId = (typeof DEVICES)[number]["id"];

const TABS = ["files", "versions", "functions", "settings", "share"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  files: "Files",
  versions: "Versions",
  functions: "Functions",
  settings: "Settings",
  share: "Share",
};

/** Mirrors `validateAppName` in lib/miniapps/publish.ts: 1–32 chars, no leading or trailing hyphen. */
const APPNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

interface Message {
  role: "owner" | "agent";
  text: string;
  tools?: string[];
  /** Set when the run ended without completing; the text above it is partial. */
  failed?: string;
}

type Reply<T> = Partial<T> & { error?: string; reason?: string };

async function readJson<T>(res: Response): Promise<Reply<T>> {
  const data = (await res.json().catch(() => null)) as Reply<T> | null;
  if (data) return data;
  return {
    error: res.ok ? "unexpected reply" : `request failed (${res.status})`,
  } as Reply<T>;
}

async function postJson<T>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<Reply<T>> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<T>(res);
  if (!res.ok) {
    throw new Error(
      data.reason === "create_budget"
        ? "this project's Create budget is spent — raise it in Settings"
        : (data.error ?? `request failed (${res.status})`),
    );
  }
  return data;
}

function kb(bytes: number | undefined | null): string {
  if (!bytes) return "—";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function useLiteLayout(): boolean {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forced = /[?&]lite=1(?:&|$)/.test(window.location.search);
    const media = window.matchMedia("(max-width: 720px)");
    const read = () => setLite(forced || media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);
  return lite;
}

export function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="m-0 text-[12px] text-muted">No findings.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {findings.map((f, i) => (
        <li
          key={`${f.file}:${f.line ?? 0}:${f.rule}:${i}`}
          className="text-[12px]"
        >
          <code className="text-[11px]">
            {f.file}
            {f.line ? `:${f.line}` : ""}
          </code>{" "}
          <span className="text-muted">{f.rule}</span>
          {f.severity === "hard" ? (
            <span className="text-muted"> (hard)</span>
          ) : null}{" "}
          — {f.hint}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Chat */

function TierPicker({
  tier,
  onChange,
  disabled,
}: {
  tier: Tier;
  onChange: (tier: Tier) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Speed & Intelligence"
    >
      {TIERS.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={tier === t}
          disabled={disabled}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            tier === t ? "border-current" : "border-current/20 text-muted"
          }`}
          onClick={() => onChange(t)}
        >
          {TIER_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function BudgetBar({ budget }: { budget: BudgetMeter }) {
  const pct =
    budget.budget_usd > 0
      ? Math.min(100, (budget.spent_usd / budget.budget_usd) * 100)
      : 100;
  return (
    <div
      className="text-[11px] text-muted"
      title="Create budget for this project"
    >
      <div className="mb-0.5 flex justify-between">
        <span>Budget</span>
        <span>
          {usd(budget.spent_usd)} / {usd(budget.budget_usd)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-current/10">
        <div className="h-full bg-current" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Chat({
  status,
  appname,
  tier,
  busy,
  messages,
  build,
  onTier,
  onSend,
  onAppname,
}: {
  status: StatusResponse | null;
  appname: string;
  tier: Tier;
  busy: boolean;
  messages: Message[];
  build: BuildState | null;
  onTier: (tier: Tier) => void;
  onSend: (text: string) => void;
  onAppname: (appname: string) => void;
}) {
  const [text, setText] = useState("");
  const [showLog, setShowLog] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const log = build?.log ?? [];
  const buildNote =
    build?.status === "failed"
      ? `Build failed${build.error ? `: ${build.error}` : ""}`
      : build?.status === "queued" || build?.status === "running"
        ? `Build ${build.status}…`
        : null;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <section
      className="panel flex min-h-[320px] flex-col !p-4"
      aria-label="Chat"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <strong className="text-[13px]">Chat</strong>
        {status ? (
          <code className="text-[11px] text-muted">
            air-create-{status.appname}
          </code>
        ) : (
          <input
            className="w-40 rounded border border-current/20 bg-transparent px-2 py-0.5 font-mono text-[11px]"
            placeholder="app name (e.g. countdown)"
            value={appname}
            aria-label="App name"
            onChange={(event) =>
              onAppname(event.currentTarget.value.toLowerCase())
            }
          />
        )}
        <div className="ml-auto">
          <TierPicker tier={tier} onChange={onTier} disabled={busy} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 360 }}>
        {messages.length === 0 ? (
          <p className="m-0 text-[12px] text-muted">
            Describe the app in one sentence. The first turn plans it; each turn
            edits, builds, and reloads the preview. Nothing goes live until you
            say so.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`text-[13px] ${m.role === "owner" ? "text-right" : ""}`}
              >
                <div
                  className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-1.5 text-left ${
                    m.role === "owner"
                      ? "bg-current/10"
                      : m.failed
                        ? "border border-red-500/40"
                        : "border border-current/10"
                  }`}
                >
                  {m.text || (busy && i === messages.length - 1 ? "…" : "")}
                  {m.failed ? (
                    <div role="alert" className="mt-1 text-[11px] text-red-500">
                      {m.failed}
                    </div>
                  ) : null}
                  {m.tools && m.tools.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.tools.map((tool, j) => (
                        <span
                          key={`${tool}-${j}`}
                          className="rounded-full border border-current/20 px-1.5 text-[10px] text-muted"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottom} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={submit}>
        <input
          className="flex-1 rounded border border-current/20 bg-transparent px-3 py-1.5 text-[13px]"
          placeholder={
            status
              ? "make the button bigger…"
              : "a countdown to my launch on Friday…"
          }
          value={text}
          aria-label="Prompt"
          disabled={busy}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <button
          className="btn text-[12px]"
          type="submit"
          disabled={busy || !text.trim()}
        >
          {busy ? "Working…" : "Send"}
        </button>
      </form>
      <div className="mt-3 flex flex-col gap-2 border-t border-current/10 pt-3">
        {status ? <BudgetBar budget={status.budget} /> : null}
        {buildNote ? (
          <p
            role={build?.status === "failed" ? "alert" : undefined}
            className={`m-0 text-[11px] ${
              build?.status === "failed" ? "text-red-500" : "text-muted"
            }`}
          >
            {buildNote}
          </p>
        ) : null}
        <button
          type="button"
          className="self-start text-[11px] text-muted underline"
          onClick={() => setShowLog((v) => !v)}
        >
          {showLog ? "Hide build log" : `Build log (${log.length})`}
        </button>
        {showLog ? (
          <pre className="m-0 max-h-40 overflow-auto rounded bg-current/5 p-2 text-[10px] leading-snug">
            {log.length ? log.join("\n") : "no builds yet"}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Preview */

function Preview({
  status,
  previewUrl,
  device,
  lite,
  onDevice,
  onLite,
  onReload,
  compact,
}: {
  status: StatusResponse | null;
  /** Frozen by the studio: changes only on a new draft, a reload or the lite toggle. */
  previewUrl: string | null;
  device: DeviceId;
  lite: boolean;
  onDevice: (device: DeviceId) => void;
  onLite: (lite: boolean) => void;
  onReload: () => void;
  compact: boolean;
}) {
  const preset = DEVICES.find((d) => d.id === device) ?? DEVICES[1];
  const src = useMemo(() => {
    if (!previewUrl) return null;
    const url = new URL(previewUrl);
    if (lite) url.searchParams.set("lite", "1");
    return url.toString();
  }, [previewUrl, lite]);
  const frame = preset.w
    ? { width: preset.w, height: preset.h, maxWidth: "100%" }
    : { width: "100%", height: compact ? 480 : 720 };
  return (
    <section className="panel flex flex-col !p-4" aria-label="Preview">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <strong className="text-[13px]">Preview</strong>
        {status?.draft_version ? (
          <code className="text-[11px] text-muted">{status.draft_version}</code>
        ) : null}
        {status?.qa_score !== null && status?.qa_score !== undefined ? (
          <span className="rounded-full border border-current/20 px-2 text-[10px] text-muted">
            QA {status.qa_score}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {!compact ? (
            <select
              className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-[11px]"
              value={device}
              aria-label="Device preset"
              onChange={(event) =>
                onDevice(event.currentTarget.value as DeviceId)
              }
            >
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                  {d.w ? ` ${d.w}×${d.h}` : ""}
                </option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-1 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={lite}
              onChange={(event) => onLite(event.currentTarget.checked)}
            />
            lite
          </label>
          <button
            type="button"
            className="btn-ghost text-[11px]"
            onClick={onReload}
            disabled={!src}
          >
            Reload
          </button>
          {src ? (
            <a
              className="btn-ghost text-[11px]"
              href={src}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex justify-center overflow-auto rounded-xl bg-black/40 p-3">
        {src ? (
          <iframe
            key={src}
            title="Draft preview"
            src={src}
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
            style={{
              ...frame,
              border: 0,
              borderRadius: 12,
              background: "#000",
            }}
          />
        ) : (
          <p className="m-0 py-16 text-center text-[12px] text-muted">
            {status
              ? "No draft yet — the first build lands here."
              : "Pick or describe an app to preview it."}
          </p>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Project */

interface WorkspaceEntry {
  path: string;
  bytes: number;
}

function FilesTab({
  appname,
  onError,
}: {
  appname: string;
  onError: (message: string) => void;
}) {
  const [files, setFiles] = useState<WorkspaceEntry[] | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/create/files?app=${encodeURIComponent(appname)}`,
      );
      const data = await readJson<{ files: WorkspaceEntry[] }>(res);
      if (!res.ok) throw new Error(data.error ?? "could not list files");
      setFiles(data.files ?? []);
    } catch (error) {
      onError(error instanceof Error ? error.message : "could not list files");
      setFiles([]);
    } finally {
      setBusy(false);
    }
  }, [appname, onError]);

  useEffect(() => {
    setPath(null);
    void list();
  }, [list]);

  async function open(next: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/create/files?app=${encodeURIComponent(appname)}&path=${encodeURIComponent(next)}`,
      );
      const data = await readJson<{ content: string }>(res);
      if (!res.ok || typeof data.content !== "string")
        throw new Error(data.error ?? "could not read file");
      setPath(next);
      setContent(data.content);
      setSaved(data.content);
    } catch (error) {
      onError(error instanceof Error ? error.message : "could not read file");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!path) return;
    setBusy(true);
    try {
      await postJson(
        `/api/create/files?app=${encodeURIComponent(appname)}&path=${encodeURIComponent(path)}`,
        { content },
        "PUT",
      );
      setSaved(content);
    } catch (error) {
      onError(error instanceof Error ? error.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  const dirty = content !== saved;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span>~/.hermes/create/{appname}/</span>
        <button
          type="button"
          className="ml-auto underline"
          onClick={() => void list()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      {files === null ? (
        <p className="m-0 text-[12px] text-muted">Loading…</p>
      ) : files.length === 0 ? (
        <p className="m-0 text-[12px] text-muted">
          No workspace yet — send the first prompt.
        </p>
      ) : (
        <ul className="m-0 max-h-40 list-none overflow-auto p-0 font-mono text-[11px]">
          {files.map((file) => (
            <li key={file.path} className="flex">
              <button
                type="button"
                className={`truncate text-left ${path === file.path ? "underline" : ""}`}
                onClick={() => void open(file.path)}
                disabled={busy}
              >
                {file.path}
              </button>
              <span className="ml-auto pl-2 text-muted">{kb(file.bytes)}</span>
            </li>
          ))}
        </ul>
      )}
      {path ? (
        <>
          <textarea
            className="min-h-[220px] w-full rounded border border-current/20 bg-transparent p-2 font-mono text-[11px] leading-snug"
            value={content}
            spellCheck={false}
            aria-label={`Editing ${path}`}
            onChange={(event) => setContent(event.currentTarget.value)}
          />
          <div className="flex items-center gap-2">
            <code className="text-[11px] text-muted">{path}</code>
            <button
              className="btn ml-auto text-[11px]"
              type="button"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              Save
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function VersionsTab({
  status,
  busy,
  onPreview,
  onMakeLive,
  onRollback,
}: {
  status: StatusResponse;
  busy: boolean;
  onPreview: (version: string) => void;
  onMakeLive: () => void;
  onRollback: (version: string) => void;
}) {
  const live = status.live?.version ?? null;
  const draft = status.draft_version;
  if (status.versions.length === 0) {
    return <p className="m-0 text-[12px] text-muted">No versions yet.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {status.versions.map((row) => {
        const isLive = row.version === live;
        const isDraft = row.version === draft && !isLive;
        return (
          <li
            key={row.version}
            className="rounded border border-current/10 p-2 text-[12px]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-[11px]">{row.version}</code>
              <span className="text-muted">{row.lane}</span>
              {isLive ? (
                <span className="rounded-full border border-current px-2 text-[10px]">
                  live
                </span>
              ) : null}
              {isDraft ? (
                <span className="rounded-full border border-current/30 px-2 text-[10px] text-muted">
                  draft
                </span>
              ) : null}
              {row.retired_at ? (
                <span className="text-[10px] text-muted">retired</span>
              ) : null}
              <span className="ml-auto text-[10px] text-muted">
                {row.findings} finding{row.findings === 1 ? "" : "s"}
                {row.qa_score !== null ? ` · QA ${row.qa_score}` : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {isDraft || isLive ? (
                <button
                  className="btn-ghost text-[11px]"
                  type="button"
                  disabled={busy}
                  onClick={() => onPreview(row.version)}
                >
                  {isLive ? "Open" : "Preview"}
                </button>
              ) : null}
              {isDraft ? (
                <button
                  className="btn text-[11px]"
                  type="button"
                  disabled={busy}
                  onClick={onMakeLive}
                >
                  Make live
                </button>
              ) : null}
              {!isLive && !isDraft && !row.retired_at && live ? (
                <button
                  className="btn-ghost text-[11px]"
                  type="button"
                  disabled={busy}
                  onClick={() => onRollback(row.version)}
                >
                  Roll back
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SettingsTab({
  status,
  busy,
  run,
  onChanged,
}: {
  status: StatusResponse;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(status.name);
  const [budget, setBudget] = useState(String(status.budget.budget_usd));
  const [password, setPassword] = useState("");
  useEffect(() => {
    setName(status.name);
    setBudget(String(status.budget.budget_usd));
  }, [status.name, status.budget.budget_usd]);
  const isLive = status.status === "published";
  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <label className="flex flex-col gap-1">
        <span className="text-muted">Name</span>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-current/20 bg-transparent px-2 py-1"
            value={name}
            maxLength={64}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <button
            className="btn-ghost text-[11px]"
            type="button"
            disabled={busy || !name.trim() || name.trim() === status.name}
            onClick={() =>
              run(async () => {
                await postJson("/api/create/projects", {
                  appname: status.appname,
                  name: name.trim(),
                  description: "",
                });
                await onChanged();
              })
            }
          >
            Save
          </button>
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted">
          Create budget (USD, up to your monthly cap)
        </span>
        <div className="flex gap-2">
          <input
            className="w-28 rounded border border-current/20 bg-transparent px-2 py-1"
            type="number"
            min={0}
            step={0.5}
            value={budget}
            onChange={(event) => setBudget(event.currentTarget.value)}
          />
          <button
            className="btn-ghost text-[11px]"
            type="button"
            disabled={
              busy ||
              Number(budget) === status.budget.budget_usd ||
              !Number.isFinite(Number(budget))
            }
            onClick={() =>
              run(async () => {
                await postJson(
                  "/api/create/projects",
                  { slug: status.slug, create_budget_usd: Number(budget) },
                  "PATCH",
                );
                await onChanged();
              })
            }
          >
            Save
          </button>
        </div>
        <span className="text-[11px] text-muted">
          spent {usd(status.budget.spent_usd)} · remaining{" "}
          {usd(status.budget.remaining_usd)}
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted">Visibility</span>
        <select
          className="w-40 rounded border border-current/20 bg-transparent px-2 py-1"
          value={status.visibility}
          disabled={busy || !isLive}
          onChange={(event) => {
            const visibility = event.currentTarget.value;
            run(async () => {
              await postJson("/api/mini/publish/status", {
                slug: status.slug,
                status: "published",
                visibility,
              });
              await onChanged();
            });
          }}
        >
          <option value="public">public</option>
          <option value="unlisted">unlisted</option>
          <option value="private">private</option>
        </select>
        {!isLive ? (
          <span className="text-[11px] text-muted">
            applies once the app is live
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted">Password (blank clears)</span>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-current/20 bg-transparent px-2 py-1"
            type="password"
            value={password}
            autoComplete="off"
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <button
            className="btn-ghost text-[11px]"
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await postJson(
                  "/api/mini/publish",
                  { slug: status.slug, password: password || null },
                  "PATCH",
                );
                setPassword("");
                await onChanged();
              })
            }
          >
            Set
          </button>
        </div>
      </label>
      {isLive ? (
        <button
          className="btn-ghost self-start text-[11px]"
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await postJson("/api/mini/publish/status", {
                slug: status.slug,
                status: "draft",
              });
              await onChanged();
            })
          }
        >
          Take offline
        </button>
      ) : null}
    </div>
  );
}

/**
 * V11 §5.1 Functions tab. Everything here stages or reads; the only thing
 * that enables a backend is the owner tapping "Enable backend" / "Approve
 * changes", which resolves the `miniapp_backend` decision. Values shown are
 * metadata: hosts, flags, caps, secret *names*, request status codes.
 */
function FunctionsTab({
  status,
  busy,
  run,
  onError,
}: {
  status: StatusResponse;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  onError: (message: string) => void;
}) {
  const [fn, setFn] = useState<FunctionsStatus | null>(null);
  const [hosts, setHosts] = useState("");
  const [cap, setCap] = useState("");
  const [db, setDb] = useState(false);
  const [kv, setKv] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/create/functions?slug=${encodeURIComponent(status.slug)}`,
    );
    const data = await readJson<FunctionsStatus>(res);
    if (!res.ok || data.error) {
      onError(data.error ?? `functions status failed (${res.status})`);
      return;
    }
    const next = data as FunctionsStatus;
    setFn(next);
    setHosts((next.declared?.egress ?? []).join("\n"));
    setCap(String(next.declared?.ai.dailyCapUsd ?? next.cap?.daily_usd ?? 1));
    setDb(next.declared?.db ?? false);
    setKv(next.declared?.kv ?? false);
  }, [status.slug, onError]);

  useEffect(() => {
    void load();
  }, [load, status.draft_version, status.status]);

  const hostList = useMemo(
    () =>
      hosts
        .split(/[\n,\s]+/)
        .map((host) => host.trim())
        .filter(Boolean),
    [hosts],
  );
  const hostProblems = useMemo(() => {
    const problems: string[] = [];
    for (const host of hostList) {
      const rejection = egressHostRejection(host);
      if (rejection) problems.push(`${host} ${describeEgressRejection(rejection)}`);
    }
    if (fn && hostList.length > fn.limits.egress_hosts) {
      problems.push(`at most ${fn.limits.egress_hosts} hosts`);
    }
    return problems;
  }, [hostList, fn]);
  const capNumber = Number(cap);
  const capProblem =
    !Number.isFinite(capNumber) || !fn?.cap
      ? null
      : capNumber < fn.cap.min_usd || capNumber > fn.cap.max_usd
        ? `daily cap must be between ${usd(fn.cap.min_usd)} and ${usd(fn.cap.max_usd)}`
        : capNumber > status.budget.budget_usd
          ? "daily cap cannot exceed this project's monthly budget"
          : null;

  const declaredHosts = (fn?.declared?.egress ?? []).join("\n");
  const dirty =
    fn !== null &&
    (hostList.map(normalizeEgressHost).join("\n") !== declaredHosts ||
      capNumber !== (fn.declared?.ai.dailyCapUsd ?? fn.cap?.daily_usd ?? 1) ||
      db !== (fn.declared?.db ?? false) ||
      kv !== (fn.declared?.kv ?? false));

  if (!fn) {
    return <p className="m-0 text-[12px] text-muted">Loading backend…</p>;
  }
  const hasBackend = fn.declared !== null;
  const needsApproval = fn.decision_id !== null || fn.pending !== null;
  const stateLabel = fn.killed
    ? `killed by ${fn.killed_by ?? "owner"}`
    : fn.enabled
      ? "live"
      : hasBackend
        ? needsApproval
          ? "needs your approval"
          : fn.status
        : "no backend";

  const stage = () =>
    run(async () => {
      await postJson("/api/create/functions", {
        slug: status.slug,
        egress: hostList.map(normalizeEgressHost),
        cap: capNumber,
        db,
        kv,
      });
      await load();
    });

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-current/20 px-2 py-0.5">
          Backend: {stateLabel}
        </span>
        <span className="text-muted">
          database: {fn.resources.db} · kv: {fn.resources.kv}
          {fn.limits.cpu_ms ? ` · ${fn.limits.cpu_ms} ms CPU` : ""}
        </span>
        {fn.last_error ? (
          <span className="text-[11px] text-red-500">{fn.last_error}</span>
        ) : null}
      </div>
      {!hasBackend ? (
        <p className="m-0 text-muted">
          Add <code>functions/index.ts</code> and a <code>functions</code> block
          to <code>air.json</code> (or ask the agent for a backend). The build
          stages it; nothing runs until you approve it here.
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-muted">
          Egress hosts (one per line, exact hostnames, https only, ≤{" "}
          {fn.limits.egress_hosts})
        </span>
        <textarea
          className="min-h-[72px] rounded border border-current/20 bg-transparent px-2 py-1 font-mono"
          value={hosts}
          spellCheck={false}
          onChange={(event) => setHosts(event.currentTarget.value)}
        />
        {hostProblems.map((problem) => (
          <span key={problem} className="text-[11px] text-red-500">
            {problem}
          </span>
        ))}
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-muted">Daily inference cap (USD)</span>
          <input
            className="w-28 rounded border border-current/20 bg-transparent px-2 py-1"
            type="number"
            min={fn.cap?.min_usd ?? 0.05}
            max={fn.cap?.max_usd ?? 5}
            step={0.05}
            value={cap}
            onChange={(event) => setCap(event.currentTarget.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={db}
            onChange={(event) => setDb(event.currentTarget.checked)}
          />
          database
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={kv}
            onChange={(event) => setKv(event.currentTarget.checked)}
          />
          kv
        </label>
        <button
          className="btn-ghost text-[11px]"
          type="button"
          disabled={
            busy ||
            !dirty ||
            hostProblems.length > 0 ||
            capProblem !== null ||
            !Number.isFinite(capNumber)
          }
          onClick={stage}
        >
          Stage changes
        </button>
      </div>
      {capProblem ? (
        <span className="text-[11px] text-red-500">{capProblem}</span>
      ) : null}
      {fn.cap ? (
        <span className="text-[11px] text-muted">
          today {usd(fn.cap.spent_today_usd)} of {usd(fn.cap.daily_usd)}
          {fn.approved
            ? ` · approved: ${fn.approved.egress.length} host${
                fn.approved.egress.length === 1 ? "" : "s"
              }, cap ${usd(fn.approved.dailyCapUsd)}, db ${
                fn.approved.db ? "on" : "off"
              }, kv ${fn.approved.kv ? "on" : "off"}`
            : " · nothing approved yet"}
        </span>
      ) : null}

      {hasBackend ? (
        <div className="flex flex-wrap gap-2">
          {needsApproval || !fn.approved ? (
            <button
              className="btn text-[11px]"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await postJson("/api/create/functions/approve", {
                    slug: status.slug,
                  });
                  await load();
                })
              }
            >
              {fn.approved ? "Approve changes" : "Enable backend"}
            </button>
          ) : null}
          {fn.approved ? (
            <button
              className="btn-ghost text-[11px]"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await postJson("/api/create/functions/kill", {
                    slug: status.slug,
                    killed: !fn.killed,
                  });
                  await load();
                })
              }
            >
              {fn.killed ? "Restore backend" : "Kill switch"}
            </button>
          ) : null}
          {fn.token_ref ? (
            <button
              className="btn-ghost text-[11px]"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await postJson("/api/create/functions/rotate", {
                    slug: status.slug,
                  });
                  await load();
                })
              }
            >
              Rotate runtime token
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-muted">
          Secrets ({fn.secrets.length}/{fn.limits.secrets}) — names only;
          values live in the Worker
        </span>
        {fn.secrets.length === 0 ? (
          <span className="text-[11px] text-muted">none</span>
        ) : (
          <ul className="m-0 list-none p-0">
            {fn.secrets.map((secret) => (
              <li key={secret.name} className="flex items-center gap-2 font-mono">
                <span className="flex-1">{secret.name}</span>
                <span className="text-[11px] text-muted">
                  {secret.set_at ? secret.set_at.slice(0, 10) : ""}
                  {secret.live && secret.draft
                    ? ""
                    : secret.draft
                      ? " · draft only"
                      : secret.live
                        ? " · live only"
                        : " · not deployed"}
                </span>
                <button
                  className="btn-ghost text-[11px]"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await postJson(
                        "/api/create/functions/secrets",
                        { slug: status.slug, name: secret.name },
                        "DELETE",
                      );
                      await load();
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="w-40 rounded border border-current/20 bg-transparent px-2 py-1 font-mono"
            placeholder="API_KEY"
            value={secretName}
            autoComplete="off"
            onChange={(event) =>
              setSecretName(event.currentTarget.value.toUpperCase())
            }
          />
          <input
            className="flex-1 rounded border border-current/20 bg-transparent px-2 py-1"
            type="password"
            placeholder="value"
            value={secretValue}
            autoComplete="off"
            onChange={(event) => setSecretValue(event.currentTarget.value)}
          />
          <button
            className="btn-ghost text-[11px]"
            type="button"
            disabled={
              busy ||
              !hasBackend ||
              !SECRET_NAME_RE.test(secretName) ||
              !secretValue ||
              fn.secrets.length >= fn.limits.secrets
            }
            onClick={() =>
              run(async () => {
                await postJson("/api/create/functions/secrets", {
                  slug: status.slug,
                  name: secretName,
                  value: secretValue,
                });
                setSecretName("");
                setSecretValue("");
                await load();
              })
            }
          >
            Set
          </button>
        </div>
        {secretName && !SECRET_NAME_RE.test(secretName) ? (
          <span className="text-[11px] text-red-500">
            names are UPPER_SNAKE_CASE, starting with a letter
          </span>
        ) : null}
        <span className="text-[11px] text-muted">
          A new or removed name changes what you approved; the build fails if
          a value is pasted into code.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted">Recent requests (status codes)</span>
        {fn.requests.length === 0 ? (
          <span className="text-[11px] text-muted">none yet</span>
        ) : (
          <div className="flex flex-wrap gap-1 font-mono text-[11px]">
            {fn.requests.map((req, index) => (
              <span
                key={`${req.at}-${index}`}
                title={req.at}
                className={`rounded border px-1 ${
                  req.status >= 500
                    ? "border-red-500/60 text-red-500"
                    : req.status >= 400
                      ? "border-amber-500/60 text-amber-600"
                      : "border-current/20"
                }`}
              >
                {req.status}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareTab({ status }: { status: StatusResponse }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setQr(null);
    fetch(`/api/create/qr?slug=${encodeURIComponent(status.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { qr?: string } | null) => {
        if (!cancelled && data?.qr) setQr(data.qr);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status.slug]);
  const isLive = status.status === "published";
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <a
        className="underline"
        href={status.url}
        target="_blank"
        rel="noreferrer"
      >
        {status.url.replace(/^https?:\/\//, "")}
      </a>
      {!isLive ? (
        <p className="m-0 text-muted">
          The link works once you make a version live.
        </p>
      ) : null}
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL; nothing to optimize
        <img
          src={qr}
          alt={`QR code for ${status.url}`}
          width={160}
          height={160}
          className="rounded bg-white p-2"
        />
      ) : (
        <p className="m-0 text-muted">QR unavailable.</p>
      )}
      <button
        className="btn-ghost self-start text-[11px]"
        type="button"
        onClick={() => void navigator.clipboard?.writeText(status.url)}
      >
        Copy link
      </button>
    </div>
  );
}

function Project({
  status,
  busy,
  run,
  refresh,
  onError,
  onPreview,
}: {
  status: StatusResponse;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  refresh: () => Promise<void>;
  onError: (message: string) => void;
  onPreview: (version: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("versions");
  const staged =
    status.draft !== null && status.draft.version !== status.live?.version;
  return (
    <section className="panel !p-4" aria-label="Project">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <strong className="text-[13px]">{status.name}</strong>
        <code className="text-[11px] text-muted">{status.slug}</code>
        <span className="ml-auto rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
          {status.status === "published"
            ? staged
              ? "live · draft staged"
              : "live"
            : "draft"}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              tab === t ? "border-current" : "border-current/20 text-muted"
            }`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === "files" ? (
        <FilesTab appname={status.appname} onError={onError} />
      ) : null}
      {tab === "versions" ? (
        <VersionsTab
          status={status}
          busy={busy}
          onPreview={onPreview}
          onMakeLive={() =>
            run(async () => {
              await postJson("/api/mini/publish/status", {
                slug: status.slug,
                status: "published",
                ...(status.status === "published"
                  ? {}
                  : { visibility: "public" }),
              });
              await refresh();
            })
          }
          onRollback={(version) =>
            run(async () => {
              await postJson("/api/create/rollback", {
                slug: status.slug,
                version,
              });
              await refresh();
            })
          }
        />
      ) : null}
      {tab === "functions" ? (
        <FunctionsTab status={status} busy={busy} run={run} onError={onError} />
      ) : null}
      {tab === "settings" ? (
        <SettingsTab
          status={status}
          busy={busy}
          run={run}
          onChanged={refresh}
        />
      ) : null}
      {tab === "share" ? <ShareTab status={status} /> : null}
    </section>
  );
}

/* ---------------------------------------------------------------- Studio */

export interface CreateStudioProps {
  /** Project preselected from an app card (`?app=<slug>`). */
  slug: string | null;
}

export function CreateStudio({ slug: initialSlug }: CreateStudioProps) {
  const liteLayout = useLiteLayout();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [appname, setAppname] = useState("");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tier, setTier] = useState<Tier>("balanced");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceId>("expanded");
  const [lite, setLite] = useState(false);
  // The iframe src. A preview URL carries a 60 s owner token that the app
  // origin swaps for a cookie on first load, so the src is pinned here and
  // replaced only when a new draft lands or the owner asks for a reload —
  // never on an ordinary status poll, which would discard the draft's state.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const events = useRef<EventSource | null>(null);
  // Bumped on every project switch; a turn started under an older value
  // belongs to a conversation the owner has left and is dropped on arrival.
  const turnGeneration = useRef(0);
  const lastDraft = useRef<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/create/projects");
    if (!res.ok) return;
    const data = (await res.json()) as { projects?: ProjectSummary[] };
    setProjects(data.projects ?? []);
  }, []);

  const loadStatus = useCallback(
    async (target: string, { remountPreview = false } = {}) => {
      const res = await fetch(
        `/api/create/status?slug=${encodeURIComponent(target)}`,
      );
      if (!res.ok) return;
      const next = (await res.json()) as StatusResponse;
      setStatus(next);
      const newDraft = next.draft_version !== lastDraft.current;
      lastDraft.current = next.draft_version;
      if (newDraft || remountPreview) setPreviewUrl(next.preview_url);
    },
    [],
  );

  useEffect(() => {
    void loadProjects();
    fetch("/api/create/tier")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { speed_tier?: string } | null) => {
        if (
          data?.speed_tier &&
          (TIERS as readonly string[]).includes(data.speed_tier)
        ) {
          setTier(data.speed_tier as Tier);
        }
      })
      .catch(() => undefined);
  }, [loadProjects]);

  useEffect(() => {
    setStatus(null);
    setPreviewUrl(null);
    lastDraft.current = null;
    if (slug)
      void loadStatus(slug).catch(() =>
        setMessage("could not load that project"),
      );
  }, [slug, loadStatus]);

  // An owner switching projects starts a fresh conversation. The first turn
  // of a new project also assigns the slug (via `send`), and must keep the
  // in-flight exchange — so the reset lives here, not in the slug effect.
  function selectProject(next: string | null) {
    if (next === slug) return;
    turnGeneration.current += 1;
    events.current?.close();
    setMessages([]);
    setBusy(false);
    setSlug(next);
  }

  // A parent-driven project change (deep link, tile) is a switch like any other.
  const seenInitialSlug = useRef(initialSlug);
  useEffect(() => {
    if (initialSlug === seenInitialSlug.current) return;
    seenInitialSlug.current = initialSlug;
    selectProject(initialSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to the prop, never to the slug it sets
  }, [initialSlug]);

  useEffect(() => () => events.current?.close(), []);

  const refresh = useCallback(async () => {
    await Promise.all([
      slug ? loadStatus(slug) : Promise.resolve(),
      loadProjects(),
    ]);
  }, [slug, loadStatus, loadProjects]);

  // Builds land out of band (iMessage turns, `air-create build` from the Box),
  // so the status is polled: quickly while a build is in flight, slowly otherwise.
  const buildInFlight =
    status?.build?.status === "queued" || status?.build?.status === "running";
  useEffect(() => {
    if (!slug) return;
    const tick = () => {
      if (document.visibilityState === "visible")
        void loadStatus(slug).catch(() => undefined);
    };
    const id = setInterval(tick, buildInFlight ? 4_000 : 15_000);
    return () => clearInterval(id);
  }, [slug, buildInFlight, loadStatus]);

  function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    action()
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : "something went wrong",
        );
      })
      .finally(() => setBusy(false));
  }

  function changeTier(next: Tier) {
    const previous = tier;
    setTier(next);
    postJson("/api/create/tier", { speed_tier: next }, "PUT").catch(() => {
      setTier(previous);
      setMessage("could not change the tier");
    });
  }

  function send(text: string) {
    const target = status?.appname ?? appname.trim().toLowerCase();
    if (!APPNAME_RE.test(target)) {
      setMessage(
        "pick an app name first: 1–32 lowercase letters, digits or hyphens, not starting or ending with a hyphen",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    setMessages((m) => [
      ...m,
      { role: "owner", text },
      { role: "agent", text: "" },
    ]);
    const generation = turnGeneration.current;
    const stale = () => generation !== turnGeneration.current;
    postJson<{ run_id: string; slug: string }>("/api/create/turn", {
      appname: target,
      input: text,
      tier,
      ...(status ? { session: `air-create-${status.appname}` } : {}),
    })
      .then((turn) => {
        if (stale()) return;
        if (!turn.run_id || !turn.slug) throw new Error("no run started");
        if (turn.slug !== slug) setSlug(turn.slug);
        const stream = new EventSource(
          `/api/create/events/${encodeURIComponent(turn.run_id)}`,
        );
        events.current?.close();
        events.current = stream;
        let acc = "";
        const tools: string[] = [];
        const update = (text: string, failed?: string) =>
          setMessages((m) => {
            const last = m[m.length - 1];
            if (!last || last.role !== "agent") return m;
            return [
              ...m.slice(0, -1),
              {
                role: "agent",
                text,
                ...(tools.length ? { tools: [...tools] } : {}),
                ...(failed ? { failed } : {}),
              },
            ];
          });
        const finish = (fallback: string, failed?: string) => {
          stream.close();
          setBusy(false);
          if (failed) {
            update(acc, failed);
            setMessage(failed);
          } else if (!acc) update(fallback);
          void refresh().catch(() => undefined);
        };
        stream.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data) as {
              event?: string;
              delta?: string;
              output?: string;
              tool?: string;
            };
            if (parsed.event === "tool.started" && parsed.tool) {
              if (tools[tools.length - 1] !== parsed.tool)
                tools.push(parsed.tool);
              update(acc);
              // A build landed mid-run: pick up the new draft without waiting for the turn to end.
              if (/air-create|build/.test(parsed.tool))
                void refresh().catch(() => undefined);
            }
            if (parsed.event === "message.delta" && parsed.delta) {
              acc += parsed.delta;
              update(acc);
            }
            if (parsed.event === "run.completed") {
              if (!acc && parsed.output) acc = parsed.output;
              finish(acc || "(no reply)");
            }
            if (parsed.event === "run.failed")
              finish("", "The run failed before it finished.");
          } catch {
            /* keep-alive or non-JSON frame */
          }
        };
        stream.onerror = () => finish("", "Lost the connection to the run.");
      })
      .catch((error: unknown) => {
        if (stale()) return;
        setMessages((m) => m.slice(0, -1));
        setBusy(false);
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : "could not start the turn",
        );
      });
  }

  /** The draft previews through a fresh owner-only app token; live opens
   * the public URL. Older versions have no origin to preview on (§13.1). */
  function previewVersion(version: string) {
    if (!status) return;
    if (version === status.live?.version) {
      window.open(status.url, "_blank", "noopener");
      return;
    }
    run(async () => {
      const data = await postJson<{ preview_url: string }>(
        "/api/create/preview-link",
        { slug: status.slug },
      );
      if (data.preview_url) window.open(data.preview_url, "_blank", "noopener");
    });
  }

  /** A preview token lives 60 s, so a reload is a status refresh (fresh token) plus a remount. */
  function reloadPreview() {
    if (!slug) return;
    void loadStatus(slug, { remountPreview: true }).catch(() => undefined);
  }

  /** The lite toggle re-enters the app origin, so it needs a fresh token too. */
  function toggleLite(next: boolean) {
    setLite(next);
    reloadPreview();
  }

  const build = status?.build ?? null;
  const drafts = projects.filter((p) => p.slug !== slug);

  const picker = (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
      <span className="text-muted">Project</span>
      <select
        className="rounded border border-current/20 bg-transparent px-2 py-1 text-[12px]"
        value={slug ?? ""}
        aria-label="Project"
        onChange={(event) => selectProject(event.currentTarget.value || null)}
      >
        <option value="">New app…</option>
        {projects.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name} ({p.appname}) · {p.status}
          </option>
        ))}
      </select>
      {status ? (
        <span className="text-muted">
          {status.lane} · {status.versions.length} version
          {status.versions.length === 1 ? "" : "s"}
        </span>
      ) : null}
      {message ? <span className="ml-auto text-muted">{message}</span> : null}
    </div>
  );

  if (liteLayout) {
    return (
      <div>
        {picker}
        <div className="flex flex-col gap-3">
          <Preview
            status={status}
            previewUrl={previewUrl}
            device="compact"
            lite={true}
            onDevice={() => undefined}
            onLite={() => undefined}
            onReload={reloadPreview}
            compact
          />
          <Chat
            status={status}
            appname={appname}
            tier={tier}
            busy={busy}
            messages={messages}
            build={build}
            onTier={changeTier}
            onSend={send}
            onAppname={setAppname}
          />
          {status?.draft && status.draft.version !== status.live?.version ? (
            <button
              className="btn text-[13px]"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await postJson("/api/mini/publish/status", {
                    slug: status.slug,
                    status: "published",
                    ...(status.status === "published"
                      ? {}
                      : { visibility: "public" }),
                  });
                  await refresh();
                })
              }
            >
              Publish {status.draft.version}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      {picker}
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)_minmax(280px,1fr)]">
        <Chat
          status={status}
          appname={appname}
          tier={tier}
          busy={busy}
          messages={messages}
          build={build}
          onTier={changeTier}
          onSend={send}
          onAppname={setAppname}
        />
        <Preview
          status={status}
          previewUrl={previewUrl}
          device={device}
          lite={lite}
          onDevice={setDevice}
          onLite={toggleLite}
          onReload={reloadPreview}
          compact={false}
        />
        {status ? (
          <Project
            status={status}
            busy={busy}
            run={run}
            refresh={refresh}
            onError={setMessage}
            onPreview={previewVersion}
          />
        ) : (
          <section className="panel !p-4" aria-label="Project">
            <strong className="text-[13px]">Your drafts</strong>
            {drafts.length === 0 ? (
              <p className="m-0 mt-2 text-[12px] text-muted">
                Nothing yet. Drop a file or describe an app.
              </p>
            ) : (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[12px]">
                {drafts.map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => selectProject(p.slug)}
                    >
                      {p.name}
                    </button>{" "}
                    <span className="text-muted">
                      {p.lane} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
