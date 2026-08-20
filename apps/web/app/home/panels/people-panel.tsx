"use client";

/**
 * People — sender trust management (extracted verbatim from the old page.tsx
 * people tab in the redesign phase-1 split; now self-contained).
 */
import { useEffect, useState } from "react";
import { DitherAvatar } from "@/components/dither-kit/avatar";

interface Sender {
  id: string;
  platform: string;
  address: string;
  trust_tier: number;
  first_seen: string;
  run_count?: number;
  blocked_at?: string | null;
  tier_changed_at?: string | null;
}

export function PeoplePanel({ active }: { active: boolean }) {
  const [people, setPeople] = useState<Sender[] | null>(null);
  // V8 People: expandable sender detail + block.
  const [openSenderId, setOpenSenderId] = useState<string | null>(null);
  const [senderBusy, setSenderBusy] = useState<string | null>(null);
  const [senderNote, setSenderNote] = useState<string | null>(null);

  async function loadPeople() {
    const res = await fetch("/api/senders");
    if (res.ok) {
      const data = (await res.json()) as { senders?: Sender[] };
      setPeople(data.senders ?? []);
    }
  }

  useEffect(() => {
    if (active) void loadPeople();
  }, [active]);

  async function setTrust(id: string, trustTier: number) {
    await fetch("/api/senders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, trust_tier: trustTier }),
    });
    await loadPeople();
  }

  // V8: block an email sender — mirrored server-side to AgentMail's
  // receive-block list (the enforcement layer).
  async function setBlocked(id: string, blocked: boolean) {
    setSenderBusy(id);
    setSenderNote(null);
    try {
      const res = await fetch("/api/senders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, blocked }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSenderNote(data.error ?? "That didn't go through — try again.");
      }
    } catch {
      setSenderNote("That didn't go through — try again.");
    } finally {
      setSenderBusy(null);
    }
    await loadPeople();
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">People</h3>
      <p className="muted m-0 text-[12px]">
        Known senders can talk to your agent; unknown senders wait in “Needs
        you”.
      </p>
      {senderNote ? <p className="muted m-0 text-[12px]">{senderNote}</p> : null}
      {(people ?? []).map((s) => (
        <div key={s.id} className="panel rise-in !p-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
              onClick={() =>
                setOpenSenderId((open) => (open === s.id ? null : s.id))
              }
              aria-expanded={openSenderId === s.id}
            >
              <div className="h-8 w-8 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                <DitherAvatar name={s.address} size={32} />
              </div>
              <div>
                <strong className="text-[13px]">{s.address}</strong>
                <p className="muted m-0 mt-0.5 text-[12px]">
                  {[
                    s.platform,
                    s.blocked_at
                      ? "blocked"
                      : s.trust_tier === 1
                        ? "known"
                        : "unknown",
                    s.run_count != null
                      ? `${s.run_count} message${s.run_count === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </button>
            {s.trust_tier === 2 ? (
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                onClick={() => void setTrust(s.id, 1)}
              >
                Mark known
              </button>
            ) : (
              <button
                className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                onClick={() => void setTrust(s.id, 2)}
              >
                Mark unknown
              </button>
            )}
          </div>
          {openSenderId === s.id ? (
            <div className="mt-2 border-t border-[var(--ring)] pt-2">
              <p className="muted m-0 text-[12px]">
                First seen {new Date(s.first_seen).toLocaleDateString()}
                {s.run_count != null
                  ? ` · ${s.run_count} message${s.run_count === 1 ? "" : "s"} handled`
                  : ""}
              </p>
              {s.tier_changed_at ? (
                <p className="muted m-0 mt-1 text-[12px]">
                  {s.trust_tier === 1 ? "Promoted to known" : "Marked unknown"}{" "}
                  {new Date(s.tier_changed_at).toLocaleString()}
                </p>
              ) : null}
              {s.blocked_at ? (
                <p className="muted m-0 mt-1 text-[12px]">
                  Blocked {new Date(s.blocked_at).toLocaleString()} — their
                  email is refused before your agent sees it.
                </p>
              ) : null}
              {s.platform === "email" ? (
                <div className="mt-2">
                  <button
                    className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                    disabled={senderBusy !== null}
                    onClick={() => void setBlocked(s.id, !s.blocked_at)}
                  >
                    {senderBusy === s.id
                      ? "Working…"
                      : s.blocked_at
                        ? "Unblock"
                        : "Block sender"}
                  </button>
                </div>
              ) : (
                <p className="muted m-0 mt-1 text-[11px]">
                  Blocking applies to email senders.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ))}
      {people !== null && people.length === 0 ? (
        <p className="muted text-[13px]">No one has messaged your agent yet.</p>
      ) : null}
    </div>
  );
}
