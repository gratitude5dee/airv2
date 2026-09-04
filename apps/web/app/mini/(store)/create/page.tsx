"use client";

/**
 * V11 §5.1 Create surface, MC2 slice: the empty state with the Drop tile.
 * A file (.html / .zip) or a folder (zipped here, in the browser) goes to
 * POST /api/create/drop; the result is a staged draft — preview URL, lint
 * findings, and the owner's Publish decision (CR9). Vibe chat, preview
 * pane, files, and settings are MC4 and appear only as disabled tiles.
 * `?app=<slug>` (from an app card) opens that app's status instead. The
 * Import tile (MC7, GitHub App) lives in GitHubImport and hands the staged
 * draft back here through the same status view.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type DragEvent } from "react";
import { zipFolder } from "@/lib/create/clientZip";
import { BUNDLE_MAX_ZIP_BYTES } from "@/lib/miniapps/bundleLimits";
import { GitHubImport } from "./GitHubImport";

interface Finding {
  rule: string;
  severity?: "hard" | "soft";
  file: string;
  line?: number;
  hint: string;
}

interface DropResponse {
  slug: string;
  appname: string;
  version: string;
  url: string;
  preview_url: string | null;
  findings: Finding[];
}

interface StatusResponse {
  slug: string;
  appname: string;
  name: string;
  status: string;
  url: string;
  preview_url: string | null;
  draft: { version: string; findings: Finding[] } | null;
  live: { version: string } | null;
}

const MC4_TILES = ["Vibe", "Preview", "Files", "Settings"] as const;

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

type Reply<T> = Partial<T> & { error?: string | undefined };

async function readJson<T>(res: Response): Promise<Reply<T>> {
  const data = (await res.json().catch(() => null)) as Reply<T> | null;
  if (data) return data;
  return { error: res.ok ? "unexpected reply" : `request failed (${res.status})` } as Reply<T>;
}

function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="m-0 text-[12px] text-muted">No findings.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {findings.map((f, i) => (
        <li key={`${f.file}:${f.line ?? 0}:${f.rule}:${i}`} className="text-[12px]">
          <code className="text-[11px]">
            {f.file}
            {f.line ? `:${f.line}` : ""}
          </code>{" "}
          <span className="text-muted">{f.rule}</span> — {f.hint}
        </li>
      ))}
    </ul>
  );
}

function DraftResult({
  draft,
  busy,
  onPublish,
}: {
  draft: StatusResponse;
  busy: boolean;
  onPublish: (draft: StatusResponse) => void;
}) {
  const isLive = draft.status === "published";
  const staged =
    draft.draft !== null && draft.draft.version !== draft.live?.version;
  return (
    <section className="panel mb-8 !p-5">
      <div className="flex items-center gap-2">
        <strong className="text-[13px]">{draft.name}</strong>
        <code className="text-[11px] text-muted">{draft.slug}</code>
        <span className="ml-auto rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
          {isLive ? (staged ? "live · draft staged" : "live") : "draft"}
        </span>
      </div>
      <p className="mb-2 mt-1 text-[12px] text-muted">
        {draft.draft ? `version ${draft.draft.version}` : "no version yet"}
        {" · "}
        <a className="underline" href={draft.url} target="_blank" rel="noreferrer">
          {draft.url.replace(/^https?:\/\//, "")}
        </a>
        {isLive ? "" : " (after you publish)"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {draft.preview_url ? (
          <a className="btn text-[12px]" href={draft.preview_url} target="_blank" rel="noreferrer">
            Preview draft
          </a>
        ) : (
          <span className="text-[12px] text-muted">Preview unavailable</span>
        )}
        {!isLive || staged ? (
          <button
            className="btn-ghost text-[12px]"
            disabled={busy || !draft.draft}
            onClick={() => onPublish(draft)}
          >
            {isLive ? "Publish draft" : "Publish"}
          </button>
        ) : null}
        <Link className="btn-ghost text-[12px]" href="/publish">
          Manage in Publish
        </Link>
      </div>
      <div className="mt-3 border-t border-current/10 pt-3">
        <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Findings
        </h3>
        <Findings findings={draft.draft?.findings ?? []} />
      </div>
    </section>
  );
}

function CreateSurface() {
  const params = useSearchParams();
  const preselected = params.get("app");
  const githubReturn = params.get("github");
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Finding[]>([]);
  const [draft, setDraft] = useState<StatusResponse | null>(null);
  const [dragging, setDragging] = useState(false);

  const loadStatus = useCallback(async (slug: string) => {
    const res = await fetch(`/api/create/status?slug=${encodeURIComponent(slug)}`);
    if (res.status === 401) {
      setUnauthorized(true);
      return;
    }
    if (!res.ok) return;
    setDraft((await res.json()) as StatusResponse);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/mini/publish");
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (preselected) await loadStatus(preselected);
    })().catch(() => setMessage("could not reach the server; reload to try again"));
  }, [preselected, loadStatus]);

  /** Runs one owner action with the pickers disabled; any failure surfaces as the message. */
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

  async function drop(file: Blob, filename: string) {
    setRejected([]);
    if (file.size > BUNDLE_MAX_ZIP_BYTES) {
      throw new Error(`that is larger than ${mb(BUNDLE_MAX_ZIP_BYTES)}`);
    }
    const form = new FormData();
    form.set("file", file, filename);
    const res = await fetch("/api/create/drop", { method: "POST", body: form });
    const data = await readJson<DropResponse>(res);
    if (!res.ok || !data.slug) {
      setRejected(data.findings ?? []);
      throw new Error(data.error ?? "drop failed");
    }
    setMessage(`Draft staged: ${data.slug} (${data.version})`);
    // The draft exists either way; a failed refresh must not read as a failed drop.
    await loadStatus(data.slug).catch(() => null);
  }

  function dropFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const single = list[0];
    void run(async () => {
      if (list.length === 1 && single && !single.webkitRelativePath) {
        await drop(single, single.name);
        return;
      }
      setMessage("zipping folder…");
      const zip = await zipFolder(list);
      const root = list[0]?.webkitRelativePath.split("/")[0] || "site";
      await drop(zip, `${root}.zip`);
    });
  }

  /** First publication makes the app public; a live app keeps its visibility. */
  function publish(target: StatusResponse) {
    const { slug } = target;
    void run(async () => {
      const res = await fetch("/api/mini/publish/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          status: "published",
          ...(target.status === "published" ? {} : { visibility: "public" }),
        }),
      });
      const data = await readJson<{ ok: true }>(res);
      if (!res.ok) throw new Error(data.error ?? "publish failed");
      setMessage(`Published: ${slug}`);
      await loadStatus(slug).catch(() => null);
    });
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    dropFiles(event.dataTransfer.files);
  }

  if (unauthorized) {
    return (
      <main className="mx-auto max-w-[720px] px-6 pt-14">
        <p className="text-[14px] text-muted">
          Sign in to create apps.{" "}
          <Link className="underline" href="/login">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pb-16 pt-14">
      <header className="mb-8 flex items-center gap-3">
        <h1 className="m-0 text-[24px] font-semibold tracking-[-0.03em]">
          Create
        </h1>
        <Link className="btn-ghost ml-auto text-[12px]" href="/publish">
          Publish
        </Link>
        <Link className="btn-ghost text-[12px]" href="/">
          Store
        </Link>
      </header>

      {message ? (
        <p className="mb-6 text-[13px] text-muted">{message}</p>
      ) : null}
      {rejected.length > 0 ? (
        <section className="panel mb-8 !p-5">
          <h2 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
            Fix these and drop again
          </h2>
          <Findings findings={rejected} />
        </section>
      ) : null}

      {draft ? <DraftResult draft={draft} busy={busy} onPublish={publish} /> : null}

      <section
        className={`panel mb-8 !p-6 text-center ${dragging ? "outline outline-2 outline-current" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <h2 className="m-0 mb-1 text-[16px] font-semibold tracking-[-0.02em]">
          Drop
        </h2>
        <p className="m-0 mb-4 text-[13px] text-muted">
          A single .html, a .zip, or a folder with index.html at the root. Up to{" "}
          {mb(BUNDLE_MAX_ZIP_BYTES)}. It stays a draft until you publish.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label className="btn cursor-pointer text-[12px]">
            Choose file
            <input
              type="file"
              accept=".html,.zip,text/html,application/zip"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                if (event.currentTarget.files) dropFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="btn-ghost cursor-pointer text-[12px]">
            Choose folder
            <input
              type="file"
              className="hidden"
              disabled={busy}
              // @ts-expect-error webkitdirectory is a non-standard folder picker attribute
              webkitdirectory=""
              multiple
              onChange={(event) => {
                if (event.currentTarget.files) dropFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </section>

      <GitHubImport
        returned={githubReturn}
        onImported={(slug) => {
          loadStatus(slug).catch(() => null);
        }}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MC4_TILES.map((tile) => (
          <div key={tile} className="panel !p-4 text-center opacity-50" aria-disabled>
            <strong className="text-[13px]">{tile}</strong>
            <p className="m-0 mt-1 text-[11px] text-muted">Soon</p>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateSurface />
    </Suspense>
  );
}
