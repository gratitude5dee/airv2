"use client";

/**
 * Settings → Profile: the account card (line, email, contact card, wallet
 * link, username) plus Plugin Sign-In, moved here from the old right rail in
 * the redesign phase-1 split.
 */
import { useEffect, useState } from "react";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { PluginPanel } from "../plugin-panel";

interface Me {
  user: { id: string; username: string | null; wallet_address: string | null };
  entitlement: {
    plan: string;
    speed_tier: string;
    tier_models?: { fast: string; balanced: string; deep: string };
    monthly_cap_usd: number;
    spend_mtd_usd: number;
  } | null;
  lines: { phone: string; platform: string }[];
  addresses: { address: string; is_primary: boolean }[];
}

export function ProfilePanel({
  active,
  me,
  onOpenWallet,
}: {
  active: boolean;
  me: Me | null;
  onOpenWallet: () => void;
}) {
  const [username, setUsername] = useState(me?.user.username ?? "");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (me?.user.username) setUsername(me.user.username);
  }, [me]);

  async function saveUsername() {
    setNote(null);
    const res = await fetch("/api/settings/username", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      eligible?: string | null;
    };
    if (res.ok) setNote("Username saved.");
    else if (data.error === "cooldown")
      setNote(`You can change it again on ${data.eligible ?? "a later date"}.`);
    else if (data.error === "taken") setNote("That username is taken.");
    else setNote("Invalid username.");
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-3 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Profile</h3>
      <div className="panel !p-3">
        <div className="mb-2 flex items-center gap-3">
          {me?.user.username ? (
            <div className="h-9 w-9 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
              <DitherAvatar name={me.user.username} size={36} />
            </div>
          ) : null}
          <h4 className="m-0 text-[14px] font-semibold">Account</h4>
        </div>
        <p className="muted my-1 text-[12px]">
          {me?.lines[0] ? `iMessage line: ${me.lines[0].phone}` : "No line yet"}
        </p>
        <p className="muted my-1 text-[12px]">
          {me?.addresses?.[0]
            ? `Email: ${me.addresses[0].address}`
            : "Email: set a username to create one"}
        </p>
        {me?.user.username ? (
          <p className="muted my-1 text-[12px]">
            Contact card:{" "}
            <a href={`/@${me.user.username}`}>/@{me.user.username}</a>
          </p>
        ) : null}
        <p className="muted my-1 text-[12px]">
          {me?.user.wallet_address ? (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 underline decoration-dotted underline-offset-2"
              onClick={onOpenWallet}
            >
              Wallet: {me.user.wallet_address.slice(0, 6)}…
              {me.user.wallet_address.slice(-4)}
            </button>
          ) : (
            "Wallet: not set up"
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={() => void saveUsername()}
          >
            Save
          </button>
        </div>
        {note ? <p className="muted mb-0 mt-2 text-[12px]">{note}</p> : null}
      </div>
      <PluginPanel />
    </div>
  );
}
