"use client";

/**
 * V11 §5.1 Create surface. The studio (CreateStudio: Chat / Preview /
 * Project, one column in the Messages webview) sits on top; the Drop tile
 * (MC2) and the GitHub import panel (MC7) stay below it as the other two
 * ways in. A file (.html / .zip) or a folder (zipped here, in the browser)
 * goes to POST /api/create/drop; a staged draft — from Drop, import, or a
 * Vibe build — opens in the studio, where the owner's Publish decision lives
 * (CR9). `?app=<slug>` (from an app card) preselects that project.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type DragEvent } from "react";
import { zipFolder } from "@/lib/create/clientZip";
import { BUNDLE_MAX_ZIP_BYTES } from "@/lib/miniapps/bundleLimits";
import {
  CreateStudio,
  Findings,
  type Finding,
} from "@/lib/miniapps/client/create/CreateStudio";
import { GitHubImport } from "./GitHubImport";

interface DropResponse {
  slug: string;
  appname: string;
  version: string;
  url: string;
  preview_url: string | null;
  findings: Finding[];
}

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

type Reply<T> = Partial<T> & { error?: string | undefined };

async function readJson<T>(res: Response): Promise<Reply<T>> {
  const data = (await res.json().catch(() => null)) as Reply<T> | null;
  if (data) return data;
  return { error: res.ok ? "unexpected reply" : `request failed (${res.status})` } as Reply<T>;
}

function CreateSurface() {
  const params = useSearchParams();
  const preselected = params.get("app");
  const githubReturn = params.get("github");
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Finding[]>([]);
  const [slug, setSlug] = useState<string | null>(preselected);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/mini/publish");
      if (res.status === 401) setUnauthorized(true);
    })().catch(() => setMessage("could not reach the server; reload to try again"));
  }, []);

  useEffect(() => {
    if (preselected) setSlug(preselected);
  }, [preselected]);

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
    setSlug(data.slug);
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
    <main className="mx-auto w-full max-w-[1280px] px-6 pb-16 pt-14">
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

      <div className="mb-8">
        <CreateStudio slug={slug} />
      </div>

      <div className="mx-auto max-w-[720px]">
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
            A single .html, a .zip, or a folder with index.html at the root. Up
            to {mb(BUNDLE_MAX_ZIP_BYTES)}. It stays a draft until you publish.
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
                  if (event.currentTarget.files)
                    dropFiles(event.currentTarget.files);
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
                  if (event.currentTarget.files)
                    dropFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </section>

        <GitHubImport returned={githubReturn} onImported={setSlug} />
      </div>
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
