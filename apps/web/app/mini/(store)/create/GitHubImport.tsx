"use client";

/**
 * V11 §11 Lane C on the Create surface: Connect GitHub (the WZRD App), pick
 * a repository and branch, read the Repo Scan, then Import. Static trees
 * stage a draft at once; projects that build first show the workflow file
 * we would commit and wait for the owner's yes. Every push after that
 * refreshes the draft; publishing stays a separate owner action (CR9).
 */
import { useCallback, useEffect, useState } from "react";

interface Installation {
  installation_id: number;
  account_login: string;
  account_type: "User" | "Organization";
  suspended: boolean;
}

interface RepoLink {
  slug: string | null;
  url: string | null;
  full_name: string;
  branch: string;
  dir: string;
  mode: "static" | "build";
  workflow_path: string | null;
  last_sha: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

interface GitHubState {
  configured: boolean;
  installations: Installation[];
  links: RepoLink[];
}

interface Repository {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
}

interface Plan {
  full_name: string;
  branch: string;
  dir: string;
  sha: string;
  appname: string;
  plan: {
    mode: "static" | "build";
    framework: string | null;
    packageManager: string | null;
    buildCommand: string | null;
    outputDir: string | null;
    envVars: string[];
    notes: string[];
  };
  files: number;
  skipped: string[];
  workflow_path: string | null;
  workflow: string | null;
}

interface ImportResponse {
  slug: string;
  appname: string;
  mode: "static" | "build";
  version: string | null;
  url: string;
  preview_url: string | null;
  workflow_path: string | null;
}

type Reply<T> = Partial<T> & { error?: string | undefined };

async function readJson<T>(res: Response): Promise<Reply<T>> {
  const data = (await res.json().catch(() => null)) as Reply<T> | null;
  if (data) return data;
  return { error: res.ok ? "unexpected reply" : `request failed (${res.status})` } as Reply<T>;
}

const RETURN_MESSAGES: Record<string, string> = {
  connected: "GitHub connected. Pick a repository below.",
  state: "That GitHub return link expired; connect again.",
  taken: "That GitHub installation is already connected to another account.",
  github: "GitHub did not confirm the installation; try again.",
  invalid: "GitHub returned an unexpected response; try again.",
};

function short(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "—";
}

function PlanView({ plan }: { plan: Plan }) {
  const p = plan.plan;
  return (
    <div className="mt-3 border-t border-current/10 pt-3 text-[12px]">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-muted">mode</span> {p.mode}
        </span>
        {p.framework ? (
          <span>
            <span className="text-muted">framework</span> {p.framework}
          </span>
        ) : null}
        {p.packageManager ? (
          <span>
            <span className="text-muted">install</span> {p.packageManager}
          </span>
        ) : null}
        {p.buildCommand ? (
          <span>
            <span className="text-muted">build</span> <code>{p.buildCommand}</code>
          </span>
        ) : null}
        {p.outputDir ? (
          <span>
            <span className="text-muted">output</span> <code>{p.outputDir}</code>
          </span>
        ) : null}
        <span>
          <span className="text-muted">commit</span> <code>{short(plan.sha)}</code>
        </span>
        {p.mode === "static" ? (
          <span>
            <span className="text-muted">files</span> {plan.files}
          </span>
        ) : null}
      </div>
      {p.envVars.length > 0 ? (
        <p className="m-0 mt-2">
          <span className="text-muted">env</span> {p.envVars.join(", ")}
        </p>
      ) : null}
      {p.notes.length > 0 ? (
        <ul className="m-0 mt-2 list-disc pl-4">
          {p.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {plan.workflow ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-muted">
            Workflow we would add at <code>{plan.workflow_path}</code>
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded border border-current/10 p-2 text-[11px]">
            {plan.workflow}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function GitHubImport({
  returned,
  onImported,
}: {
  /** `?github=` outcome from the setup return, if any. */
  returned: string | null;
  onImported: (slug: string) => void;
}) {
  const [state, setState] = useState<GitHubState | null>(null);
  const [message, setMessage] = useState<string | null>(
    returned ? (RETURN_MESSAGES[returned] ?? null) : null
  );
  const [busy, setBusy] = useState(false);
  const [installation, setInstallation] = useState<number | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repo, setRepo] = useState<string>("");
  const [branch, setBranch] = useState("");
  const [dir, setDir] = useState("");
  const [appname, setAppname] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/create/github");
    if (!res.ok) return;
    const data = (await res.json()) as GitHubState;
    setState(data);
    const first = data.installations.find((i) => !i.suspended);
    setInstallation((current) => current ?? first?.installation_id ?? null);
  }, []);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  useEffect(() => {
    if (installation === null) return;
    setRepos([]);
    setRepo("");
    const controller = new AbortController();
    fetch(`/api/create/github/repos?installation=${installation}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await readJson<{ repositories: Repository[]; truncated?: boolean }>(res);
        if (!res.ok) throw new Error(data.error ?? "could not list repositories");
        if (controller.signal.aborted) return;
        setRepos(data.repositories ?? []);
        setMessage(
          data.truncated
            ? "Only the first repositories are listed — narrow the installation to the repositories you want to import."
            : null
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error ? error.message : "could not list repositories");
      });
    return () => controller.abort();
  }, [installation]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function selectRepo(fullName: string) {
    setRepo(fullName);
    setPlan(null);
    const chosen = repos.find((r) => r.full_name === fullName);
    setBranch(chosen?.default_branch ?? "");
    setAppname(
      fullName
        .split("/")[1]!
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32)
    );
  }

  function body(extra: Record<string, unknown>) {
    return JSON.stringify({
      installation_id: installation,
      full_name: repo,
      branch: branch || undefined,
      dir: dir || undefined,
      appname: appname || undefined,
      ...extra,
    });
  }

  function scan() {
    void run(async () => {
      setPlan(null);
      const res = await fetch("/api/create/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ preview: true }),
      });
      const data = await readJson<Plan>(res);
      if (!res.ok || !data.plan) throw new Error(data.error ?? "scan failed");
      setPlan(data as Plan);
    });
  }

  function doImport(confirmWorkflow: boolean) {
    void run(async () => {
      const res = await fetch("/api/create/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(confirmWorkflow ? { confirm_workflow: true } : {}),
      });
      const data = await readJson<ImportResponse>(res);
      if (!res.ok || !data.slug) throw new Error(data.error ?? "import failed");
      setMessage(
        data.mode === "build"
          ? `Linked ${repo}: the first draft arrives when its Actions run finishes.`
          : `Draft staged from ${repo} (${data.version ?? "no version"}).`
      );
      setPlan(null);
      await load().catch(() => null);
      onImported(data.slug);
    });
  }

  function unlink(link: RepoLink) {
    if (!link.slug) return;
    void run(async () => {
      const res = await fetch(`/api/create/import?slug=${encodeURIComponent(link.slug!)}`, {
        method: "DELETE",
      });
      const data = await readJson<{ ok: true }>(res);
      if (!res.ok) throw new Error(data.error ?? "unlink failed");
      setMessage(`Unlinked ${link.full_name}; the app and its versions stay.`);
      await load().catch(() => null);
    });
  }

  if (!state) return null;

  if (!state.configured) {
    return (
      <section className="panel mb-8 !p-6">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Import from GitHub</h2>
          <button className="btn-ghost ml-auto text-[12px]" disabled title="GitHub import is not set up on this Air yet">
            Connect GitHub
          </button>
        </div>
        <p className="m-0 mt-1 text-[13px] text-muted">
          Connecting a repository is not available yet — the WZRD GitHub App has not been set up on
          this Air. Drop a folder or zip above to publish in the meantime.
        </p>
      </section>
    );
  }

  const active = state.installations.filter((i) => !i.suspended);

  return (
    <section className="panel mb-8 !p-6">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Import from GitHub</h2>
        {/* Full navigation, not a client transition: the route 302s to GitHub's install screen. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn-ghost ml-auto text-[12px]" href="/api/create/github/connect">
          {active.length > 0 ? "Add another account" : "Connect GitHub"}
        </a>
      </div>
      <p className="m-0 mt-1 text-[13px] text-muted">
        Pick a repository; every push to its branch refreshes your draft. Nothing goes live
        until you publish.
      </p>
      {message ? <p className="mb-0 mt-3 text-[13px] text-muted">{message}</p> : null}

      {state.links.length > 0 ? (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {state.links.map((link) => (
            <li
              key={`${link.full_name}:${link.branch}:${link.dir}`}
              className="flex flex-wrap items-center gap-2 text-[12px]"
            >
              <code>{link.full_name}</code>
              <span className="text-muted">
                {link.branch}
                {link.dir ? `/${link.dir}` : ""} · {link.mode}
              </span>
              {link.url ? (
                <a className="underline" href={link.url} target="_blank" rel="noreferrer">
                  {link.slug}
                </a>
              ) : null}
              <span className="text-muted">
                {link.last_error
                  ? `last push failed: ${link.last_error}`
                  : link.last_sha
                    ? `synced ${short(link.last_sha)}`
                    : "waiting for first build"}
              </span>
              <button
                className="btn-ghost ml-auto text-[11px]"
                disabled={busy || !link.slug}
                onClick={() => unlink(link)}
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {active.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {active.length > 1 ? (
            <select
              className="input text-[12px]"
              value={installation ?? ""}
              disabled={busy}
              onChange={(event) => setInstallation(Number(event.currentTarget.value))}
            >
              {active.map((i) => (
                <option key={i.installation_id} value={i.installation_id}>
                  {i.account_login}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="input text-[12px]"
            value={repo}
            disabled={busy || repos.length === 0}
            onChange={(event) => selectRepo(event.currentTarget.value)}
          >
            <option value="">{repos.length === 0 ? "Loading repositories…" : "Repository"}</option>
            {repos.map((r) => (
              <option key={r.id} value={r.full_name}>
                {r.full_name}
                {r.private ? " (private)" : ""}
              </option>
            ))}
          </select>
          <input
            className="input text-[12px]"
            placeholder="branch"
            value={branch}
            disabled={busy || !repo}
            onChange={(event) => {
              setBranch(event.currentTarget.value);
              setPlan(null);
            }}
          />
          <input
            className="input text-[12px]"
            placeholder="subfolder (optional)"
            value={dir}
            disabled={busy || !repo}
            onChange={(event) => {
              setDir(event.currentTarget.value);
              setPlan(null);
            }}
          />
          <input
            className="input text-[12px]"
            placeholder="app name"
            value={appname}
            disabled={busy || !repo}
            onChange={(event) => setAppname(event.currentTarget.value)}
          />
          <div className="flex items-center gap-2">
            <button className="btn text-[12px]" disabled={busy || !repo} onClick={scan}>
              Scan
            </button>
            {plan ? (
              plan.plan.mode === "static" ? (
                <button className="btn-ghost text-[12px]" disabled={busy} onClick={() => doImport(false)}>
                  Import
                </button>
              ) : (
                <button className="btn-ghost text-[12px]" disabled={busy} onClick={() => doImport(true)}>
                  Add workflow and import
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {plan ? <PlanView plan={plan} /> : null}
    </section>
  );
}
