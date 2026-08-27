"use client";

/**
 * V2 Vault tab. Metadata renders instantly from the Postgres mirror (no box
 * wake); the first reveal/edit wakes the box through the API (standard 429
 * messaging). Reveals are per-field, auto-rehide after 30s, and are audited
 * server-side. Raw values live only in component state for the visible
 * window — never in localStorage, analytics, or logs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { PixelIcon, type PixelGlyph } from "@/components/dither-kit/icon";
import {
  luhnValid,
  normalizeExpiryYear,
  paymentCardBrand,
} from "@/lib/vault/payment-card";
import { useDialogFocus } from "./use-dialog";

export interface VaultItem {
  id: string;
  kind: "login" | "card" | "api_key" | "note" | "identity";
  name: string;
  masked: string | null;
  env_var: string | null;
  totp_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface ManagerStatus {
  manager: "bitwarden" | "onepassword" | "command";
  enabled: boolean;
  status: "off" | "configured" | "error";
  provenance_count: number | null;
  warnings: string | null;
  last_synced_at: string | null;
}

const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
const BUSY_BOX_NOTE =
  "Your agent's computer is busy starting up — try again in a minute.";

const SECTIONS: {
  kind: "login" | "card" | "api_key" | "note";
  header: string;
  addLabel: string;
  glyph: PixelGlyph;
}[] = [
  { kind: "login", header: "LOGINS", addLabel: "Add a login…", glyph: "people" },
  { kind: "card", header: "CARDS", addLabel: "Add a card…", glyph: "card" },
  { kind: "api_key", header: "API KEYS", addLabel: "Add an API key…", glyph: "key" },
  { kind: "note", header: "NOTES", addLabel: "Add a note…", glyph: "note" },
];

const FIELDS_BY_KIND: Record<string, { field: string; label: string }[]> = {
  login: [
    { field: "username", label: "Username" },
    { field: "password", label: "Password" },
    { field: "site_url", label: "Site URL" },
  ],
  card: [
    { field: "number", label: "Card number" },
    { field: "expiry_month", label: "Expiry month" },
    { field: "expiry_year", label: "Expiry year" },
    { field: "cvv", label: "CVV" },
    { field: "zip", label: "Billing ZIP" },
  ],
  api_key: [{ field: "value", label: "Key" }],
  note: [{ field: "note", label: "Note" }],
  identity: [],
};

// Card shape rules are shared with the API route that validates them
// (lib/vault/payment-card.ts) so the form and the server agree.
export { luhnValid };
export const cardBrand = paymentCardBrand;

async function readError(res: Response): Promise<string> {
  if (res.status === 429) return BUSY_BOX_NOTE;
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  return body?.message ?? body?.error ?? "request failed";
}

export function VaultPanel() {
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);

  // Which detail sheet is open, keyed by item id.
  const [openId, setOpenId] = useState<string | null>(null);
  // Revealed values: `${itemId}:${field}` → value. Timers rehide after 30s.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [modal, setModal] = useState<
    | { kind: "login" | "card" | "api_key" | "note"; editing: VaultItem | null }
    | null
  >(null);

  // Env-inject restart prompt (appears after a successful binding change).
  const [restartPrompt, setRestartPrompt] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);

  const [managers, setManagers] = useState<ManagerStatus[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [itemsRes, managersRes] = await Promise.all([
        fetch("/api/vault"),
        fetch("/api/vault/managers"),
      ]);
      if (itemsRes.ok) {
        const body = (await itemsRes.json()) as { items: VaultItem[] };
        setItems(body.items);
      } else {
        setItems((current) => current ?? []);
        setNote("could not load vault");
      }
      if (managersRes.ok) {
        const body = (await managersRes.json()) as {
          managers: ManagerStatus[];
        };
        setManagers(body.managers);
      }
    } catch {
      setItems((current) => current ?? []);
      setNote("could not load vault");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  function hide(key: string) {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const timer = timers.current[key];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[key];
    }
  }

  async function revealField(item: VaultItem, field: string) {
    const key = `${item.id}:${field}`;
    if (revealed[key] !== undefined) {
      hide(key);
      return;
    }
    setNote(null);
    try {
      const res = await fetch(
        `/api/vault/${encodeURIComponent(item.id)}/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        }
      );
      if (!res.ok) {
        setNote(await readError(res));
        return;
      }
      const body = (await res.json()) as { value: string };
      setRevealed((prev) => ({ ...prev, [key]: body.value }));
      // Auto-rehide after 30 seconds.
      timers.current[key] = setTimeout(() => hide(key), 30_000);
    } catch {
      setNote("reveal failed");
    }
  }

  async function copyField(item: VaultItem, field: string) {
    const key = `${item.id}:${field}`;
    let value = revealed[key];
    if (value === undefined) {
      try {
        const res = await fetch(
          `/api/vault/${encodeURIComponent(item.id)}/reveal`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field }),
          }
        );
        if (!res.ok) {
          setNote(await readError(res));
          return;
        }
        value = ((await res.json()) as { value: string }).value;
      } catch {
        setNote("copy failed");
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(value);
      setNote("copied");
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(null), 1500);
    } catch {
      setNote("clipboard unavailable");
    }
  }

  async function deleteItem(item: VaultItem) {
    if (!window.confirm(`Delete "${item.name}" from your vault?`)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/vault", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) {
        setNote(await readError(res));
        return;
      }
      setOpenId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setEnvBinding(item: VaultItem, envVar: string | null) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/vault", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, item: { env_var: envVar } }),
      });
      if (!res.ok) {
        setNote(await readError(res));
        return;
      }
      await load();
      setRestartPrompt(true);
    } finally {
      setBusy(false);
    }
  }

  async function restartNow() {
    setRestartBusy(true);
    try {
      const res = await fetch("/api/vault/restart", { method: "POST" });
      if (!res.ok) setNote(await readError(res));
      else setRestartPrompt(false);
    } finally {
      setRestartBusy(false);
    }
  }

  const byKind = (kind: VaultItem["kind"]) =>
    (items ?? []).filter((item) => item.kind === kind);

  if (items === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Orb size={28} />
      </div>
    );
  }

  return (
    <div className="grid flex-1 content-start gap-4 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Vault</h3>
      {note ? <p className="muted m-0 text-[13px]">{note}</p> : null}

      {SECTIONS.map((section) => {
        const rows = byKind(section.kind);
        return (
          <section key={section.kind} className="grid gap-1.5">
            <h4 className="muted m-0 text-[11px] font-semibold tracking-widest">
              {section.header}
            </h4>
            {rows.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                glyph={section.glyph}
                open={openId === item.id}
                revealed={revealed}
                busy={busy}
                onToggle={() =>
                  setOpenId(openId === item.id ? null : item.id)
                }
                onReveal={(field) => void revealField(item, field)}
                onCopy={(field) => void copyField(item, field)}
                onEdit={() => setModal({ kind: section.kind, editing: item })}
                onDelete={() => void deleteItem(item)}
                onEnvBinding={(envVar) => void setEnvBinding(item, envVar)}
              />
            ))}
            {/* Dashed empty/add affordance row */}
            <button
              type="button"
              className="muted cursor-pointer rounded-xl border border-dashed border-[var(--ring)] bg-transparent px-3 py-2.5 text-left text-[13px]"
              onClick={() => setModal({ kind: section.kind, editing: null })}
            >
              {section.addLabel}
            </button>
          </section>
        );
      })}

      {restartPrompt ? (
        <div className="panel flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-[13px]">
            takes effect next boot — restart now?
          </span>
          <span className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={() => setRestartPrompt(false)}
            >
              Later
            </button>
            <button
              className="btn"
              disabled={restartBusy}
              onClick={() => void restartNow()}
            >
              {restartBusy ? "Restarting…" : "Restart now"}
            </button>
          </span>
        </div>
      ) : null}

      <ManagersPanel
        managers={managers}
        onChanged={(next) => setManagers(next)}
        setNote={setNote}
      />

      {modal ? (
        <VaultModal
          kind={modal.kind}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  glyph,
  open,
  revealed,
  busy,
  onToggle,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
  onEnvBinding,
}: {
  item: VaultItem;
  glyph: PixelGlyph;
  open: boolean;
  revealed: Record<string, string>;
  busy: boolean;
  onToggle: () => void;
  onReveal: (field: string) => void;
  onCopy: (field: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onEnvBinding: (envVar: string | null) => void;
}) {
  const [envInput, setEnvInput] = useState(item.env_var ?? "");
  const [envError, setEnvError] = useState<string | null>(null);
  const envValid = envInput === "" || ENV_NAME_RE.test(envInput);
  const fields = FIELDS_BY_KIND[item.kind] ?? [];
  return (
    <div className="panel grid gap-0 p-0">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2.5 text-left"
        onClick={onToggle}
      >
        <PixelIcon glyph={glyph} size={14} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-[13px] font-medium">{item.name}</span>
          {item.masked ? (
            <span className="muted truncate text-[12px]">{item.masked}</span>
          ) : null}
        </span>
        {item.kind === "api_key" && item.env_var ? (
          <span className="muted rounded-full border border-[var(--ring)] px-2 py-0.5 text-[11px]">
            → agent env (from AIR Vault)
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-[var(--ring)] px-3 py-2.5">
          {fields.map(({ field, label }) => {
            const key = `${item.id}:${field}`;
            const value = revealed[key];
            return (
              <div key={field} className="flex items-center gap-2">
                <span className="muted w-28 shrink-0 text-[12px]">{label}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  {value !== undefined ? value : "••••••••"}
                </span>
                <button
                  className="btn-ghost text-[12px]"
                  aria-label={`${value !== undefined ? "Hide" : "Reveal"} ${label}`}
                  onClick={() => onReveal(field)}
                >
                  <PixelIcon
                    glyph={value !== undefined ? "eyeoff" : "eye"}
                    size={14}
                  />
                </button>
                <button
                  className="btn-ghost text-[12px]"
                  aria-label={`Copy ${label}`}
                  onClick={() => onCopy(field)}
                >
                  Copy
                </button>
              </div>
            );
          })}
          {item.totp_enabled ? (
            <div className="flex items-center gap-2">
              <span className="muted w-28 shrink-0 text-[12px]">TOTP code</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                {revealed[`${item.id}:totp`] ?? "••••••"}
              </span>
              <button
                className="btn-ghost text-[12px]"
                onClick={() => onReveal("totp")}
              >
                <PixelIcon
                  glyph={
                    revealed[`${item.id}:totp`] !== undefined
                      ? "eyeoff"
                      : "eye"
                  }
                  size={14}
                />
              </button>
            </div>
          ) : null}
          {item.kind === "api_key" ? (
            <div className="grid gap-1.5">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={item.env_var !== null}
                  disabled={busy}
                  onChange={(event) => {
                    if (event.target.checked) {
                      if (ENV_NAME_RE.test(envInput)) {
                        setEnvError(null);
                        onEnvBinding(envInput);
                      } else {
                        setEnvError(
                          "Enter a variable name matching [A-Z_][A-Z0-9_]* first"
                        );
                      }
                    } else {
                      setEnvError(null);
                      onEnvBinding(null);
                    }
                  }}
                />
                Inject as env
              </label>
              <input
                className="input font-mono text-[13px]"
                placeholder="ENV_VAR_NAME"
                value={envInput}
                onChange={(event) => {
                  setEnvError(null);
                  setEnvInput(event.target.value.toUpperCase());
                }}
                onBlur={() => {
                  if (
                    item.env_var !== null &&
                    ENV_NAME_RE.test(envInput) &&
                    envInput !== item.env_var
                  ) {
                    onEnvBinding(envInput);
                  }
                }}
              />
              {!envValid || envError ? (
                <p className="m-0 text-[12px] text-red-500">
                  {envError ?? "Must match [A-Z_][A-Z0-9_]*"}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost text-[13px]" onClick={onEdit}>
              Edit
            </button>
            <button
              className="btn-ghost text-[13px]"
              disabled={busy}
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VaultModal({
  kind,
  editing,
  onClose,
  onSaved,
}: {
  kind: "login" | "card" | "api_key" | "note";
  editing: VaultItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const [error, setError] = useState<string | null>(null);

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [more, setMore] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [totpSeed, setTotpSeed] = useState("");

  // Card
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [zip, setZip] = useState("");

  // API key / note
  const [keyValue, setKeyValue] = useState("");
  const [envVar, setEnvVar] = useState(editing?.env_var ?? "");
  const [noteText, setNoteText] = useState("");

  const digits = cardNumber.replace(/\D/g, "");
  const brand = cardBrand(digits);
  const luhnOk = digits.length === 0 || luhnValid(digits);

  const title =
    kind === "login"
      ? editing
        ? "Edit login"
        : "Add login"
      : kind === "card"
        ? editing
          ? "Edit card"
          : "Add card"
        : kind === "api_key"
          ? editing
            ? "Edit API key"
            : "Add API key"
          : editing
            ? "Edit note"
            : "Add note";

  async function save() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Name is required");
      return;
    }
    const fields: Record<string, string> = {};
    if (kind === "login") {
      if (username) fields["username"] = username;
      if (password) fields["password"] = password;
      if (siteUrl) fields["site_url"] = siteUrl;
    } else if (kind === "card") {
      if (!editing && !luhnValid(digits)) {
        setError("Card number failed the Luhn check");
        return;
      }
      if (digits) fields["number"] = digits;
      if (expiryMonth) fields["expiry_month"] = expiryMonth.replace(/\D/g, "");
      if (expiryYear) fields["expiry_year"] = normalizeExpiryYear(expiryYear);
      if (cvv) fields["cvv"] = cvv.replace(/\D/g, "");
      if (zip) fields["zip"] = zip.replace(/\D/g, "");
    } else if (kind === "api_key") {
      if (keyValue) fields["value"] = keyValue;
      if (envVar && !ENV_NAME_RE.test(envVar)) {
        setError("Env var must match [A-Z_][A-Z0-9_]*");
        return;
      }
    } else if (kind === "note") {
      if (noteText) fields["note"] = noteText;
    }
    setBusy(true);
    try {
      const item: Record<string, unknown> = { name: name.trim() };
      if (Object.keys(fields).length > 0) item["fields"] = fields;
      if (kind === "api_key") item["env_var"] = envVar || null;
      if (kind === "login" && totpSeed) item["totp_seed"] = totpSeed;
      let res: Response;
      if (editing) {
        res = await fetch("/api/vault", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, item }),
        });
      } else {
        item["kind"] = kind;
        res = await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item }),
        });
      }
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      onSaved();
    } catch {
      setError("save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="panel grid w-full max-w-md gap-3 bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-0.5">
          <h3 className="m-0 text-[15px] font-semibold">{title}</h3>
          <p className="muted m-0 text-[12px]">
            Values are encrypted in your vault.
          </p>
        </div>

        <label className="grid gap-1 text-[13px]">
          Name
          <input
            className="input"
            placeholder={
              kind === "login"
                ? 'e.g. "Gmail", "GitHub"'
                : kind === "card"
                  ? 'e.g. "Amex", "Chase"'
                  : kind === "api_key"
                    ? 'e.g. "OpenAI key"'
                    : 'e.g. "Wifi password"'
            }
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        {kind === "login" ? (
          <>
            <label className="grid gap-1 text-[13px]">
              Username
              <input
                className="input"
                value={username}
                autoComplete="off"
                placeholder={editing ? "unchanged if blank" : undefined}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[13px]">
              <span className="flex items-center gap-1.5"><PixelIcon glyph="lock" size={11} /> Password</span>
              <span className="flex gap-1.5">
                <input
                  className="input flex-1"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="new-password"
                  placeholder={editing ? "unchanged if blank" : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <PixelIcon glyph={showPassword ? "eyeoff" : "eye"} size={14} />
                </button>
              </span>
            </label>
            <button
              type="button"
              className="muted cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] underline decoration-dotted underline-offset-2"
              onClick={() => setMore(!more)}
            >
              More {more ? "▴" : "▾"}
            </button>
            {more ? (
              <>
                <label className="grid gap-1 text-[13px]">
                  Site URL
                  <input
                    className="input"
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-[13px]">
                  TOTP secret
                  <input
                    className="input font-mono"
                    value={totpSeed}
                    autoComplete="off"
                    onChange={(event) => setTotpSeed(event.target.value)}
                  />
                </label>
              </>
            ) : null}
          </>
        ) : null}

        {kind === "card" ? (
          <>
            <label className="grid gap-1 text-[13px]">
              <span className="flex items-center gap-1.5"><PixelIcon glyph="lock" size={11} /> Card number</span>
              <span className="flex items-center gap-1.5">
                <input
                  className="input flex-1 font-mono"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cardNumber}
                  placeholder={editing ? "unchanged if blank" : undefined}
                  onChange={(event) =>
                    setCardNumber(event.target.value.replace(/[^\d ]/g, ""))
                  }
                />
                {brand ? (
                  <span className="muted rounded-full border border-[var(--ring)] px-2 py-0.5 text-[11px]">
                    {brand}
                  </span>
                ) : null}
              </span>
              {!luhnOk ? (
                <span className="text-[12px] text-red-500">
                  This number fails the Luhn check
                </span>
              ) : null}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[13px]">
                Expiry month
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={2}
                  value={expiryMonth}
                  onChange={(event) =>
                    setExpiryMonth(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              <label className="grid gap-1 text-[13px]">
                Expiry year
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  value={expiryYear}
                  onChange={(event) =>
                    setExpiryYear(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[13px]">
                <span className="flex items-center gap-1.5"><PixelIcon glyph="lock" size={11} /> CVV</span>
                <input
                  className="input font-mono"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={cvv}
                  onChange={(event) =>
                    setCvv(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              <label className="grid gap-1 text-[13px]">
                Billing ZIP
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  value={zip}
                  onChange={(event) =>
                    setZip(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            </div>
          </>
        ) : null}

        {kind === "api_key" ? (
          <>
            <label className="grid gap-1 text-[13px]">
              <span className="flex items-center gap-1.5"><PixelIcon glyph="lock" size={11} /> Key</span>
              <input
                className="input font-mono"
                type="password"
                autoComplete="off"
                value={keyValue}
                placeholder={editing ? "unchanged if blank" : undefined}
                onChange={(event) => setKeyValue(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[13px]">
              Inject as env (optional)
              <input
                className="input font-mono"
                placeholder="ENV_VAR_NAME"
                value={envVar}
                onChange={(event) =>
                  setEnvVar(event.target.value.toUpperCase())
                }
              />
            </label>
          </>
        ) : null}

        {kind === "note" ? (
          <label className="grid gap-1 text-[13px]">
            <span className="flex items-center gap-1.5"><PixelIcon glyph="lock" size={11} /> Note</span>
            <textarea
              className="input min-h-24"
              value={noteText}
              placeholder={editing ? "unchanged if blank" : undefined}
              onChange={(event) => setNoteText(event.target.value)}
            />
          </label>
        ) : null}

        {error ? <p className="m-0 text-[13px] text-red-500">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MANAGER_META: Record<
  ManagerStatus["manager"],
  { title: string; blurb: string }
> = {
  bitwarden: {
    title: "Bitwarden Secrets Manager",
    blurb: "Machine-account token + project — secrets fetched at agent boot.",
  },
  onepassword: {
    title: "1Password",
    blurb: "Service-account token; map op:// references to env vars.",
  },
  command: {
    title: "Command helper",
    blurb: "Advanced: a helper command your agent runs to fetch secrets.",
  },
};

function ManagersPanel({
  managers,
  onChanged,
  setNote,
}: {
  managers: ManagerStatus[] | null;
  onChanged: (next: ManagerStatus[]) => void;
  setNote: (note: string | null) => void;
}) {
  const [openForm, setOpenForm] = useState<ManagerStatus["manager"] | null>(
    null
  );
  const [token, setToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [helperCommand, setHelperCommand] = useState("");
  const [mapEnv, setMapEnv] = useState("");
  const [mapRef, setMapRef] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Credentials are per-provider; never carry a typed token across forms.
  function openManagerForm(manager: ManagerStatus["manager"] | null) {
    setToken("");
    setProjectId("");
    setHelperCommand("");
    setMapEnv("");
    setMapRef("");
    setMappings({});
    setOpenForm(manager);
  }

  async function act(
    manager: ManagerStatus["manager"],
    action: "enable" | "disable" | "refresh",
    extra?: Record<string, unknown>
  ) {
    setBusy(`${manager}:${action}`);
    setNote(null);
    try {
      const res = await fetch("/api/vault/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager, action, ...extra }),
      });
      if (!res.ok) {
        setNote(await readError(res));
        return;
      }
      const body = (await res.json()) as { managers: ManagerStatus[] };
      onChanged(body.managers);
      if (action === "enable") {
        setOpenForm(null);
        // The token was transported to the agent's computer; drop it here.
        setToken("");
        setProjectId("");
        setHelperCommand("");
        setMappings({});
      }
    } catch {
      setNote("manager action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-2">
      <h4 className="m-0 text-[14px] font-semibold">Bring your own manager</h4>
      <p className="muted m-0 text-[12px]">
        Precedence: your agent&apos;s .env/shell wins unless a source sets
        override_existing; mapped bindings beat bulk pulls; the first source to
        claim a variable wins. Conflicts from the latest boot show below.
      </p>
      {(managers ?? []).map((manager) => {
        const meta = MANAGER_META[manager.manager];
        const formOpen = openForm === manager.manager;
        return (
          <div key={manager.manager} className="panel grid gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid gap-0.5">
                <span className="text-[13px] font-medium">{meta.title}</span>
                <span className="muted text-[12px]">{meta.blurb}</span>
              </div>
              <span className="muted text-[12px]">
                {manager.enabled
                  ? `configured${
                      manager.provenance_count !== null
                        ? ` · ${manager.provenance_count} from source`
                        : ""
                    }`
                  : "off"}
              </span>
            </div>
            {manager.warnings ? (
              <pre className="muted m-0 whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[11px]">
                {manager.warnings}
              </pre>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {manager.enabled ? (
                <>
                  <button
                    className="btn-ghost text-[13px]"
                    disabled={busy !== null}
                    onClick={() => void act(manager.manager, "refresh")}
                  >
                    {busy === `${manager.manager}:refresh`
                      ? "Refreshing…"
                      : "Refresh status"}
                  </button>
                  <button
                    className="btn-ghost text-[13px]"
                    disabled={busy !== null}
                    onClick={() => void act(manager.manager, "disable")}
                  >
                    {busy === `${manager.manager}:disable`
                      ? "Disabling…"
                      : "Disable"}
                  </button>
                </>
              ) : (
                <button
                  className="btn-ghost text-[13px]"
                  onClick={() =>
                    openManagerForm(formOpen ? null : manager.manager)
                  }
                >
                  {formOpen ? "Close" : "Enable…"}
                </button>
              )}
            </div>
            {formOpen ? (
              <div className="grid gap-2 border-t border-[var(--ring)] pt-2">
                {manager.manager === "bitwarden" ? (
                  <>
                    <label className="grid gap-1 text-[13px]">
                      Machine-account token (BWS_ACCESS_TOKEN)
                      <input
                        className="input font-mono"
                        type="password"
                        autoComplete="off"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-[13px]">
                      Project ID
                      <input
                        className="input font-mono"
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                {manager.manager === "onepassword" ? (
                  <>
                    <label className="grid gap-1 text-[13px]">
                      Service-account token (OP_SERVICE_ACCOUNT_TOKEN)
                      <input
                        className="input font-mono"
                        type="password"
                        autoComplete="off"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                      />
                    </label>
                    <div className="grid gap-1 text-[13px]">
                      Mappings (ENV_VAR ↔ op://vault/item/field)
                      {Object.entries(mappings).map(([envName, ref]) => (
                        <div
                          key={envName}
                          className="flex items-center gap-2 text-[12px]"
                        >
                          <span className="font-mono">{envName}</span>
                          <span className="muted min-w-0 flex-1 truncate font-mono">
                            {ref}
                          </span>
                          <button
                            className="btn-ghost text-[12px]"
                            onClick={() =>
                              setMappings((prev) => {
                                const next = { ...prev };
                                delete next[envName];
                                return next;
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1.5">
                        <input
                          className="input flex-1 font-mono text-[12px]"
                          placeholder="ENV_VAR"
                          value={mapEnv}
                          onChange={(event) =>
                            setMapEnv(event.target.value.toUpperCase())
                          }
                        />
                        <input
                          className="input flex-1 font-mono text-[12px]"
                          placeholder="op://vault/item/field"
                          value={mapRef}
                          onChange={(event) => setMapRef(event.target.value)}
                        />
                        <button
                          className="btn-ghost text-[12px]"
                          disabled={!ENV_NAME_RE.test(mapEnv) || !mapRef}
                          onClick={() => {
                            setMappings((prev) => ({
                              ...prev,
                              [mapEnv]: mapRef,
                            }));
                            setMapEnv("");
                            setMapRef("");
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
                {manager.manager === "command" ? (
                  <>
                    <p className="m-0 text-[12px] text-red-500">
                      The helper command runs with your agent&apos;s full
                      privilege on its computer.
                    </p>
                    <label className="grid gap-1 text-[13px]">
                      Helper command
                      <input
                        className="input font-mono"
                        autoComplete="off"
                        value={helperCommand}
                        onChange={(event) =>
                          setHelperCommand(event.target.value)
                        }
                      />
                    </label>
                  </>
                ) : null}
                <div className="flex justify-end">
                  <button
                    className="btn"
                    disabled={
                      busy !== null ||
                      (manager.manager === "command"
                        ? helperCommand.trim().length === 0
                        : token.length === 0)
                    }
                    onClick={() =>
                      void act(manager.manager, "enable", {
                        token: token || undefined,
                        project_id: projectId || undefined,
                        helper_command: helperCommand || undefined,
                        mappings:
                          Object.keys(mappings).length > 0
                            ? mappings
                            : undefined,
                      })
                    }
                  >
                    {busy === `${manager.manager}:enable`
                      ? "Enabling…"
                      : "Enable"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
