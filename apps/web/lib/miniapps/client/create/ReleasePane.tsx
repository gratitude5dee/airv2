/**
 * V12 §5.4 Release pane. Dev: the link.wzrd.tech URL, its expiry and
 * **Renew** / **Revoke** through `POST /api/create/release` (§6.3). Production:
 * the finalize form (§9.1 — name, description, icon, mirror, store) and
 * **Request publish**, which files the `miniapp_publish` decision through
 * `POST /api/create/finalize` once that route exists; the decision itself is
 * approved in Needs-you, never here (CR9). The pane holds only metadata: a
 * URL, a timestamp, the owner's own form values.
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  DESCRIPTION_MAX,
  FINALIZE_AVAILABLE,
  ICON_ROUTE,
  postForm,
  FINALIZE_ROUTE,
  NAME_MAX,
  expiryCopy,
  finalizeProblem,
  iconProblem,
  postJson,
  stageLabel,
  type DevRelease,
  type IntakeStatus,
} from "./panes";

export interface ReleasePaneProps {
  appname: string;
  /** The app's display name, the finalize default (§9.1). */
  name: string;
  /** The `dev` block of the extended status when the control plane sends it. */
  dev: DevRelease | null;
  intake: IntakeStatus | null;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  /** Re-read status and intake after a release or finalize call. */
  onChanged: () => Promise<void>;
}

const FIELD =
  "min-h-[44px] w-full rounded border border-current/20 bg-transparent px-3 py-2 text-[13px]";

export function ReleasePane({
  appname,
  name: initialName,
  dev: statusDev,
  intake,
  busy,
  run,
  onChanged,
}: ReleasePaneProps) {
  // The release reply is the freshest word on the dev channel; the status
  // poll catches up on its own cadence and wins once it lands, including a
  // null after a revoke or an expiry.
  const [dev, setDev] = useState<DevRelease | null>(statusDev);
  useEffect(() => {
    setDev(statusDev);
  }, [statusDev]);
  // The plan's name is the default answer; a rename from the status wins over
  // an untouched field, never over what the owner typed here.
  const [name, setName] = useState(initialName);
  const [nameTouched, setNameTouched] = useState(false);
  useEffect(() => {
    if (!nameTouched) setName(initialName);
  }, [initialName, nameTouched]);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [mirror, setMirror] = useState(true);
  const [store, setStore] = useState<"listed" | "unlisted">("listed");
  const stage = intake?.stage ?? null;

  function release(action: "renew" | "revoke") {
    run(async () => {
      const reply = await postJson<DevRelease>("/api/create/release", {
        app: appname,
        channel: "dev",
        action,
      });
      setDev({
        version: reply.version ?? null,
        url: reply.url ?? null,
        expires_at: reply.expires_at ?? null,
      });
      await onChanged();
    });
  }

  const iconIssue = iconProblem(icon);
  const formIssue = finalizeProblem({ stage, name, description });
  const blocked = !FINALIZE_AVAILABLE
    ? "publish request opens when the finalize route lands; say ship it in Messages"
    : (formIssue ?? iconIssue);

  function requestPublish(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;
    run(async () => {
      // §9.2: the icon goes up first; finalize then carries its key.
      let iconKey: string | null = null;
      if (icon) {
        const form = new FormData();
        form.set("appname", appname);
        form.set("icon", icon, icon.name);
        const uploaded = await postForm<{ icon_key?: string }>(ICON_ROUTE, form);
        iconKey = uploaded.icon_key ?? null;
      }
      await postJson(FINALIZE_ROUTE, {
        app: appname,
        name: name.trim(),
        description: description.trim(),
        ...(iconKey ? { icon_key: iconKey } : {}),
        mirror,
        store,
      });
      setIcon(null);
      await onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-4 text-[12px]" aria-label="Release">
      <section className="flex flex-col gap-2" aria-label="Dev">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[13px]">Dev</strong>
          <span className="rounded-full border border-current px-2 py-0.5 text-[10px]">
            {stageLabel(stage)}
          </span>
        </div>
        {dev?.url ? (
          <>
            <a
              className="break-all underline"
              href={dev.url}
              target="_blank"
              rel="noopener noreferrer"
              data-test="dev-url"
            >
              {dev.url.replace(/^https?:\/\//, "")}
            </a>
            <p className="m-0 text-muted" data-test="dev-expiry">
              {dev.version ? `${dev.version} · ` : ""}
              {expiryCopy(dev.expires_at)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn min-h-[44px] text-[12px]"
                disabled={busy}
                onClick={() => release("renew")}
              >
                Renew
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] text-[12px]"
                disabled={busy}
                onClick={() => release("revoke")}
              >
                Revoke
              </button>
            </div>
          </>
        ) : (
          <p className="m-0 text-muted">
            No dev build yet. The first passing build goes on your dev link.
          </p>
        )}
      </section>

      <form
        className="flex flex-col gap-2 border-t border-current/10 pt-3"
        aria-label="Production"
        onSubmit={requestPublish}
      >
        <strong className="text-[13px]">Production</strong>
        <p className="m-0 text-muted">
          Three answers, then a decision card. The decision is approved in
          Needs-you.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-muted">
            Name · {name.trim().length}/{NAME_MAX}
          </span>
          <input
            className={FIELD}
            data-test="finalize-name"
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => {
              setNameTouched(true);
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">
            Description · {description.trim().length}/{DESCRIPTION_MAX}
          </span>
          <input
            className={FIELD}
            data-test="finalize-description"
            maxLength={DESCRIPTION_MAX}
            placeholder="one line"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">Icon · PNG, JPEG or WebP under 2 MB</span>
          <input
            className="min-h-[44px] text-[12px]"
            type="file"
            data-test="finalize-icon"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) =>
              setIcon(event.currentTarget.files?.[0] ?? null)
            }
          />
          {iconIssue ? (
            <span role="alert" className="text-red-500">
              {iconIssue}
            </span>
          ) : icon ? (
            <span className="text-muted">
              {icon.name} · upload lands when publish is requested
            </span>
          ) : null}
        </label>
        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={mirror}
            onChange={(event) => setMirror(event.currentTarget.checked)}
          />
          <span>Mirror the source to GitHub, public and MIT</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted">App Store</span>
          <select
            className={FIELD}
            value={store}
            onChange={(event) =>
              setStore(event.currentTarget.value as "listed" | "unlisted")
            }
          >
            <option value="listed">listed</option>
            <option value="unlisted">unlisted</option>
          </select>
        </label>
        <button
          type="submit"
          className="btn min-h-[44px] text-[12px]"
          disabled={busy || blocked !== null}
        >
          Request publish
        </button>
        {blocked ? <p className="m-0 text-muted">{blocked}</p> : null}
      </form>
    </div>
  );
}
