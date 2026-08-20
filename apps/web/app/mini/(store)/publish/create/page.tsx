"use client";

/**
 * Mini-App Creator (Phase 3, spec §9): a guided 4-step builder over the
 * publish pipeline that already exists end-to-end. Every call is one the
 * flat publish surface already makes — this page adds guidance, not power:
 *  1. name + appname (reserved-word check from reserved.ts, live
 *     <username>-<appname> slug preview) → POST /api/mini/publish
 *  2. icon upload → POST /api/mini/publish/icon (MA8 guard route)
 *  3. bundle zip upload (validator caps surfaced) or a starter template
 *     from /api/mini/publish/template → POST /api/mini/publish/bundle
 *  4. gates (visibility, password, price, plugin sign-in) →
 *     PATCH /api/mini/publish, then publish → POST /api/mini/publish/status
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isReservedWord } from "@/lib/miniapps/reserved";
import {
  BUNDLE_MAX_FILES,
  BUNDLE_MAX_UNPACKED_BYTES,
  BUNDLE_MAX_ZIP_BYTES,
} from "@/lib/miniapps/bundleLimits";

const APPNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const STEPS = ["Name", "Icon", "Bundle", "Gates & publish"] as const;

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Step 1
  const [appname, setAppname] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState<string | null>(null);

  // Step 2
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  // Step 3
  const [bundleVersion, setBundleVersion] = useState<string | null>(null);

  // Step 4
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [password, setPassword] = useState("");
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState("");
  const [pluginSignin, setPluginSignin] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/mini/publish");
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      const data = (await res.json()) as { username?: string | null };
      setUsername(data.username ?? null);
    })();
  }, []);

  const normalized = appname.toLowerCase().trim();
  const appnameError = useMemo(() => {
    if (!normalized) return null;
    if (!APPNAME_PATTERN.test(normalized)) {
      return "1–32 lowercase letters, digits, or hyphens";
    }
    if (isReservedWord(normalized)) return "that app name is reserved";
    return null;
  }, [normalized]);
  const slugPreview = normalized
    ? `${username ?? "<username>"}-${normalized}`
    : null;

  async function stageDraft() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/mini/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appname: normalized, name, description }),
    });
    const data = (await res.json()) as { error?: string; slug?: string };
    if (res.ok && data.slug) {
      setSlug(data.slug);
      setStep(1);
    } else {
      setMessage(data.error ?? "failed");
    }
    setBusy(false);
  }

  async function uploadIcon(file: File) {
    if (!slug) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("slug", slug);
    form.set("icon", file);
    const res = await fetch("/api/mini/publish/icon", {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { error?: string; icon_url?: string };
    if (res.ok) {
      setIconUrl(data.icon_url ?? null);
      setMessage(null);
    } else {
      setMessage(data.error ?? "icon upload failed");
    }
    setBusy(false);
  }

  async function uploadBundle(file: Blob, label: string) {
    if (!slug) return;
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
    if (res.ok && data.version) {
      setBundleVersion(data.version);
      setMessage(`${label} uploaded (version ${data.version})`);
    } else {
      setMessage(data.error ?? "bundle upload failed");
    }
    setBusy(false);
  }

  async function applyTemplate(templateName: "static" | "todo") {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/mini/publish/template?name=${templateName}`);
    if (!res.ok) {
      setMessage("couldn't fetch the template");
      setBusy(false);
      return;
    }
    const blob = await res.blob();
    setBusy(false);
    await uploadBundle(blob, `${templateName} template`);
  }

  async function saveGatesAndPublish() {
    if (!slug) return;
    setBusy(true);
    setMessage(null);
    const gates = await fetch("/api/mini/publish", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        x402_enabled: priceEnabled,
        x402_price_usdc:
          priceEnabled && price.trim() !== "" ? Number(price) : null,
        plugin_signin_enabled: pluginSignin,
        ...(password ? { password } : {}),
      }),
    });
    if (!gates.ok) {
      const data = (await gates.json()) as { error?: string };
      setMessage(data.error ?? "saving gates failed");
      setBusy(false);
      return;
    }
    const flip = await fetch("/api/mini/publish/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, status: "published", visibility }),
    });
    const data = (await flip.json()) as { error?: string };
    if (flip.ok) {
      setPublished(true);
    } else {
      setMessage(data.error ?? "publish failed");
    }
    setBusy(false);
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
          Create a mini-app
        </h1>
        <Link className="btn-ghost ml-auto text-[12px]" href="/publish">
          Publisher console
        </Link>
      </header>

      <ol className="mb-8 flex gap-2 p-0 text-[12px]">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`list-none rounded-full border border-current px-3 py-1 ${
              i === step ? "" : "text-muted"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {message ? (
        <p className="mb-6 text-[13px] text-muted">{message}</p>
      ) : null}

      {step === 0 ? (
        <section className="panel !p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!appnameError && normalized && name) void stageDraft();
            }}
            className="flex flex-col gap-2"
          >
            <input
              className="input"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="app-name"
              value={appname}
              onChange={(e) => setAppname(e.target.value)}
              required
            />
            {appnameError ? (
              <p className="m-0 text-[12px] text-muted">{appnameError}</p>
            ) : slugPreview ? (
              <p className="m-0 text-[12px] text-muted">
                Your app will live at <code>{slugPreview}</code>
              </p>
            ) : null}
            <textarea
              className="input"
              placeholder="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              className="btn self-start"
              disabled={busy || !!appnameError || !normalized || !name}
              type="submit"
            >
              Stage draft
            </button>
          </form>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="panel flex flex-col gap-3 !p-5">
          <p className="m-0 text-[13px] text-muted">
            PNG, JPEG, or WebP up to 1MB. Square looks best in tile chrome.
          </p>
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconUrl}
              alt="app icon"
              width={48}
              height={48}
              style={{ imageRendering: "pixelated" }}
            />
          ) : null}
          <label className="btn-ghost cursor-pointer self-start text-[12px]">
            {iconUrl ? "Replace icon" : "Upload icon"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadIcon(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="btn text-[12px]"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              {iconUrl ? "Next" : "Skip for now"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel flex flex-col gap-3 !p-5">
          <p className="m-0 text-[13px] text-muted">
            Zip up to {mb(BUNDLE_MAX_ZIP_BYTES)} ({mb(BUNDLE_MAX_UNPACKED_BYTES)}{" "}
            unpacked, {BUNDLE_MAX_FILES} files max). Static files only with an{" "}
            <code>index.html</code> at the root — no service workers, no CSP
            overrides.
          </p>
          <label className="btn-ghost cursor-pointer self-start text-[12px]">
            Upload bundle (.zip)
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadBundle(file, "bundle");
                event.currentTarget.value = "";
              }}
            />
          </label>
          <p className="m-0 text-[13px] text-muted">…or start from a template:</p>
          <div className="flex gap-2">
            <button
              className="btn-ghost text-[12px]"
              disabled={busy}
              onClick={() => void applyTemplate("static")}
            >
              Static page
            </button>
            <button
              className="btn-ghost text-[12px]"
              disabled={busy}
              onClick={() => void applyTemplate("todo")}
            >
              Apps-API to-do
            </button>
          </div>
          <button
            className="btn self-start text-[12px]"
            disabled={busy || !bundleVersion}
            onClick={() => setStep(3)}
          >
            Next
          </button>
        </section>
      ) : null}

      {step === 3 && !published ? (
        <section className="panel flex flex-col gap-3 !p-5">
          <label className="flex items-center gap-2 text-[12px]">
            Visibility
            <select
              className="input !w-auto"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value === "unlisted" ? "unlisted" : "public")
              }
            >
              <option value="public">Public (listed in the store)</option>
              <option value="unlisted">Unlisted (link only)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12px]">
            Password (optional)
            <input
              className="input !w-auto"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="leave blank for none"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={priceEnabled}
              onChange={(e) => setPriceEnabled(e.target.checked)}
            />
            Charge per open (x402)
          </label>
          {priceEnabled ? (
            <label className="flex items-center gap-2 text-[12px]">
              Price (USDC)
              <input
                className="input !w-auto"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.10"
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={pluginSignin}
              onChange={(e) => setPluginSignin(e.target.checked)}
            />
            Require plugin sign-in
          </label>
          <button
            className="btn self-start"
            disabled={busy}
            onClick={() => void saveGatesAndPublish()}
          >
            Publish
          </button>
        </section>
      ) : null}

      {published && slug ? (
        <section className="panel flex flex-col gap-2 !p-5">
          <p className="m-0 text-[14px]">
            Published! Your app is live at <code>{slug}</code>.
          </p>
          <div className="flex gap-2">
            <Link className="btn text-[12px]" href={`/store/${slug}`}>
              View store page
            </Link>
            <Link className="btn-ghost text-[12px]" href="/publish">
              Publisher console
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
