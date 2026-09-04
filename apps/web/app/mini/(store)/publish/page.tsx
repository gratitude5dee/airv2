"use client";

/**
 * MA3 Publish surface (store session required — the API returns 401 and we
 * point at /login). Stage drafts, upload bundle zips, flip status (the owner
 * decision), and see x402 earnings. All writes go through /api/mini/publish*.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PublishedApp {
  slug: string;
  name: string;
  description: string;
  status: string;
  visibility: string;
  bundle_version: string | null;
  draft_version?: string | null;
  agent_identity: string | null;
  access: "single" | "multiplayer";
  x402_enabled: boolean;
  x402_price_usdc: number | null;
  plugin_signin_enabled: boolean;
  has_password: boolean;
}

interface EarningsRow {
  slug: string;
  name: string;
  receipts: number;
  total_usdc: number;
}

export default function PublishPage() {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/mini/publish");
    if (res.status === 401) {
      setUnauthorized(true);
      return;
    }
    const data = (await res.json()) as {
      apps?: PublishedApp[];
      earnings?: EarningsRow[];
    };
    setApps(data.apps ?? []);
    setEarnings(data.earnings ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createDraft(form: FormData) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/mini/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appname: form.get("appname"),
        name: form.get("name"),
        description: form.get("description"),
        agentIdentity: form.get("agentIdentity") || null,
      }),
    });
    const data = (await res.json()) as { error?: string; slug?: string };
    setMessage(res.ok ? `Draft staged: ${data.slug}` : data.error ?? "failed");
    setBusy(false);
    void refresh();
  }

  async function uploadBundle(slug: string, file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("slug", slug);
    form.set("bundle", file);
    const res = await fetch("/api/mini/publish/bundle", {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { error?: string; version?: string };
    setMessage(
      res.ok ? `Bundle uploaded: ${data.version}` : data.error ?? "failed"
    );
    setBusy(false);
    void refresh();
  }

  /** First publication makes the app public; a live app keeps its visibility. */
  async function flipStatus(app: PublishedApp, status: "published" | "draft") {
    setBusy(true);
    setMessage(null);
    const firstPublish = status === "published" && app.status !== "published";
    const res = await fetch("/api/mini/publish/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: app.slug,
        status,
        ...(firstPublish ? { visibility: "public" } : {}),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setMessage(res.ok ? `Now ${status}: ${app.slug}` : data.error ?? "failed");
    setBusy(false);
    void refresh();
  }

  async function saveGates(slug: string, form: FormData) {
    setBusy(true);
    setMessage(null);
    const price = String(form.get("x402_price_usdc") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const clearPassword = form.get("clear_password") === "on";
    const res = await fetch("/api/mini/publish", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        access: form.get("access"),
        x402_enabled: form.get("x402_enabled") === "on",
        x402_price_usdc: price === "" ? null : Number(price),
        plugin_signin_enabled: form.get("plugin_signin_enabled") === "on",
        ...(clearPassword
          ? { password: null }
          : password
            ? { password }
            : {}),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setMessage(res.ok ? `Gates saved: ${slug}` : data.error ?? "failed");
    setBusy(false);
    void refresh();
  }

  if (unauthorized) {
    return (
      <main className="mx-auto max-w-[720px] px-6 pt-14">
        <p className="text-[14px] text-muted">
          Sign in to publish apps.{" "}
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
          Publish
        </h1>
        <Link className="btn ml-auto text-[12px]" href="/publish/create">
          Create an app
        </Link>
        <Link className="btn-ghost text-[12px]" href="/">
          Store
        </Link>
      </header>

      {message ? (
        <p className="mb-6 text-[13px] text-muted">{message}</p>
      ) : null}

      <section className="panel mb-8 !p-5">
        <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
          New app
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createDraft(new FormData(event.currentTarget));
          }}
          className="flex flex-col gap-2"
        >
          <input className="input" name="appname" placeholder="app-name (slug becomes username-app-name)" required />
          <input className="input" name="name" placeholder="Display name" required />
          <textarea className="input" name="description" placeholder="Description" rows={2} />
          <input className="input" name="agentIdentity" placeholder="Agent identity URL (agent card / ERC-8004, optional)" />
          <button className="btn self-start" disabled={busy} type="submit">
            Stage draft
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
          Your apps
        </h2>
        {apps.length === 0 ? (
          <p className="text-[13px] text-muted">No apps yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {apps.map((app) => (
              <div key={app.slug} className="panel !p-4">
                <div className="flex items-center gap-2">
                  <strong className="text-[13px]">{app.name}</strong>
                  <code className="text-[11px] text-muted">{app.slug}</code>
                  <span className="ml-auto rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
                    {app.status}
                  </span>
                </div>
                <p className="mb-2 mt-1 text-[12px] text-muted">
                  {app.bundle_version
                    ? `bundle ${app.bundle_version}`
                    : "no bundle uploaded"}
                  {app.draft_version && app.draft_version !== app.bundle_version
                    ? ` · draft ${app.draft_version} staged`
                    : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn-ghost cursor-pointer text-[12px]">
                    Upload bundle (.zip)
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void uploadBundle(app.slug, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {app.status === "published" ? (
                    <>
                      {app.draft_version && app.draft_version !== app.bundle_version ? (
                        <button
                          className="btn text-[12px]"
                          disabled={busy}
                          onClick={() => void flipStatus(app, "published")}
                        >
                          Publish draft
                        </button>
                      ) : null}
                      <button
                        className="btn-ghost text-[12px]"
                        disabled={busy}
                        onClick={() => void flipStatus(app, "draft")}
                      >
                        Unpublish
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn text-[12px]"
                      disabled={busy || !app.bundle_version}
                      onClick={() => void flipStatus(app, "published")}
                    >
                      Publish
                    </button>
                  )}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveGates(app.slug, new FormData(event.currentTarget));
                  }}
                  className="mt-3 flex flex-col gap-2 border-t border-current/10 pt-3"
                >
                  <label className="flex items-center gap-2 text-[12px]">
                    Access
                    <select
                      className="input !w-auto"
                      name="access"
                      defaultValue={app.access}
                    >
                      <option value="single">Single (owner only)</option>
                      <option value="multiplayer">Multiplayer (guests)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      name="x402_enabled"
                      defaultChecked={app.x402_enabled}
                    />
                    Charge per open (x402)
                    <input
                      className="input !w-32"
                      name="x402_price_usdc"
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="Price (USDC)"
                      defaultValue={app.x402_price_usdc ?? ""}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      className="input !w-48"
                      name="password"
                      type="password"
                      autoComplete="off"
                      maxLength={200}
                      placeholder={
                        app.has_password
                          ? "New password (blank keeps current)"
                          : "Password (optional)"
                      }
                    />
                    {app.has_password ? (
                      <span className="flex items-center gap-1 text-muted">
                        <input type="checkbox" name="clear_password" />
                        Remove password
                      </span>
                    ) : null}
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      name="plugin_signin_enabled"
                      defaultChecked={app.plugin_signin_enabled}
                    />
                    Plugin sign-in
                  </label>
                  <button
                    className="btn-ghost self-start text-[12px]"
                    disabled={busy}
                    type="submit"
                  >
                    Save gates
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
          Earnings (x402)
        </h2>
        {earnings.length === 0 ? (
          <p className="text-[13px] text-muted">No receipts yet.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1">App</th>
                <th className="py-1">Receipts</th>
                <th className="py-1">Total USDC</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((row) => (
                <tr key={row.slug}>
                  <td className="py-1">{row.name}</td>
                  <td className="py-1">{row.receipts}</td>
                  <td className="py-1">{row.total_usdc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[12px]">
          {/* Route handler download, not a page navigation. */}
          <a
            className="underline"
            href="/api/mini/publish/earnings?format=csv"
            download="earnings.csv"
          >
            Download CSV
          </a>
        </p>
      </section>
    </main>
  );
}
